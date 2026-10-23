import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ArrowDownToLine,
  ArrowRight,
  Camera,
  ChevronRight,
  Download,
  FileText,
  GraduationCap,
  Link as LinkIcon,
  ShieldCheck,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import campusImage from "@/assets/campus-hero.jpg";
import { Button } from "@/components/ui/button";
import { BackToTop, SiteFooter, SiteHeader } from "@/components/public-site/site-chrome";
import { resolvePublicAssetUrl } from "@/lib/public-api";
import {
  fetchPublicNotices,
  fetchPublicResultsAnnouncements,
  fetchPublicSite,
} from "@/lib/public-site-api";

interface FeedItem {
  key: string;
  title: string;
  date: string;
  sortKey: string;
  kind: "notice" | "result";
}

const INSTITUTION_TONES = new Set(["blue", "pink", "green", "ice"]);

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { month: "short", day: "2-digit", year: "numeric" }).format(
    new Date(iso),
  );
}

export function HomePage() {
  const [showAllDocuments, setShowAllDocuments] = useState(false);

  const site = useQuery({ queryKey: ["public-site"], queryFn: fetchPublicSite });
  const notices = useQuery({ queryKey: ["public-notices"], queryFn: fetchPublicNotices });
  const results = useQuery({
    queryKey: ["public-results-announcements"],
    queryFn: fetchPublicResultsAnnouncements,
  });

  const feed: FeedItem[] = useMemo(() => {
    const noticeItems: FeedItem[] = (notices.data ?? []).map((n) => ({
      key: `notice-${n.id}`,
      title: n.title,
      date: formatDate(n.publishedToWebsiteAt),
      sortKey: n.publishedToWebsiteAt,
      kind: "notice",
    }));
    const resultItems: FeedItem[] = (results.data ?? []).map((r) => ({
      key: `result-${r.id}`,
      title: `Result Published — ${r.classEntity.name}, ${r.name}`,
      date: formatDate(r.resultsAnnouncedAt),
      sortKey: r.resultsAnnouncedAt,
      kind: "result",
    }));
    return [...noticeItems, ...resultItems].sort((a, b) => (a.sortKey < b.sortKey ? 1 : -1));
  }, [notices.data, results.data]);

  const documents = site.data?.documents ?? [];
  const institutions = site.data?.institutions ?? [];
  const gallery = site.data?.gallery ?? [];
  const profile = site.data?.profile;

  const schoolName = profile?.schoolName ?? "Agradoot Preparatory and High School";
  const tagline = profile?.tagline ?? "Learn, Grow, Build a Better Tomorrow";
  const heroUrl = profile?.heroImageUrl ? resolvePublicAssetUrl(profile.heroImageUrl) : campusImage;

  return (
    <div className="school-site" id="home">
      <SiteHeader />

      <main>
        <section className="hero" aria-label={`Welcome to ${schoolName}`}>
          <img className="hero-photo" src={heroUrl} width={1920} height={768} alt="Students gathering together on their school campus" fetchPriority="high" />
          <div className="hero-tint" />
          <div className="school-container hero-inner">
            <div className="hero-copy">
              <span className="hero-kicker">WELCOME TO</span>
              <h1>Agradoot <span>Preparatory and High School</span></h1>
              <p>Building a brighter future through<br className="desktop-break" /> quality education and strong values.</p>
              <Button asChild className="hero-button">
                <Link to="/about">Learn More <ArrowRight size={18} /></Link>
              </Button>
            </div>
          </div>
          <div className="hero-dots" aria-label="Slide 1 of 3">
            <span className="hero-dot hero-dot-current" /><span className="hero-dot" /><span className="hero-dot" />
          </div>
        </section>

        <section className="school-container info-grid" aria-label="School updates and resources">
          <section className="info-panel notices-panel" id="notices">
            <div className="panel-heading notices-heading">
              <h2><MegaphoneMark />Notice Board</h2>
              <Button asChild variant="ghost" size="sm" className="panel-action">
                <Link to="/notices">View All <ArrowRight size={15} /></Link>
              </Button>
            </div>
            <div className="notice-list">
              {notices.isLoading && <p className="empty-search">Loading notices…</p>}
              {feed.slice(0, 4).map((item) => (
                <NoticeRow key={item.key} item={item} />
              ))}
              {!notices.isLoading && feed.length === 0 && (
                <p className="empty-search">No notices published yet — check back soon.</p>
              )}
            </div>
          </section>

          <section className="info-panel quick-panel" id="quick-links">
            <div className="panel-heading quick-heading"><h2><LinkIcon size={21} strokeWidth={3} />Quick Links</h2></div>
            <div className="quick-grid">
              <QuickCard to="/admission" Icon={GraduationCap} title="Admissions" tone="mint" />
              <QuickCard to="/notices" Icon={ShieldCheck} title="Notices" tone="violet" />
              <QuickCard to="/results" Icon={FileText} title="Results" tone="sky" />
              <QuickCard to="/gallery" Icon={Camera} title="Photo Gallery" tone="peach" />
            </div>
          </section>

          <section className="info-panel documents-panel" id="documents">
            <div className="panel-heading documents-heading">
              <h2><span className="download-badge"><ArrowDownToLine size={19} /></span>Document Download</h2>
              <Button variant="ghost" size="sm" className="panel-action" onClick={() => setShowAllDocuments((show) => !show)}>
                {showAllDocuments ? "Show Less" : "View All"} <ArrowRight size={15} />
              </Button>
            </div>
            <div className="document-list">
              {site.isLoading && <p className="empty-search">Loading documents…</p>}
              {(showAllDocuments ? documents : documents.slice(0, 4)).map((doc) => (
                <a
                  className="document-row"
                  key={doc.id}
                  href={resolvePublicAssetUrl(doc.fileUrl)}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Download ${doc.title}`}
                >
                  <span className="pdf-symbol"><FileText size={22} /></span>
                  <span className="document-copy"><span>{doc.title}</span><small>PDF</small></span>
                  <Download size={17} className="document-download" />
                </a>
              ))}
              {!site.isLoading && documents.length === 0 && (
                <p className="empty-search">No documents published yet.</p>
              )}
            </div>
          </section>
        </section>

        <section className="school-container gallery-section" id="gallery" aria-label="Photo gallery">
          <div className="panel-heading" style={{ padding: 0 }}>
            <h2 className="gallery-heading"><Camera size={19} />Photo Gallery</h2>
            <Button asChild variant="ghost" size="sm" className="panel-action">
              <Link to="/gallery">View All <ArrowRight size={15} /></Link>
            </Button>
          </div>
          {gallery.length > 0 ? (
            <div className="gallery-grid">
              {gallery.slice(0, 8).map((photo) => (
                <div className="gallery-item" key={photo.id}>
                  <img src={resolvePublicAssetUrl(photo.imageUrl)} alt={photo.caption ?? ""} loading="lazy" />
                </div>
              ))}
            </div>
          ) : (
            !site.isLoading && <p className="empty-search">No photos published yet — check back soon.</p>
          )}
        </section>

        <section className="school-container institutions" id="institutions" aria-label="Our institutions">
          {institutions.length === 0 && !site.isLoading && (
            <Institution Icon={GraduationCap} name={schoolName} caption={tagline} tone="blue" />
          )}
          {institutions.map((institution) => (
            <Institution
              key={institution.id}
              Icon={GraduationCap}
              name={institution.name}
              caption={institution.caption ?? ""}
              tone={INSTITUTION_TONES.has(institution.tone) ? institution.tone : "blue"}
            />
          ))}
        </section>
      </main>

      <SiteFooter />
      <BackToTop />
    </div>
  );
}

function NoticeRow({ item }: { item: FeedItem }) {
  return (
    <Link className="notice-row" to={item.kind === "result" ? "/results" : "/notices"}>
      <span className={`notice-icon ${item.kind === "result" ? "notice-icon-amber" : "notice-icon-sky"}`}>
        {item.kind === "result" ? <Trophy size={17} /> : <FileText size={17} />}
      </span>
      <span className="notice-copy">
        <span className="notice-title">{item.title}</span>
        <span className="notice-date">{item.date}</span>
      </span>
      <ChevronRight className="notice-chevron" size={17} />
    </Link>
  );
}

function QuickCard({ to, Icon, title, tone }: { to: string; Icon: LucideIcon; title: React.ReactNode; tone: string }) {
  return (
    <Link className={`quick-card quick-${tone}`} to={to}>
      <span className="quick-icon"><Icon size={23} fill="currentColor" /></span>
      <strong>{title}</strong>
      <ArrowRight className="quick-arrow" size={16} />
    </Link>
  );
}

function Institution({ Icon, name, caption, tone }: { Icon: LucideIcon; name: string; caption: string; tone: string }) {
  return (
    <Link className={`institution institution-${tone}`} to="/location">
      <span className="institution-mark"><Icon size={32} strokeWidth={2} /></span>
      <span className="institution-copy"><strong>{name}</strong>{caption && <small>{caption}</small>}</span>
      <span className="institution-arrow"><ArrowRight size={16} /></span>
    </Link>
  );
}

function MegaphoneMark() {
  return <span className="megaphone-mark"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M3 11v2a2 2 0 0 0 2 2h2l2 5h3l-2-6 9 3V5l-9 3H5a2 2 0 0 0-2 3Z" fill="currentColor"/><path d="M18 8.5a5 5 0 0 1 0 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg></span>;
}
