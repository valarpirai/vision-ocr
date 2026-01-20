#!/usr/bin/env python3
"""
Integration test script for Vision OCR application.
Tests backend API and worker functionality.
"""

import sys
import time
import requests
from pathlib import Path

# Configuration
BACKEND_URL = "http://localhost:8000"
DOTS_OCR_URL = "http://localhost:8001"

def print_status(message, status="INFO"):
    colors = {
        "INFO": "\033[94m",
        "SUCCESS": "\033[92m",
        "WARNING": "\033[93m",
        "ERROR": "\033[91m",
        "RESET": "\033[0m"
    }
    print(f"{colors.get(status, '')}{status}: {message}{colors['RESET']}")


def test_backend_health():
    """Test if backend is running."""
    print_status("Testing backend health...", "INFO")
    try:
        response = requests.get(f"{BACKEND_URL}/", timeout=5)
        if response.status_code == 200:
            print_status(f"Backend is running: {response.json()}", "SUCCESS")
            return True
        else:
            print_status(f"Backend returned status {response.status_code}", "ERROR")
            return False
    except requests.exceptions.RequestException as e:
        print_status(f"Backend is not responding: {e}", "ERROR")
        return False


def test_dots_ocr_health():
    """Test if dots.ocr vLLM server is running."""
    print_status("Testing dots.ocr server health...", "INFO")
    try:
        response = requests.get(f"{DOTS_OCR_URL.replace('/v1/chat/completions', '')}/health", timeout=5)
        if response.status_code == 200:
            print_status("dots.ocr server is running", "SUCCESS")
            return True
        else:
            print_status(f"dots.ocr server returned status {response.status_code}", "WARNING")
            return False
    except requests.exceptions.RequestException as e:
        print_status(f"dots.ocr server is not responding: {e}", "WARNING")
        print_status("The application will run but OCR processing will fail", "WARNING")
        return False


def test_api_endpoints():
    """Test API endpoints."""
    print_status("Testing API endpoints...", "INFO")

    # Test GET /api/uploads
    try:
        response = requests.get(f"{BACKEND_URL}/api/uploads", timeout=5)
        if response.status_code == 200:
            uploads = response.json()
            print_status(f"GET /api/uploads: OK (found {len(uploads)} uploads)", "SUCCESS")
        else:
            print_status(f"GET /api/uploads: Failed with status {response.status_code}", "ERROR")
            return False
    except Exception as e:
        print_status(f"GET /api/uploads: Failed - {e}", "ERROR")
        return False

    return True


def test_database():
    """Test database connection."""
    print_status("Testing database...", "INFO")
    db_path = Path("backend/app.db")
    if db_path.exists():
        print_status(f"Database file exists at {db_path}", "SUCCESS")
        print_status(f"Database size: {db_path.stat().st_size} bytes", "INFO")
    else:
        print_status("Database will be created on first use", "INFO")
    return True


def main():
    print("\n" + "="*60)
    print("Vision OCR Integration Test")
    print("="*60 + "\n")

    results = {
        "Backend Health": test_backend_health(),
        "dots.ocr Server": test_dots_ocr_health(),
        "API Endpoints": test_api_endpoints(),
        "Database": test_database(),
    }

    print("\n" + "="*60)
    print("Test Results Summary")
    print("="*60)

    for test_name, passed in results.items():
        status = "✓ PASS" if passed else "✗ FAIL"
        color = "SUCCESS" if passed else "ERROR"
        print_status(f"{test_name}: {status}", color)

    print("\n")

    # Overall status
    all_critical_passed = results["Backend Health"] and results["API Endpoints"]

    if all_critical_passed:
        if results["dots.ocr Server"]:
            print_status("All tests passed! Application is ready to use.", "SUCCESS")
            print_status("Start the frontend with: cd frontend && npm run dev", "INFO")
            return 0
        else:
            print_status("Backend is ready but dots.ocr server is not running.", "WARNING")
            print_status("Start dots.ocr with: vllm serve rednote-hilab/dots.ocr --trust-remote-code --async-scheduling --port 8001", "WARNING")
            return 1
    else:
        print_status("Critical tests failed. Please check the errors above.", "ERROR")
        print_status("Make sure to start the backend with: pm2 start ecosystem.config.js", "INFO")
        return 2


if __name__ == "__main__":
    sys.exit(main())
