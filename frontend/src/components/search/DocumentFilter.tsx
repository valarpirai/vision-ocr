import { useState } from "react";
import type { UploadListItem } from "../../types";

interface Props {
  uploads: UploadListItem[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export default function DocumentFilter({ uploads, selectedIds, onChange }: Props) {
  const [open, setOpen] = useState(false);

  const toggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const label =
    selectedIds.length === 0
      ? "All Documents"
      : `${selectedIds.length} document${selectedIds.length > 1 ? "s" : ""} selected`;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition-colors"
      >
        <span className="text-gray-600">{label}</span>
        <span className="text-gray-400">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
          <div className="p-2 border-b border-gray-100">
            <button
              onClick={() => onChange([])}
              className="text-xs text-green-600 hover:text-green-700 font-medium"
            >
              Clear selection (use all)
            </button>
          </div>
          {uploads.length === 0 && (
            <p className="text-xs text-gray-400 p-3">No completed documents available.</p>
          )}
          {uploads.map((upload) => (
            <label
              key={upload.id}
              className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(upload.id)}
                onChange={() => toggle(upload.id)}
                className="accent-green-600"
              />
              <span className="text-sm text-gray-700 truncate">{upload.filename}</span>
            </label>
          ))}
        </div>
      )}

      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {selectedIds.map((id) => {
            const upload = uploads.find((u) => u.id === id);
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full"
              >
                {upload?.filename ?? id}
                <button
                  onClick={() => toggle(id)}
                  className="hover:text-red-500 font-bold leading-none"
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
