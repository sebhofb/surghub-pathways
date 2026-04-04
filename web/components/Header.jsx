"use client";

import Link from "next/link";

export default function Header() {
  return (
    <header className="bg-[#1a3a5c] shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo + wordmark */}
          <Link href="/" className="flex items-center gap-3 group">
            {/* Scalpel / cross icon */}
            <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-[#1a6b4a] flex items-center justify-center shadow">
              <svg
                viewBox="0 0 32 32"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="w-5 h-5"
              >
                {/* Simple surgical cross */}
                <rect x="14" y="4" width="4" height="24" rx="2" fill="white" />
                <rect x="4" y="14" width="24" height="4" rx="2" fill="white" />
              </svg>
            </div>
            <div className="leading-tight">
              <span className="block text-white font-bold text-lg tracking-tight group-hover:text-green-200 transition-colors">
                SURGhub{" "}
                <span className="text-[#4ac49a] font-extrabold">Pathways</span>
              </span>
              <span className="block text-blue-200 text-xs font-medium tracking-wide">
                The global surgery opportunity directory
              </span>
            </div>
          </Link>

          {/* Right-side nav */}
          <nav className="hidden sm:flex items-center gap-6">
            <Link
              href="/"
              className="text-blue-100 hover:text-white text-sm font-medium transition-colors"
            >
              Browse
            </Link>
            <a
              href="https://surghub.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-100 hover:text-white text-sm font-medium transition-colors"
            >
              SURGhub
            </a>
            <a
              href="https://surghub.org/submit"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-4 py-1.5 rounded-full bg-[#1a6b4a] text-white text-sm font-semibold hover:bg-[#155839] transition-colors"
            >
              Submit Opportunity
            </a>
          </nav>

          {/* Mobile: submit button only */}
          <div className="sm:hidden">
            <a
              href="https://surghub.org/submit"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-3 py-1.5 rounded-full bg-[#1a6b4a] text-white text-xs font-semibold hover:bg-[#155839] transition-colors"
            >
              Submit
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
