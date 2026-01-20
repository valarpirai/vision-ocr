import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getUploads, getUpload, getUploadResult, downloadMarkdown, downloadJSON } from "../api/client";
import { UploadListItem, Upload, UploadStatus } from "../types";

export default function HistoryPage() {
  const [uploads, setUploads] = useState<UploadListItem[]>([]);
  const [selectedUpload, setSelectedUpload] = useState<Upload | null>(null);
  const [ocrResult, setOcrResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [resultLoading, setResultLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadUploads();
    const interval = setInterval(loadUploads, 3000); // Poll every 3 seconds
    return () => clearInterval(interval);
  }, []);

  const loadUploads = async () => {
    try {
      const data = await getUploads();
      setUploads(data);
    } catch (err) {
      console.error("Failed to load uploads:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectUpload = async (uploadId: string) => {
    try {
      const upload = await getUpload(uploadId);
      setSelectedUpload(upload);
      setOcrResult(null);

      if (upload.status === UploadStatus.COMPLETED) {
        setResultLoading(true);
        const result = await getUploadResult(uploadId);
        setOcrResult(result);
        setResultLoading(false);
      }
    } catch (err) {
      console.error("Failed to load upload details:", err);
    }
  };

  const getStatusColor = (status: UploadStatus) => {
    switch (status) {
      case UploadStatus.COMPLETED:
        return "#4CAF50";
      case UploadStatus.PROCESSING:
        return "#FF9800";
      case UploadStatus.PENDING:
        return "#2196F3";
      case UploadStatus.FAILED:
        return "#F44336";
      default:
        return "#666";
    }
  };

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      {/* Left Sidebar - Upload List */}
      <div
        style={{
          width: "300px",
          borderRight: "1px solid #ccc",
          overflowY: "auto",
          padding: "20px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h2>Upload History</h2>
          <button
            onClick={() => navigate("/")}
            style={{
              padding: "8px 16px",
              fontSize: "14px",
              backgroundColor: "#4CAF50",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            New Upload
          </button>
        </div>

        {loading ? (
          <p>Loading...</p>
        ) : uploads.length === 0 ? (
          <p>No uploads yet</p>
        ) : (
          uploads.map((upload) => (
            <div
              key={upload.id}
              onClick={() => handleSelectUpload(upload.id)}
              style={{
                padding: "12px",
                marginBottom: "10px",
                border: `2px solid ${
                  selectedUpload?.id === upload.id ? "#4CAF50" : "#eee"
                }`,
                borderRadius: "4px",
                cursor: "pointer",
                backgroundColor: "#fafafa",
              }}
            >
              <div style={{ fontWeight: "bold", marginBottom: "4px" }}>
                {upload.filename}
              </div>
              <div style={{ fontSize: "0.9em", color: "#666" }}>
                {new Date(upload.uploaded_at).toLocaleString()}
              </div>
              <div
                style={{
                  marginTop: "4px",
                  padding: "4px 8px",
                  display: "inline-block",
                  borderRadius: "4px",
                  fontSize: "0.85em",
                  color: "white",
                  backgroundColor: getStatusColor(upload.status),
                }}
              >
                {upload.status}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Right Panel - Split View */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {selectedUpload ? (
          <>
            {/* Header with export buttons */}
            <div
              style={{
                padding: "20px",
                borderBottom: "1px solid #ccc",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h3>{selectedUpload.filename}</h3>
              {selectedUpload.status === UploadStatus.COMPLETED && (
                <div>
                  <a
                    href={downloadMarkdown(selectedUpload.id)}
                    download
                    style={{
                      marginRight: "10px",
                      padding: "8px 16px",
                      backgroundColor: "#2196F3",
                      color: "white",
                      textDecoration: "none",
                      borderRadius: "4px",
                    }}
                  >
                    Download Markdown
                  </a>
                  <a
                    href={downloadJSON(selectedUpload.id)}
                    download
                    style={{
                      padding: "8px 16px",
                      backgroundColor: "#4CAF50",
                      color: "white",
                      textDecoration: "none",
                      borderRadius: "4px",
                    }}
                  >
                    Download JSON
                  </a>
                </div>
              )}
            </div>

            {/* Split View */}
            <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
              {/* Left: Original File Preview */}
              <div
                style={{
                  flex: 1,
                  padding: "20px",
                  overflowY: "auto",
                  borderRight: "1px solid #ccc",
                }}
              >
                <h4>Original File</h4>
                <p>File: {selectedUpload.filename}</p>
                <p>Size: {(selectedUpload.file_size / 1024).toFixed(2)} KB</p>
                <p>Type: {selectedUpload.mime_type}</p>
                {selectedUpload.mime_type.startsWith("image/") && (
                  <p style={{ color: "#666", fontSize: "0.9em" }}>
                    Image preview not yet implemented
                  </p>
                )}
              </div>

              {/* Right: OCR Result */}
              <div style={{ flex: 1, padding: "20px", overflowY: "auto" }}>
                <h4>OCR Result</h4>
                {selectedUpload.status === UploadStatus.PENDING && (
                  <p>Waiting to be processed...</p>
                )}
                {selectedUpload.status === UploadStatus.PROCESSING && (
                  <p>OCR running...</p>
                )}
                {selectedUpload.status === UploadStatus.FAILED && (
                  <p style={{ color: "red" }}>
                    Processing failed: {selectedUpload.error_message}
                  </p>
                )}
                {selectedUpload.status === UploadStatus.COMPLETED && (
                  <>
                    {resultLoading ? (
                      <p>Loading result...</p>
                    ) : ocrResult ? (
                      <pre
                        style={{
                          backgroundColor: "#f5f5f5",
                          padding: "15px",
                          borderRadius: "4px",
                          overflow: "auto",
                        }}
                      >
                        {JSON.stringify(ocrResult, null, 2)}
                      </pre>
                    ) : (
                      <p>No result data</p>
                    )}
                  </>
                )}
              </div>
            </div>
          </>
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              color: "#666",
            }}
          >
            Select an upload to view details
          </div>
        )}
      </div>
    </div>
  );
}
