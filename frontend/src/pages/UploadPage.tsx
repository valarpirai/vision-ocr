import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { uploadFile } from "../api/client";

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const navigate = useNavigate();

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setError(null);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleSubmit = async () => {
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      await uploadFile(file);
      navigate("/history");
    } catch (err) {
      const errorMessage = err instanceof Error && 'response' in err
        ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
        : "Upload failed";
      setError(errorMessage || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto my-8 sm:my-12 md:my-16 px-4 sm:px-6">
      <div className="bg-white rounded-xl shadow-lg p-6 sm:p-8 md:p-10">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-6 sm:mb-8">Upload Document</h1>

        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-8 sm:p-12 md:p-16 text-center cursor-pointer mb-6 transition-all duration-200 ${
            dragActive
              ? "border-green-600 bg-green-50"
              : "border-gray-300 bg-gray-50 hover:border-green-500"
          }`}
        >
          <input
            type="file"
            id="file-upload"
            accept=".png,.jpg,.jpeg,.pdf,.tiff,.tif"
            onChange={handleChange}
            className="hidden"
          />
          <label htmlFor="file-upload" className="cursor-pointer">
            {file ? (
              <div>
                <div className="text-4xl sm:text-5xl mb-4">📄</div>
                <p className="text-base sm:text-lg font-semibold text-gray-800 mb-2">
                  Selected: {file.name}
                </p>
                <p className="text-sm text-gray-500">
                  {(file.size / 1024).toFixed(2)} KB
                </p>
              </div>
            ) : (
              <div>
                <div className="text-4xl sm:text-5xl mb-4">📁</div>
                <p className="text-base sm:text-lg font-semibold text-gray-700 mb-2">
                  Drag and drop a file here, or click to select
                </p>
                <p className="text-sm text-gray-500">
                  Supported: PNG, JPG, PDF, TIFF
                </p>
              </div>
            )}
          </label>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm sm:text-base">
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={!file || uploading}
          className={`w-full py-3 sm:py-4 text-base sm:text-lg font-semibold rounded-lg transition-all duration-200 ${
            !file || uploading
              ? "bg-gray-300 text-gray-500 cursor-not-allowed"
              : "bg-green-600 hover:bg-green-700 text-white cursor-pointer shadow-md hover:shadow-lg"
          }`}
        >
          {uploading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Uploading...
            </span>
          ) : (
            "Upload"
          )}
        </button>
      </div>
    </div>
  );
}
