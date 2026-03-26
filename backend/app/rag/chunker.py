"""
Sub-page chunker for OCR content.

Splits a single page's OCR text into semantic chunks so each chunk gets its
own embedding. This improves retrieval precision for documents with tables
(invoices, finance reports) where a full-page embedding blurs distinct rows.

Supported content types:
  - Markdown tables  → header + each data row becomes one chunk
  - Prose paragraphs → each paragraph (double-newline separated) is one chunk
  - Key-value lines  → consecutive "Key: value" lines are grouped together
  - Short fragments  → merged with the next chunk to avoid noise embeddings

Chunk IDs are deterministic: "{upload_id}_page_{page}_chunk_{index}"
so re-indexing via upsert is always idempotent.
"""

import re
from dataclasses import dataclass
from typing import List

MIN_CHUNK_CHARS = 30  # chunks shorter than this are merged with the next one


@dataclass
class Chunk:
    index: int          # 0-based position within the page
    content: str        # text to embed and store
    chunk_type: str     # "table_row" | "paragraph" | "kv_group"


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _is_table_separator(line: str) -> bool:
    """True for markdown table separator lines like |---|---|."""
    stripped = line.strip()
    return bool(re.match(r"^\|[\s\-|:]+\|?$", stripped))


def _is_table_row(line: str) -> bool:
    stripped = line.strip()
    return stripped.startswith("|") and not _is_table_separator(stripped)


def _is_kv_line(line: str) -> bool:
    """True for lines like 'Invoice No: 12345' or 'Date: 2024-01-01'."""
    stripped = line.strip()
    return bool(re.match(r"^[A-Za-z][^:\n]{1,40}:\s*.+$", stripped))


def _clean_table_row(row: str) -> str:
    """Strip leading/trailing pipes and extra whitespace from a table row."""
    cells = [c.strip() for c in row.strip().strip("|").split("|")]
    return " | ".join(c for c in cells if c)


def _clean(text: str) -> str:
    return text.strip()


# ---------------------------------------------------------------------------
# Block-level splitter
# ---------------------------------------------------------------------------

def _split_into_blocks(content: str) -> List[List[str]]:
    """
    Group lines into contiguous blocks. A new block starts when:
      - a blank line is encountered (prose paragraph boundary), OR
      - the line type changes between table and non-table
    Returns a list of blocks, each block being a list of non-empty lines.
    """
    blocks: List[List[str]] = []
    current_block: List[str] = []
    in_table = False

    for line in content.splitlines():
        stripped = line.strip()

        if not stripped:
            # Blank line — flush current block
            if current_block:
                blocks.append(current_block)
                current_block = []
            in_table = False
            continue

        line_is_table = _is_table_row(stripped) or _is_table_separator(stripped)

        # Type switch between table and non-table flushes the block
        if current_block and line_is_table != in_table:
            blocks.append(current_block)
            current_block = []

        in_table = line_is_table
        current_block.append(stripped)

    if current_block:
        blocks.append(current_block)

    return blocks


# ---------------------------------------------------------------------------
# Table block → chunks
# ---------------------------------------------------------------------------

def _chunks_from_table_block(lines: List[str]) -> List[str]:
    """
    Given a list of table lines, return one chunk per data row.
    Each chunk prefixes the header so the LLM has column context.

    Example output for a row:
      "Description | Qty | Unit Price | Amount
       Consulting  | 10  | $150.00    | $1,500.00"
    """
    header: str = ""
    chunks: List[str] = []

    for line in lines:
        if _is_table_separator(line):
            continue
        if not header:
            header = _clean_table_row(line)
            continue
        row_text = _clean_table_row(line)
        if row_text:
            chunks.append(f"{header}\n{row_text}")

    # If only a header was found (single-row table), return it as-is
    if not chunks and header:
        chunks.append(header)

    return chunks


# ---------------------------------------------------------------------------
# Prose/KV block → chunks
# ---------------------------------------------------------------------------

def _chunks_from_prose_block(lines: List[str]) -> List[str]:
    """
    Split a non-table block into chunks.
    - Consecutive key-value lines are grouped together (invoice header fields).
    - Other lines are joined into a single paragraph chunk.
    """
    kv_lines: List[str] = []
    prose_lines: List[str] = []
    result: List[str] = []

    def _flush_kv():
        if kv_lines:
            result.append("\n".join(kv_lines))
            kv_lines.clear()

    def _flush_prose():
        if prose_lines:
            result.append(" ".join(prose_lines))
            prose_lines.clear()

    for line in lines:
        if _is_kv_line(line):
            _flush_prose()
            kv_lines.append(line)
        else:
            _flush_kv()
            prose_lines.append(line)

    _flush_kv()
    _flush_prose()
    return result


# ---------------------------------------------------------------------------
# Merge short fragments
# ---------------------------------------------------------------------------

def _merge_short_chunks(raw: List[str]) -> List[str]:
    """
    Merge chunks that are too short (< MIN_CHUNK_CHARS) with the next chunk.
    Avoids polluting ChromaDB with near-empty embeddings.
    """
    merged: List[str] = []
    pending = ""

    for chunk in raw:
        combined = (pending + "\n" + chunk).strip() if pending else chunk
        if len(combined) < MIN_CHUNK_CHARS:
            pending = combined
        else:
            merged.append(combined)
            pending = ""

    if pending:
        if merged:
            merged[-1] = merged[-1] + "\n" + pending
        else:
            merged.append(pending)

    return merged


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def chunk_page(content: str) -> List[Chunk]:
    """
    Split a single OCR page into a list of Chunk objects.
    Each chunk is a semantically coherent unit ready for embedding.
    """
    blocks = _split_into_blocks(content)

    raw_texts: List[tuple[str, str]] = []  # (text, chunk_type)

    for block in blocks:
        if not block:
            continue

        first_content = block[0].strip()
        if _is_table_row(first_content) or _is_table_separator(first_content):
            for text in _chunks_from_table_block(block):
                raw_texts.append((text, "table_row"))
        else:
            for text in _chunks_from_prose_block(block):
                chunk_type = "kv_group" if _is_kv_line(text.splitlines()[0]) else "paragraph"
                raw_texts.append((text, chunk_type))

    # Separate merge per type to avoid mixing table rows with prose
    table_chunks = [(t, ct) for t, ct in raw_texts if ct == "table_row"]
    other_chunks = [(t, ct) for t, ct in raw_texts if ct != "table_row"]

    merged_others = _merge_short_chunks([t for t, _ in other_chunks])
    other_types = [ct for _, ct in other_chunks]

    # Re-attach types after merge (types may shift, default to paragraph)
    final: List[tuple[str, str]] = []
    for i, text in enumerate(merged_others):
        ct = other_types[i] if i < len(other_types) else "paragraph"
        final.append((text, ct))

    final.extend(table_chunks)

    # Sort by original appearance isn't guaranteed after merge, but table rows
    # always come after prose in the same page — acceptable for retrieval.

    return [
        Chunk(index=i, content=_clean(text), chunk_type=ct)
        for i, (text, ct) in enumerate(final)
        if _clean(text)
    ]
