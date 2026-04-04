import Link from "next/link";
import { notFound } from "next/navigation";
import { getOpportunities, getOpportunity } from "../../../lib/airtable";
import Header from "../../../components/Header";

// ISR: revalidate every hour
export const revalidate = 3600;

// Pre-render all published opportunity pages at build time
export async function generateStaticParams() {
  try {
    const opportunities = await getOpportunities();
    return opportunities.map((opp) => ({ id: opp.id }));
  } catch {
    return [];
  }
}

// Per-page metadata
export async function generateMetadata({ params }) {
  try {
    const opp = await getOpportunity(params.id);
    if (!opp) return { title: "Not Found | SURGhub Pathways" };
    return {
      title: `${opp.title} | SURGhub Pathways`,
      description: opp.summary || `${opp.title} — ${opp.organization}`,
    };
  } catch {
    return { title: "SURGhub Pathways" };
  }
}

const CATEGORY_CONFIG = {
  fellowship: { label: "Fellowship", bg: "#1a6b4a", text: "#ffffff" },
  scholarship: { label: "Scholarship", bg: "#1a3a5c", text: "#ffffff" },
  grant: { label: "Grant", bg: "#7b3a8c", text: "#ffffff" },
  conference: { label: "Conference", bg: "#c05c00", text: "#ffffff" },
  research: { label: "Research", bg: "#8c3a1a", text: "#ffffff" },
};

function getDaysRemaining(deadline) {
  if (!deadline) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadlineDate = new Date(deadline);
  deadlineDate.setHours(0, 0, 0, 0);
  return Math.ceil((deadlineDate - today) / (1000 * 60 * 60 * 24));
}

function formatDeadline(deadline) {
  if (!deadline) return null;
  const date = new Date(deadline);
  return new Date(date.getTime() + date.getTimezoneOffset() * 60000).toLocaleDateString(
    "en-US",
    { weekday: "long", year: "numeric", month: "long", day: "numeric" }
  );
}

export default async function OpportunityPage({ params }) {
  let opp;
  try {
    opp = await getOpportunity(params.id);
  } catch (err) {
    console.error("Failed to load opportunity:", err);
    notFound();
  }

  if (!opp) notFound();

  const catConfig = CATEGORY_CONFIG[opp.category] || {
    label: opp.category || "Other",
    bg: "#4b5563",
    text: "#ffffff",
  };

  const daysRemaining = getDaysRemaining(opp.deadline);
  const isPast = daysRemaining !== null && daysRemaining < 0;
  const isClosingSoon =
    daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= 30;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      {/* Breadcrumb */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <nav className="flex items-center gap-2 text-sm text-gray-400">
            <Link href="/" className="hover:text-[#1a6b4a] transition-colors">
              Pathways
            </Link>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-gray-600 truncate max-w-xs">{opp.title}</span>
          </nav>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Sponsored bar */}
          {opp.isSponsored && (
            <div className="bg-yellow-400 text-yellow-900 text-center text-xs font-bold py-1.5 tracking-widest uppercase">
              Featured / Sponsored
            </div>
          )}

          <div className="p-6 sm:p-10">
            {/* Top badges */}
            <div className="flex flex-wrap items-center gap-2 mb-5">
              <span
                className="pill text-sm px-4 py-1.5"
                style={{ backgroundColor: catConfig.bg, color: catConfig.text }}
              >
                {catConfig.label}
              </span>
              {opp.isNew && (
                <span className="pill bg-emerald-100 text-emerald-700 text-sm px-4 py-1.5">
                  New
                </span>
              )}
              {isPast && (
                <span className="pill bg-gray-100 text-gray-500 text-sm px-4 py-1.5">
                  Closed
                </span>
              )}
              {isClosingSoon && !isPast && (
                <span className="pill bg-orange-100 text-orange-700 text-sm px-4 py-1.5">
                  {daysRemaining === 0
                    ? "Due today"
                    : daysRemaining === 1
                    ? "1 day left"
                    : `${daysRemaining} days left`}
                </span>
              )}
            </div>

            {/* Title */}
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1a3a5c] leading-tight mb-2">
              {opp.title}
            </h1>

            {/* Organization */}
            {opp.organization && (
              <p className="text-[#1a6b4a] font-semibold text-lg mb-6">
                {opp.organization}
              </p>
            )}

            {/* Meta grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 p-4 sm:p-6 bg-gray-50 rounded-xl border border-gray-100">
              {/* Location */}
              {opp.location && (
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#1a3a5c]/10 flex items-center justify-center mt-0.5">
                    <svg
                      className="w-4 h-4 text-[#1a3a5c]"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                      Location
                    </p>
                    <p className="text-gray-800 font-medium">{opp.location}</p>
                  </div>
                </div>
              )}

              {/* Deadline */}
              <div className="flex items-start gap-3">
                <div
                  className={[
                    "flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5",
                    isPast
                      ? "bg-gray-100"
                      : isClosingSoon
                      ? "bg-orange-100"
                      : "bg-[#1a6b4a]/10",
                  ].join(" ")}
                >
                  <svg
                    className={[
                      "w-4 h-4",
                      isPast
                        ? "text-gray-400"
                        : isClosingSoon
                        ? "text-orange-600"
                        : "text-[#1a6b4a]",
                    ].join(" ")}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                    Deadline
                  </p>
                  {isPast ? (
                    <p className="text-gray-400 font-medium">Closed</p>
                  ) : opp.deadline ? (
                    <p
                      className={[
                        "font-medium",
                        isClosingSoon ? "text-orange-700" : "text-gray-800",
                      ].join(" ")}
                    >
                      {formatDeadline(opp.deadline)}
                    </p>
                  ) : (
                    <p className="text-gray-500 italic font-medium">
                      Ongoing / Rolling admissions
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Summary / description */}
            {opp.summary && (
              <div className="mb-8">
                <h2 className="text-lg font-bold text-[#1a3a5c] mb-3">
                  About this opportunity
                </h2>
                <div className="prose prose-gray max-w-none text-gray-700 leading-relaxed whitespace-pre-line">
                  {opp.summary}
                </div>
              </div>
            )}

            {/* Apply CTA */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-100">
              {opp.url && !isPast ? (
                <a
                  href={opp.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-[#1a6b4a] text-white font-bold text-base hover:bg-[#155839] transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1a6b4a] focus:ring-offset-2"
                >
                  Apply Now
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </a>
              ) : opp.url && isPast ? (
                <a
                  href={opp.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl border border-gray-300 text-gray-500 font-bold text-base hover:bg-gray-50 transition-colors"
                >
                  View Opportunity (Closed)
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              ) : null}

              <Link
                href="/"
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl border border-gray-200 text-gray-600 font-semibold text-base hover:bg-gray-50 transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
                Back to directory
              </Link>
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <p className="mt-6 text-center text-xs text-gray-400">
          This listing is provided for informational purposes. Always verify details directly with the
          organising institution before applying.
        </p>
      </main>

      {/* Footer */}
      <footer className="mt-12 border-t border-gray-200 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-gray-400 text-sm">
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
