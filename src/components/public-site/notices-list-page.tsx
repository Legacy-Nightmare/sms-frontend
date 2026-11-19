import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, FileText, Search, Trophy, X } from "lucide-react";
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
  examType: string | null;
  academicYear: string | null;
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { month: "short", day: "2-digit", year: "numeric" }).format(
    new Date(iso),
  );
}

// Reused for both notices and result announcements — a result has no free-text
// body, so its exam type/year (otherwise never shown anywhere) fill the modal
// instead of leaving it looking empty.
function NoticeDetailModal({ item, onClose }: { item: FeedItem; onClose: () => void }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="notice-modal-overlay" onClick={onClose}>
      <div className="notice-modal" onClick={(e) => e.stopPropagation()}>
        <div className="notice-modal-header">
          <h2>{item.title}</h2>
          <button type="button" className="notice-modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="notice-modal-body">
          <p className="notice-date" style={{ marginBottom: 12 }}>
            {item.date}
            {item.className && <span className="notice-class-pill">{item.className}</span>}
          </p>
          {item.body && <p style={{ whiteSpace: "pre-wrap" }}>{item.body}</p>}
          {item.kind === "result" && (
            <dl className="notice-result-meta">
              {item.examType && (
                <>
                  <dt>Exam type</dt>
                  <dd>{item.examType === "final" ? "Final" : "Tutorial"}</dd>
                </>
              )}
              {item.academicYear && (
                <>
                  <dt>Academic year</dt>
                  <dd>{item.academicYear}</dd>
                </>
              )}
            </dl>
          )}
        </div>
      </div>
    </div>
  );
}

export function NoticesListPage({ initialQuery }: { initialQuery?: string | undefined }) {
  const [search, setSearch] = useState(initialQuery ?? "");
  const [selected, setSelected] = useState<FeedItem | null>(null);

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
      examType: null,
      academicYear: null,
    }));
    const resultItems: FeedItem[] = (results.data ?? []).map((r) => ({
      key: `result-${r.id}`,
      title: `Result Published — ${r.classEntity.name}, ${r.name}`,
      body: "Contact your class teacher or the examination coordinator to know your individual result.",
      date: formatDate(r.resultsAnnouncedAt),
      sortKey: r.resultsAnnouncedAt,
      kind: "result",
      className: r.classEntity.name,
      examType: r.type,
      academicYear: r.academicYear,
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
            <button
              type="button"
              className="notice-row notice-row-full"
              key={item.key}
              onClick={() => setSelected(item)}
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
            </button>
          ))}
        </div>
      </main>

      {selected && <NoticeDetailModal item={selected} onClose={() => setSelected(null)} />}

      <SiteFooter />
      <BackToTop />
    </div>
  );
}
