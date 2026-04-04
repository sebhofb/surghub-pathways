import { getOpportunities } from "../lib/airtable";
import Header from "../components/Header";
import SearchFilter from "../components/SearchFilter";

// ISR: revalidate every hour
export const revalidate = 3600;

export default async function HomePage() {
  let opportunities = [];
  let error = null;

  try {
    opportunities = await getOpportunities();
  } catch (err) {
    console.error("Failed to load opportunities:", err);
    error = err.message;
  }

  // Stats for hero section
  const totalCount = opportunities.length;
  const categoryCount = new Set(opportunities.map((o) => o.category)).size;
  const sponsoredCount = opportunities.filter((o) => o.isSponsored).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      {/* Hero */}
      <div className="bg-[#1a3a5c]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <div className="max-w-3xl">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight mb-3">
              Global Surgery{" "}
              <span className="text-[#4ac49a]">Opportunities</span>
            </h1>
            <p className="text-blue-200 text-lg sm:text-xl mb-8 leading-relaxed">
              Fellowships, grants, scholarships and conferences for surgeons and
              practitioners working in global health.
            </p>

            {/* Quick stats */}
            {totalCount > 0 && (
              <div className="flex flex-wrap gap-6">
                <div>
                  <span className="block text-3xl font-extrabold text-white">
                    {totalCount}
                  </span>
                  <span className="text-blue-300 text-sm">
                    Active{" "}
                    {totalCount === 1 ? "Opportunity" : "Opportunities"}
                  </span>
                </div>
                {categoryCount > 1 && (
                  <div>
                    <span className="block text-3xl font-extrabold text-white">
                      {categoryCount}
                    </span>
                    <span className="text-blue-300 text-sm">Categories</span>
                  </div>
                )}
                {sponsoredCount > 0 && (
                  <div>
                    <span className="block text-3xl font-extrabold text-yellow-400">
                      {sponsoredCount}
                    </span>
                    <span className="text-blue-300 text-sm">Featured</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {error ? (
          <div className="rounded-xl bg-red-50 border border-red-200 p-6 text-center">
            <svg
              className="mx-auto w-10 h-10 text-red-400 mb-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
            <p className="text-red-700 font-semibold mb-1">
              Unable to load opportunities
            </p>
            <p className="text-red-500 text-sm">{error}</p>
          </div>
        ) : opportunities.length === 0 ? (
          <div className="text-center py-20">
            <svg
              className="mx-auto w-14 h-14 text-gray-300 mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
              />
            </svg>
            <p className="text-gray-500 font-medium text-lg mb-1">
              No opportunities yet
            </p>
            <p className="text-gray-400 text-sm">
              Check back soon — new opportunities are added regularly.
            </p>
          </div>
        ) : (
          <SearchFilter opportunities={opportunities} />
        )}
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-gray-400 text-sm text-center sm:text-left">
              <span className="font-semibold text-[#1a3a5c]">SURGhub Pathways</span>{" "}
              &mdash; Connecting surgeons to global opportunities.
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-400">
              <a
                href="https://surghub.org"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[#1a6b4a] transition-colors"
              >
                surghub.org
              </a>
              <span>&middot;</span>
              <a
                href="https://surghub.org/submit"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[#1a6b4a] transition-colors"
              >
                Submit an opportunity
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
