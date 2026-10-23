import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Mail, Phone, ShieldAlert, Trophy } from "lucide-react";
import { BackToTop, SiteFooter, SiteHeader, SubpageHero } from "@/components/public-site/site-chrome";
import { fetchPublicResultsAnnouncements, fetchPublicSite } from "@/lib/public-site-api";

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { month: "long", day: "2-digit", year: "numeric" }).format(
    new Date(iso),
  );
}

export function ResultsPage() {
  const results = useQuery({
    queryKey: ["public-results-announcements"],
    queryFn: fetchPublicResultsAnnouncements,
  });
  const site = useQuery({ queryKey: ["public-site"], queryFn: fetchPublicSite });
  const profile = site.data?.profile;
  const contactEmail = profile?.email || "info@aphs.edu.bd";
  const contactPhone = profile?.phone;

  const announcements = [...(results.data ?? [])].sort((a, b) =>
    a.resultsAnnouncedAt < b.resultsAnnouncedAt ? 1 : -1,
  );

  return (
    <div className="school-site">
      <SiteHeader />
      <SubpageHero title="Exam Results" tagline="Published results are announced here as soon as they're finalized by the examination committee." />

      <main className="school-container subpage-main">
        <section className="subpage-card admission-contact-cta results-notice">
          <ShieldAlert size={22} className="results-notice-icon" />
          <div>
            <strong>Individual marks are not published online</strong>
            <p>
              To protect student privacy, only the fact that a result has been published is shown here.
              To know your child's marks or grade, please contact their class teacher or the examination
              coordinator at school.
            </p>
            <div className="admission-contact-links">
              <a href={`mailto:${contactEmail}`}><Mail size={15} />{contactEmail}</a>
              {contactPhone && <a href={`tel:${contactPhone}`}><Phone size={15} />{contactPhone}</a>}
            </div>
          </div>
        </section>

        <section className="subpage-section">
          <div className="subpage-card notices-page-list">
            {results.isLoading && <p className="empty-search">Loading results…</p>}
            {!results.isLoading && announcements.length === 0 && (
              <p className="empty-search">No results have been published yet. Please check back soon.</p>
            )}
            {announcements.map((exam) => (
              <div className="notice-row notice-row-full results-row" key={exam.id}>
                <span className="notice-icon notice-icon-amber">
                  <Trophy size={17} />
                </span>
                <span className="notice-copy">
                  <span className="notice-title">
                    {exam.classEntity.name} — {exam.name}
                    <span className="notice-class-pill">{exam.type === "final" ? "Final" : "Tutorial"}</span>
                  </span>
                  <span className="notice-body-preview">
                    {exam.academicYear ? `Academic year ${exam.academicYear}` : "Result published"}
                  </span>
                  <span className="notice-date">
                    <CalendarDays size={12} style={{ display: "inline", marginRight: 4, verticalAlign: -2 }} />
                    Published {formatDate(exam.resultsAnnouncedAt)}
                  </span>
                </span>
                <span className="results-published-pill">Published</span>
              </div>
            ))}
          </div>
        </section>
      </main>

      <SiteFooter />
      <BackToTop />
    </div>
  );
}
