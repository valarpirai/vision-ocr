# dots.ocr Setup Guide

This guide explains how to set up the dots.ocr inference server for the Vision OCR application.

## Prerequisites

- Python 3.11 or 3.12
- CUDA-capable GPU (recommended for performance)
- At least 8GB GPU memory for the model

## Installation Steps

### 1. Create Python Environment

```bash
# Create a new conda environment
conda create -n dots_ocr python=3.12
conda activate dots_ocr
```

### 2. Clone dots.ocr Repository

```bash
cd ~  # or your preferred directory
git clone https://github.com/rednote-hilab/dots.ocr.git
cd dots.ocr
```

### 3. Install PyTorch

Install PyTorch with CUDA support (adjust CUDA version as needed):

```bash
# For CUDA 12.8
pip install torch==2.7.0 torchvision==0.22.0 --index-url https://download.pytorch.org/whl/cu128

# For CUDA 11.8
pip install torch==2.7.0 torchvision==0.22.0 --index-url https://download.pytorch.org/whl/cu118

# For CPU only (not recommended, very slow)
pip install torch==2.7.0 torchvision==0.22.0 --index-url https://download.pytorch.org/whl/cpu
```

### 4. Install dots.ocr

```bash
pip install -e .
```

### 5. Download Model Weights

```bash
python3 tools/download_model.py
```

This will download the `rednote-hilab/dots.ocr` model from HuggingFace.

## Running the vLLM Server

### Start the Server

**IMPORTANT**: Run the server on port 8001 to avoid conflict with the Vision OCR backend (port 8000).

```bash
vllm serve rednote-hilab/dots.ocr \
  --trust-remote-code \
  --async-scheduling \
  --port 8001
```

The server will start and listen on `http://localhost:8001`.

### Verify Server is Running

In a new terminal:

```bash
curl http://localhost:8001/health
```

You should see a health check response.

## Configuration

The Vision OCR application connects to the dots.ocr server using these environment variables in `backend/.env`:

```env
# dots.ocr vLLM configuration
DOTS_OCR_URL=http://localhost:8001/v1/chat/completions
DOTS_OCR_MODEL=rednote-hilab/dots.ocr
DOTS_OCR_PROMPT_MODE=prompt_layout_all_en
```

### Available Prompt Modes

- `prompt_layout_all_en` - Full layout detection with English text (default, recommended)
- `prompt_layout_all` - Full layout detection with multilingual text
- `prompt_text_only` - Text recognition only, no layout
- `prompt_formula` - Focus on mathematical formulas
- `prompt_table` - Focus on table extraction

You can change `DOTS_OCR_PROMPT_MODE` in your `.env` file to use different modes.

## Running the Complete Stack

### Terminal 1: Start dots.ocr vLLM Server

```bash
conda activate dots_ocr
cd ~/dots.ocr
vllm serve rednote-hilab/dots.ocr --trust-remote-code --async-scheduling --port 8001
```

Wait for the server to fully load (you'll see "Application startup complete").

### Terminal 2: Start Vision OCR Application

```bash
cd /path/to/vision
pm2 start ecosystem.config.js
pm2 logs
```

The application will now use the actual dots.ocr inference server for OCR processing.

## Troubleshooting

### Port 8001 Already in Use

If port 8001 is already in use, you can change it:

1. Start vLLM on a different port:
   ```bash
   vllm serve rednote-hilab/dots.ocr --trust-remote-code --async-scheduling --port 8002
   ```

2. Update `backend/.env`:
   ```env
   DOTS_OCR_URL=http://localhost:8002/v1/chat/completions
   ```

3. Restart the workers:
   ```bash
   pm2 restart worker
   ```

### Out of Memory Errors

If you encounter CUDA OOM errors:

1. Reduce batch size in vLLM:
   ```bash
   vllm serve rednote-hilab/dots.ocr \
     --trust-remote-code \
     --async-scheduling \
     --port 8001 \
     --max-num-seqs 2
   ```

2. Use CPU inference (very slow):
   ```bash
   vllm serve rednote-hilab/dots.ocr \
     --trust-remote-code \
     --async-scheduling \
     --port 8001 \
     --device cpu
   ```

### Connection Refused Errors

- Make sure the vLLM server is running and has finished loading
- Check that the port matches in both the vLLM server and `.env` file
- Verify the server is accessible: `curl http://localhost:8001/health`

### Slow Processing

- Ensure you're using GPU inference (CUDA)
- Consider increasing the number of workers in `ecosystem.config.js` (but not more than your GPU can handle)
- Check GPU memory usage: `nvidia-smi`

## Performance Notes

- **First request**: May be slow due to model warmup
- **Subsequent requests**: Should be fast (~2-5 seconds per page on GPU)
- **Multi-page PDFs**: Each page is processed sequentially
- **Parallel workers**: The application runs 3 worker instances by default, but they share the same vLLM server which handles queueing

## Alternative: Docker Deployment

For production deployment with Docker, you'll need to:

1. Create a separate Docker container for the vLLM server
2. Update `docker-compose.yml` to include the vLLM service
3. Ensure GPU passthrough is configured for the vLLM container

This is more complex and requires NVIDIA Docker runtime. Refer to vLLM's Docker documentation for details.

## API Testing

You can test the dots.ocr API directly with curl:

```bash
# Create a test payload
cat > test.json << 'EOF'
{
  "model": "rednote-hilab/dots.ocr",
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "image_url",
          "image_url": {
            "url": "data:image/png;base64,<BASE64_IMAGE_HERE>"
          }
        },
        {
          "type": "text",
          "text": "prompt_layout_all_en"
        }
      ]
    }
  ],
  "max_tokens": 4096,
  "temperature": 0
}
EOF

# Send request
curl -X POST http://localhost:8001/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d @test.json
```

## Next Steps

Once the dots.ocr server is running:

1. Upload a document through the web interface at http://localhost:5173
2. The worker will automatically process it using dots.ocr
3. View the results in the history page
4. Export as Markdown or JSON

Enjoy accurate document OCR with dots.ocr!
