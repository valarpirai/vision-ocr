import { Link, useLocation } from "react-router-dom";

export default function Navigation() {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo and version */}
          <div className="flex items-center gap-2 sm:gap-3">
            <h1 className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-800">
              📄 Vision OCR
            </h1>
            <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">
              v1.0
            </span>
          </div>

          {/* Navigation links */}
          <div className="flex">
            <Link
              to="/"
              className={`px-3 sm:px-6 py-4 text-sm sm:text-base font-medium transition-all duration-200 border-b-3 ${
                isActive("/")
                  ? "text-green-600 font-bold border-green-600"
                  : "text-gray-700 border-transparent hover:text-green-600"
              }`}
            >
              <span className="hidden sm:inline">🏠 </span>Home
            </Link>
            <Link
              to="/upload"
              className={`px-3 sm:px-6 py-4 text-sm sm:text-base font-medium transition-all duration-200 border-b-3 ${
                isActive("/upload")
                  ? "text-green-600 font-bold border-green-600"
                  : "text-gray-700 border-transparent hover:text-green-600"
              }`}
            >
              <span className="hidden sm:inline">📤 </span>Upload
            </Link>
            <Link
              to="/history"
              className={`px-3 sm:px-6 py-4 text-sm sm:text-base font-medium transition-all duration-200 border-b-3 ${
                isActive("/history")
                  ? "text-green-600 font-bold border-green-600"
                  : "text-gray-700 border-transparent hover:text-green-600"
              }`}
            >
              <span className="hidden sm:inline">📋 </span>History
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
