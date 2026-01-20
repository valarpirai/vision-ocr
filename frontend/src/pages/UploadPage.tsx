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
      const result = await uploadFile(file);
      navigate("/history");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ maxWidth: "600px", margin: "50px auto", padding: "20px" }}>
      <h1>Upload Document</h1>

      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${dragActive ? "#4CAF50" : "#ccc"}`,
          borderRadius: "8px",
          padding: "40px",
          textAlign: "center",
          backgroundColor: dragActive ? "#f0f8ff" : "#fafafa",
          cursor: "pointer",
          marginBottom: "20px",
        }}
      >
        <input
          type="file"
          id="file-upload"
          accept=".png,.jpg,.jpeg,.pdf,.tiff,.tif"
          onChange={handleChange}
          style={{ display: "none" }}
        />
        <label htmlFor="file-upload" style={{ cursor: "pointer" }}>
          {file ? (
            <p>Selected: {file.name}</p>
          ) : (
            <p>Drag and drop a file here, or click to select</p>
          )}
          <p style={{ fontSize: "0.9em", color: "#666" }}>
            Supported: PNG, JPG, PDF, TIFF
          </p>
        </label>
      </div>

      {error && (
        <div style={{ color: "red", marginBottom: "20px" }}>{error}</div>
      )}

      <button
        onClick={handleSubmit}
        disabled={!file || uploading}
        style={{
          padding: "12px 24px",
          fontSize: "16px",
          backgroundColor: !file || uploading ? "#ccc" : "#4CAF50",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: !file || uploading ? "not-allowed" : "pointer",
          width: "100%",
        }}
      >
        {uploading ? "Uploading..." : "Upload"}
      </button>

      <button
        onClick={() => navigate("/history")}
        style={{
          padding: "12px 24px",
          fontSize: "16px",
          backgroundColor: "white",
          color: "#333",
          border: "1px solid #ccc",
          borderRadius: "4px",
          cursor: "pointer",
          width: "100%",
          marginTop: "10px",
        }}
      >
        View Upload History
      </button>
    </div>
  );
}
