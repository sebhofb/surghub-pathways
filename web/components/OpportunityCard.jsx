"use client";

import Link from "next/link";

const CATEGORY_CONFIG = {
  fellowship: {
    label: "Fellowship",
    bg: "#1a6b4a",
    text: "#ffffff",
  },
  scholarship: {
    label: "Scholarship",
    bg: "#1a3a5c",
    text: "#ffffff",
  },
  grant: {
    label: "Grant",
    bg: "#7b3a8c",
    text: "#ffffff",
  },
  conference: {
    label: "Conference",
    bg: "#c05c00",
    text: "#ffffff",
  },
  research: {
    label: "Research",
    bg: "#8c3a1a",
    text: "#ffffff",
  },
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
  // Use UTC to avoid timezone shifts on YYYY-MM-DD strings
  return new Date(date.getTime() + date.getTimezoneOffset() * 60000).toLocaleDateString(
    "en-US",
    { year: "numeric", month: "long", day: "numeric" }
  );
}

export default function OpportunityCard({ opportunity }) {
  const {
    id,
    title,
    organization,
    category,
    location,
    deadline,
    summary,
    isNew,
    isSponsored,
  } = opportunity;

  const catConfig = CATEGORY_CONFIG[category] || {
    label: category || "Other",
    bg: "#4b5563",
    text: "#ffffff",
  };

  const daysRemaining = getDaysRemaining(deadline);
  const isPast = daysRemaining !== null && daysRemaining < 0;
  const isClosingSoon =
    daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= 30;

  return (
    <Link
      href={`/opportunity/${id}`}
      className={[
        "group relative flex flex-col rounded-xl bg-white shadow-sm border transition-all duration-200",
        "hover:shadow-md hover:-translate-y-0.5",
        isSponsored
          ? "border-yellow-400 border-2"
          : "border-gray-200",
      ].join(" ")}
    >
      {/* Sponsored banner */}
      {isSponsored && (
        <div className="absolute top-0 left-0 right-0 rounded-t-xl bg-yellow-400 text-yellow-900 text-center text-xs font-bold py-0.5 tracking-widest uppercase">
          Sponsored
        </div>
      )}

      <div className={["flex flex-col h-full p-5", isSponsored ? "pt-7" : ""].join(" ")}>
        {/* Top row: category badge + NEW badge */}
        <div className="flex items-center gap-2 mb-3">
          <span
            className="pill"
            style={{ backgroundColor: catConfig.bg, color: catConfig.text }}
          >
            {catConfig.label}
          </span>
          {isNew && (
            <span className="pill bg-emerald-100 text-emerald-700">New</span>
          )}
        </div>

        {/* Title */}
        <h3 className="text-[#1a3a5c] font-bold text-base leading-snug mb-1 group-hover:text-[#1a6b4a] transition-colors line-clamp-2">
          {title}
        </h3>

        {/* Organization */}
        {organization && (
          <p className="text-gray-500 text-sm font-medium mb-1">{organization}</p>
        )}

        {/* Location */}
        {location && (
          <p className="flex items-center gap-1 text-gray-400 text-xs mb-3">
            <svg
              className="w-3.5 h-3.5 flex-shrink-0"
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
            {location}
          </p>
        )}

        {/* Summary */}
        {summary && (
          <p className="text-gray-600 text-sm leading-relaxed line-clamp-3 mb-4 flex-1">
            {summary}
          </p>
        )}

        {/* Deadline section */}
        <div className="mt-auto pt-3 border-t border-gray-100">
          {isPast ? (
            <span className="text-gray-400 text-xs font-medium">Closed</span>
          ) : deadline ? (
            <div className="flex items-center justify-between gap-2">
              <span className="text-gray-500 text-xs">
                Deadline:{" "}
                <span className="font-semibold text-gray-700">
                  {formatDeadline(deadline)}
                </span>
              </span>
              {isClosingSoon && (
                <span className="flex-shrink-0 text-xs font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                  {daysRemaining === 0
                    ? "Due today"
                    : daysRemaining === 1
                    ? "1 day left"
                    : `${daysRemaining} days left`}
                </span>
              )}
            </div>
          ) : (
            <span className="text-gray-400 text-xs font-medium italic">
              Ongoing / Rolling admissions
            </span>
          )}
        </div>
      </div>

      {/* Hover arrow indicator */}
      <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
        <svg
          className="w-4 h-4 text-[#1a6b4a]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M17 8l4 4m0 0l-4 4m4-4H3"
          />
        </svg>
      </div>
    </Link>
  );
}
