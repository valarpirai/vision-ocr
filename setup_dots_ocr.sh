#!/bin/bash
# Setup script for dots.ocr

set -e

echo "===== dots.ocr Setup Script ====="
echo ""

# Check if conda is available
if ! command -v conda &> /dev/null; then
    echo "ERROR: conda is not installed. Please install Miniconda or Anaconda first."
    echo "Download from: https://docs.conda.io/en/latest/miniconda.html"
    exit 1
fi

echo "Step 1: Creating conda environment 'dots_ocr'..."
conda create -n dots_ocr python=3.12 -y

echo ""
echo "Step 2: Activating environment..."
eval "$(conda shell.bash hook)"
conda activate dots_ocr

echo ""
echo "Step 3: Cloning dots.ocr repository..."
cd ~
if [ -d "dots.ocr" ]; then
    echo "dots.ocr directory already exists, skipping clone..."
    cd dots.ocr
else
    git clone https://github.com/rednote-hilab/dots.ocr.git
    cd dots.ocr
fi

echo ""
echo "Step 4: Installing PyTorch..."
# Detect CUDA version or use CPU
if command -v nvidia-smi &> /dev/null; then
    echo "GPU detected, installing PyTorch with CUDA 12.8 support..."
    pip install torch==2.7.0 torchvision==0.22.0 --index-url https://download.pytorch.org/whl/cu128
else
    echo "No GPU detected, installing CPU-only PyTorch (will be slow)..."
    pip install torch==2.7.0 torchvision==0.22.0 --index-url https://download.pytorch.org/whl/cpu
fi

echo ""
echo "Step 5: Installing dots.ocr..."
pip install -e .

echo ""
echo "Step 6: Downloading model weights..."
python3 tools/download_model.py

echo ""
echo "===== Setup Complete! ====="
echo ""
echo "To start the vLLM server, run:"
echo "  conda activate dots_ocr"
echo "  cd ~/dots.ocr"
echo "  vllm serve rednote-hilab/dots.ocr --trust-remote-code --async-scheduling --port 8001"
echo ""
