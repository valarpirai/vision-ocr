import { useState, useEffect } from "react";
import { getUploads, getUpload, getUploadResult, downloadMarkdown, downloadJSON, getFileUrl, retryUpload } from "../api/client";
import type { UploadListItem, Upload } from "../types";
import { UploadStatus } from "../types";

export default function HistoryPage() {
  const [uploads, setUploads] = useState<UploadListItem[]>([]);
  const [selectedUpload, setSelectedUpload] = useState<Upload | null>(null);
  const [ocrResult, setOcrResult] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [resultLoading, setResultLoading] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    loadUploads();
    const interval = setInterval(loadUploads, 3000);
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
      setShowSidebar(false); // Close sidebar on mobile after selection

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

  const handleRetry = async (uploadId: string) => {
    setRetrying(true);
    try {
      const updatedUpload = await retryUpload(uploadId);
      setSelectedUpload(updatedUpload);

      // Refresh the uploads list
      await loadUploads();

      // Show success message (you can use a toast library for better UX)
      alert("Upload queued for retry. Processing will begin shortly.");
    } catch (err) {
      console.error("Failed to retry upload:", err);
      const errorMessage = err instanceof Error && 'response' in err
        ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
        : "Failed to retry upload";
      alert(errorMessage || "Failed to retry upload");
    } finally {
      setRetrying(false);
    }
  };

  const getStatusColorClass = (status: UploadStatus) => {
    switch (status) {
      case UploadStatus.COMPLETED:
        return "bg-green-600";
      case UploadStatus.PROCESSING:
        return "bg-orange-500";
      case UploadStatus.PENDING:
        return "bg-blue-500";
      case UploadStatus.FAILED:
        return "bg-red-600";
      default:
        return "bg-gray-600";
    }
  };

  return (
    <div className="flex h-full relative">
      {/* Mobile menu button */}
      <button
        onClick={() => setShowSidebar(!showSidebar)}
        className="lg:hidden fixed bottom-4 left-4 z-50 bg-green-600 text-white p-3 rounded-full shadow-lg hover:bg-green-700 transition-colors"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Overlay for mobile */}
      {showSidebar && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={() => setShowSidebar(false)}
        />
      )}

      {/* Left Sidebar - Upload List */}
      <div
        className={`${
          showSidebar ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0 fixed lg:static inset-y-0 left-0 z-40 w-80 border-r border-gray-200 overflow-y-auto p-4 sm:p-6 bg-white transition-transform duration-300`}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Uploads</h2>
          <button
            onClick={() => setShowSidebar(false)}
            className="lg:hidden text-gray-500 hover:text-gray-700"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading ? (
          <p className="text-gray-600">Loading...</p>
        ) : uploads.length === 0 ? (
          <p className="text-gray-600">No uploads yet</p>
        ) : (
          <div className="space-y-3">
            {uploads.map((upload) => (
              <div
                key={upload.id}
                onClick={() => handleSelectUpload(upload.id)}
                className={`p-4 rounded-lg cursor-pointer transition-all duration-200 ${
                  selectedUpload?.id === upload.id
                    ? "border-2 border-green-600 bg-green-50"
                    : "border-2 border-gray-200 bg-gray-50 hover:border-green-300"
                }`}
              >
                <div className="font-semibold text-gray-800 mb-2 break-words">
                  {upload.filename}
                </div>
                <div className="text-sm text-gray-600 mb-2">
                  {new Date(upload.uploaded_at).toLocaleString()}
                </div>
                <span
                  className={`inline-block px-3 py-1 rounded text-xs font-medium text-white ${getStatusColorClass(
                    upload.status
                  )}`}
                >
                  {upload.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right Panel - Details View */}
      <div className="flex-1 flex flex-col bg-white overflow-hidden">
        {selectedUpload ? (
          <>
            {/* Header with export buttons */}
            <div className="border-b border-gray-200 p-4 sm:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h3 className="text-lg sm:text-xl font-bold text-gray-800 break-words">
                {selectedUpload.filename}
              </h3>
              <div className="flex flex-wrap gap-2">
                {selectedUpload.status === UploadStatus.COMPLETED && (
                  <>
                    <a
                      href={downloadMarkdown(selectedUpload.id)}
                      download
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      📄 Markdown
                    </a>
                    <a
                      href={downloadJSON(selectedUpload.id)}
                      download
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      📊 JSON
                    </a>
                  </>
                )}
                {selectedUpload.status === UploadStatus.FAILED && (
                  <button
                    onClick={() => handleRetry(selectedUpload.id)}
                    disabled={retrying}
                    className={`px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors ${
                      retrying
                        ? "bg-gray-400 cursor-not-allowed"
                        : "bg-orange-600 hover:bg-orange-700"
                    }`}
                  >
                    {retrying ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
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
                        Retrying...
                      </span>
                    ) : (
                      <>🔄 Retry Processing</>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Split View */}
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
              {/* Left: Original File Preview */}
              <div className="flex-1 p-4 sm:p-6 overflow-y-auto border-b lg:border-b-0 lg:border-r border-gray-200">
                <h4 className="text-lg font-bold text-gray-800 mb-4">Original File</h4>
                <div className="space-y-4">
                  <div className="space-y-2 text-sm sm:text-base">
                    <p className="text-gray-700">
                      <span className="font-semibold">File:</span> {selectedUpload.filename}
                    </p>
                    <p className="text-gray-700">
                      <span className="font-semibold">Size:</span>{" "}
                      {(selectedUpload.file_size / 1024).toFixed(2)} KB
                    </p>
                    <p className="text-gray-700">
                      <span className="font-semibold">Type:</span> {selectedUpload.mime_type}
                    </p>
                  </div>

                  {/* File Preview */}
                  <div className="mt-4">
                    {selectedUpload.mime_type.startsWith("image/") && (
                      <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                        <img
                          src={getFileUrl(selectedUpload.id)}
                          alt={selectedUpload.filename}
                          className="w-full h-auto max-h-[600px] object-contain"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const parent = target.parentElement;
                            if (parent) {
                              parent.innerHTML = '<div class="p-8 text-center text-gray-500"><p>Failed to load image preview</p></div>';
                            }
                          }}
                        />
                      </div>
                    )}

                    {selectedUpload.mime_type === "application/pdf" && (
                      <div className="p-8 text-center border border-gray-200 rounded-lg bg-gray-50">
                        <svg className="w-16 h-16 mx-auto mb-4 text-red-600" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
                          <path d="M14 2v6h6M9 13h6M9 17h6M9 9h1" />
                        </svg>
                        <p className="text-gray-700 mb-4 font-medium">PDF Document</p>
                        <a
                          href={getFileUrl(selectedUpload.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-md hover:shadow-lg"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                          Open PDF in new tab
                        </a>
                      </div>
                    )}

                    {!selectedUpload.mime_type.startsWith("image/") &&
                     selectedUpload.mime_type !== "application/pdf" && (
                      <div className="p-8 text-center text-gray-500 border border-gray-200 rounded-lg">
                        <p>Preview not available for this file type</p>
                        <a
                          href={getFileUrl(selectedUpload.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-700 underline mt-2 inline-block"
                        >
                          Download file
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: OCR Result */}
              <div className="flex-1 p-4 sm:p-6 overflow-y-auto bg-gray-50">
                <h4 className="text-lg font-bold text-gray-800 mb-4">OCR Result</h4>
                {selectedUpload.status === UploadStatus.PENDING && (
                  <p className="text-gray-600">Waiting to be processed...</p>
                )}
                {selectedUpload.status === UploadStatus.PROCESSING && (
                  <div className="flex items-center gap-2 text-gray-600">
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
                    OCR running...
                  </div>
                )}
                {selectedUpload.status === UploadStatus.FAILED && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <svg className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div className="flex-1">
                        <h5 className="text-red-800 font-semibold mb-1">Processing Failed</h5>
                        <p className="text-red-700 text-sm mb-3">
                          {selectedUpload.error_message || "An error occurred during processing"}
                        </p>
                        <button
                          onClick={() => handleRetry(selectedUpload.id)}
                          disabled={retrying}
                          className={`px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors ${
                            retrying
                              ? "bg-gray-400 cursor-not-allowed"
                              : "bg-orange-600 hover:bg-orange-700"
                          }`}
                        >
                          {retrying ? (
                            <span className="flex items-center gap-2">
                              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
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
                              Retrying...
                            </span>
                          ) : (
                            <>🔄 Retry Processing</>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                {selectedUpload.status === UploadStatus.COMPLETED && (
                  <>
                    {resultLoading ? (
                      <p className="text-gray-600">Loading result...</p>
                    ) : ocrResult ? (
                      <pre className="bg-white p-4 rounded-lg overflow-auto text-xs sm:text-sm border border-gray-200">
                        {JSON.stringify(ocrResult, null, 2)}
                      </pre>
                    ) : (
                      <p className="text-gray-600">No result data</p>
                    )}
                  </>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500 p-4 text-center">
            <div>
              <div className="text-5xl mb-4">📋</div>
              <p className="text-lg">Select an upload to view details</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
