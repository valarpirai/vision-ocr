import { Link } from "react-router-dom";

export default function WelcomePage() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 md:py-16">
      {/* Hero Section */}
      <div className="text-center mb-12 sm:mb-16 md:mb-20">
        <div className="text-6xl sm:text-7xl md:text-8xl mb-4 sm:mb-6">📄</div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-800 mb-4 sm:mb-6">
          Vision OCR
        </h1>
        <p className="text-base sm:text-lg md:text-xl text-gray-600 mb-8 sm:mb-10 max-w-3xl mx-auto leading-relaxed px-4">
          Transform your documents into structured text using advanced OCR
          technology powered by dots.ocr vision-language models.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 sm:gap-5 justify-center px-4">
          <Link
            to="/upload"
            className="inline-block px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-lg transition-transform duration-200 hover:-translate-y-1"
          >
            Get Started →
          </Link>
          <Link
            to="/history"
            className="inline-block px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg bg-white hover:border-green-600 text-gray-800 font-bold rounded-lg border-2 border-gray-300 transition-colors duration-200"
          >
            View History
          </Link>
        </div>
      </div>

      {/* Features Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 md:gap-8 mb-12 sm:mb-16 md:mb-20">
        <FeatureCard
          icon="📤"
          title="Easy Upload"
          description="Drag and drop your images or PDFs. Supports PNG, JPG, PDF, and TIFF formats."
        />
        <FeatureCard
          icon="🤖"
          title="AI-Powered OCR"
          description="Leverages dots.ocr vision-language models for accurate text extraction."
        />
        <FeatureCard
          icon="📊"
          title="Multi-Page Support"
          description="Process multi-page PDFs with individual page results and metadata."
        />
        <FeatureCard
          icon="💾"
          title="Export Options"
          description="Download results as Markdown or JSON for easy integration."
        />
        <FeatureCard
          icon="⚡"
          title="Real-Time Processing"
          description="Background workers process your documents while you browse."
        />
        <FeatureCard
          icon="📜"
          title="Upload History"
          description="Track all your uploads with status monitoring and result viewing."
        />
      </div>

      {/* How It Works Section */}
      <div className="bg-gray-50 rounded-xl p-6 sm:p-8 md:p-10 mb-8 sm:mb-10">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-6 sm:mb-8 text-center">
          How It Works
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          <Step number="1" title="Upload" description="Select your document" />
          <Step number="2" title="Process" description="AI extracts text" />
          <Step number="3" title="Review" description="View results" />
          <Step number="4" title="Export" description="Download as needed" />
        </div>
      </div>

      {/* Stats Section */}
      <div className="flex flex-wrap justify-around gap-6 sm:gap-8 py-8 sm:py-10 border-t border-b border-gray-200">
        <Stat value="50MB" label="Max File Size" />
        <Stat value="PDF + Images" label="Supported Formats" />
        <Stat value="3" label="Parallel Workers" />
        <Stat value="Real-time" label="Status Updates" />
      </div>

      {/* Footer CTA */}
      <div className="text-center mt-12 sm:mt-16">
        <p className="text-base sm:text-lg text-gray-600 mb-4 sm:mb-5">
          Ready to extract text from your documents?
        </p>
        <Link
          to="/upload"
          className="inline-block px-6 sm:px-7 py-3 text-base sm:text-lg bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors duration-200"
        >
          Start Processing Now
        </Link>
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-white p-6 sm:p-8 rounded-xl shadow-md hover:shadow-xl transition-all duration-200 hover:-translate-y-1 text-center">
      <div className="text-4xl sm:text-5xl mb-3 sm:mb-4">{icon}</div>
      <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-2 sm:mb-3">
        {title}
      </h3>
      <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
        {description}
      </p>
    </div>
  );
}

function Step({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center">
      <div className="w-12 h-12 sm:w-16 sm:h-16 bg-green-600 text-white rounded-full flex items-center justify-center text-xl sm:text-2xl font-bold mx-auto mb-3 sm:mb-4">
        {number}
      </div>
      <h4 className="text-base sm:text-lg font-bold text-gray-800 mb-1 sm:mb-2">
        {title}
      </h4>
      <p className="text-xs sm:text-sm text-gray-600">{description}</p>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-2xl sm:text-3xl font-bold text-green-600 mb-1 sm:mb-2">
        {value}
      </div>
      <div className="text-xs sm:text-sm text-gray-600">{label}</div>
    </div>
  );
}
