import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronRight, FileText, Search, Trophy } from "lucide-react";
import { BackToTop, SiteFooter, SiteHeader, SubpageHero } from "@/components/public-site/site-chrome";
import { fetchPublicNotices, fetchPublicResultsAnnouncements } from "@/lib/public-site-api";

interface FeedItem {
  key: string;
  title: string;
  body: string | null;
  date: string;
  sortKey: string;
  kind: "notice" | "result";
  className: string | null;
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { month: "short", day: "2-digit", year: "numeric" }).format(
    new Date(iso),
  );
}

export function NoticesListPage({ initialQuery }: { initialQuery?: string | undefined }) {
  const [search, setSearch] = useState(initialQuery ?? "");

  const notices = useQuery({ queryKey: ["public-notices"], queryFn: fetchPublicNotices });
  const results = useQuery({
    queryKey: ["public-results-announcements"],
    queryFn: fetchPublicResultsAnnouncements,
  });

  const feed: FeedItem[] = useMemo(() => {
    const noticeItems: FeedItem[] = (notices.data ?? []).map((n) => ({
      key: `notice-${n.id}`,
      title: n.title,
      body: n.body,
      date: formatDate(n.publishedToWebsiteAt),
      sortKey: n.publishedToWebsiteAt,
      kind: "notice",
      className: n.classEntity?.name ?? null,
    }));
    const resultItems: FeedItem[] = (results.data ?? []).map((r) => ({
      key: `result-${r.id}`,
      title: `Result Published — ${r.classEntity.name}, ${r.name}`,
      body: "Contact your class teacher or the examination coordinator to know your individual result.",
      date: formatDate(r.resultsAnnouncedAt),
      sortKey: r.resultsAnnouncedAt,
      kind: "result",
      className: r.classEntity.name,
    }));
    return [...noticeItems, ...resultItems].sort((a, b) => (a.sortKey < b.sortKey ? 1 : -1));
  }, [notices.data, results.data]);

  const query = search.trim().toLowerCase();
  const visible = useMemo(
    () => feed.filter((item) => !query || `${item.title} ${item.body ?? ""}`.toLowerCase().includes(query)),
    [feed, query],
  );
  const isLoading = notices.isLoading || results.isLoading;

  return (
    <div className="school-site">
      <SiteHeader />
      <SubpageHero title="Notices" tagline="Every notice and result announcement published by the school, newest first." />

      <main className="school-container subpage-main">
        <div className="pill-search" style={{ marginBottom: 20 }}>
          <Search size={15} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search notices…"
            aria-label="Search notices"
          />
        </div>

        <div className="subpage-card notices-page-list">
          {isLoading && <p className="empty-search">Loading notices…</p>}
          {!isLoading && visible.length === 0 && (
            <p className="empty-search">
              {query ? `No notices match "${search}".` : "No notices published yet — check back soon."}
            </p>
          )}
          {visible.map((item) => (
            <Link
              className="notice-row notice-row-full"
              key={item.key}
              to={item.kind === "result" ? "/results" : "/notices"}
            >
              <span className={`notice-icon ${item.kind === "result" ? "notice-icon-amber" : "notice-icon-sky"}`}>
                {item.kind === "result" ? <Trophy size={17} /> : <FileText size={17} />}
              </span>
              <span className="notice-copy">
                <span className="notice-title">
                  {item.title}
                  {item.className && <span className="notice-class-pill">{item.className}</span>}
                </span>
                {item.body && <span className="notice-body-preview">{item.body}</span>}
                <span className="notice-date">{item.date}</span>
              </span>
              <ChevronRight className="notice-chevron" size={17} />
            </Link>
          ))}
        </div>
      </main>

      <SiteFooter />
      <BackToTop />
    </div>
  );
}
