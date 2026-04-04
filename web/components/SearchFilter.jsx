"use client";

import { useState, useMemo } from "react";
import OpportunityCard from "./OpportunityCard";

const CATEGORIES = [
  { value: "all", label: "All" },
  { value: "fellowship", label: "Fellowship" },
  { value: "scholarship", label: "Scholarship" },
  { value: "grant", label: "Grant" },
  { value: "conference", label: "Conference" },
  { value: "research", label: "Research" },
];

function getDaysRemaining(deadline) {
  if (!deadline) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadlineDate = new Date(deadline);
  deadlineDate.setHours(0, 0, 0, 0);
  return Math.ceil((deadlineDate - today) / (1000 * 60 * 60 * 24));
}

export default function SearchFilter({ opportunities }) {
  const [searchText, setSearchText] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [closingSoon, setClosingSoon] = useState(false);

  const filtered = useMemo(() => {
    let results = opportunities;

    // Category filter
    if (activeCategory !== "all") {
      results = results.filter(
        (opp) => opp.category === activeCategory
      );
    }

    // Closing soon filter (≤30 days and not past)
    if (closingSoon) {
      results = results.filter((opp) => {
        const days = getDaysRemaining(opp.deadline);
        return days !== null && days >= 0 && days <= 30;
      });
    }

    // Search text filter
    if (searchText.trim()) {
      const query = searchText.toLowerCase();
      results = results.filter(
        (opp) =>
          opp.title?.toLowerCase().includes(query) ||
          opp.organization?.toLowerCase().includes(query) ||
          opp.summary?.toLowerCase().includes(query) ||
          opp.location?.toLowerCase().includes(query)
      );
    }

    return results;
  }, [opportunities, activeCategory, closingSoon, searchText]);

  const closingSoonCount = useMemo(() => {
    return opportunities.filter((opp) => {
      const days = getDaysRemaining(opp.deadline);
      return days !== null && days >= 0 && days <= 30;
    }).length;
  }, [opportunities]);

  return (
    <div>
      {/* Search + Closing Soon toggle row */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        {/* Search input */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg
              className="h-5 w-5 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <input
            type="search"
            placeholder="Search by title, organization, location..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="block w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a6b4a] focus:border-transparent shadow-sm"
          />
          {searchText && (
            <button
              onClick={() => setSearchText("")}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              aria-label="Clear search"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Closing Soon toggle */}
        {closingSoonCount > 0 && (
          <button
            onClick={() => setClosingSoon((v) => !v)}
            className={[
              "flex-shrink-0 flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-semibold transition-all shadow-sm",
              closingSoon
                ? "bg-orange-500 border-orange-500 text-white"
                : "bg-white border-gray-200 text-orange-600 hover:border-orange-300",
            ].join(" ")}
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
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Closing Soon
            <span
              className={[
                "text-xs font-bold px-1.5 py-0.5 rounded-full",
                closingSoon
                  ? "bg-white text-orange-600"
                  : "bg-orange-100 text-orange-700",
              ].join(" ")}
            >
              {closingSoonCount}
            </span>
          </button>
        )}
      </div>

      {/* Category filter pills */}
      <div className="flex flex-wrap gap-2 mb-6">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setActiveCategory(cat.value)}
            className={[
              "px-4 py-1.5 rounded-full text-sm font-semibold border transition-all",
              activeCategory === cat.value
                ? "bg-[#1a3a5c] text-white border-[#1a3a5c] shadow-sm"
                : "bg-white text-gray-600 border-gray-200 hover:border-[#1a3a5c] hover:text-[#1a3a5c]",
            ].join(" ")}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">
          {filtered.length === 0 ? (
            "No opportunities found"
          ) : (
            <>
              Showing{" "}
              <span className="font-semibold text-gray-800">{filtered.length}</span>{" "}
              {filtered.length === 1 ? "opportunity" : "opportunities"}
              {activeCategory !== "all" && (
                <> in <span className="font-semibold capitalize text-[#1a3a5c]">{activeCategory}</span></>
              )}
              {closingSoon && " closing soon"}
            </>
          )}
        </p>

        {/* Reset filters link */}
        {(searchText || activeCategory !== "all" || closingSoon) && (
          <button
            onClick={() => {
              setSearchText("");
              setActiveCategory("all");
              setClosingSoon(false);
            }}
            className="text-sm text-[#1a6b4a] hover:underline font-medium"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Grid of cards */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
          <svg
            className="mx-auto w-12 h-12 text-gray-300 mb-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <p className="text-gray-500 font-medium mb-1">No opportunities match your search</p>
          <p className="text-gray-400 text-sm">Try adjusting your filters or search terms</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((opp) => (
            <OpportunityCard key={opp.id} opportunity={opp} />
          ))}
        </div>
      )}
    </div>
  );
}
