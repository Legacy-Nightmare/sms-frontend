import { useQuery } from "@tanstack/react-query";
import { Clock3, Mail, MapPin, Navigation, Phone } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { BackToTop, SiteFooter, SiteHeader, SubpageHero } from "@/components/public-site/site-chrome";
import { fetchPublicSite } from "@/lib/public-site-api";

export function ContactPage() {
  const site = useQuery({ queryKey: ["public-site"], queryFn: fetchPublicSite });
  const profile = site.data?.profile;
  const schoolName = profile?.schoolName ?? "Agradoot Preparatory and High School";
  const contactEmail = profile?.email || "info@aphs.edu.bd";

  return (
    <div className="school-site">
      <SiteHeader />
      <SubpageHero title="Contact Us" tagline={`We'd love to hear from you — reach ${schoolName} directly.`} />

      <main className="school-container subpage-main">
        <div className="contact-grid">
          <div className="subpage-card contact-card">
            <h2 className="contact-card-heading"><MapPin size={18} />Visit Us</h2>
            <p className="contact-card-text">{profile?.address || "Address coming soon"}</p>
            {profile?.mapUrl && (
              <a className="location-directions-link" href={profile.mapUrl} target="_blank" rel="noreferrer">
                <Navigation size={14} />Get Directions
              </a>
            )}
            <Link className="location-directions-link" to="/location">
              <MapPin size={14} />See all campus locations
            </Link>
          </div>

          <div className="subpage-card contact-card">
            <h2 className="contact-card-heading"><Phone size={18} />Call or Email</h2>
            <a className="contact-card-link" href={`mailto:${contactEmail}`}><Mail size={15} />{contactEmail}</a>
            {profile?.phone && (
              <a className="contact-card-link" href={`tel:${profile.phone}`}><Phone size={15} />{profile.phone}</a>
            )}
            <p className="contact-card-text" style={{ marginTop: 10 }}>
              For admission queries, see the <Link to="/admission">Admissions</Link> page. For results,
              see the <Link to="/results">Results</Link> page.
            </p>
          </div>

          <div className="subpage-card contact-card">
            <h2 className="contact-card-heading"><Clock3 size={18} />Office Hours</h2>
            <p className="contact-card-text">Sunday – Thursday: 8:00 AM – 2:00 PM</p>
            <p className="contact-card-text">Friday &amp; Saturday: Closed</p>
          </div>

          <div className="subpage-card contact-card">
            <h2 className="contact-card-heading">Follow Us</h2>
            <div className="social-links" aria-label="Social media">
              <a href={profile?.facebookUrl || "https://www.facebook.com/"} aria-label="Facebook" target="_blank" rel="noreferrer">f</a>
              <a href={profile?.youtubeUrl || "https://www.youtube.com/"} aria-label="YouTube" target="_blank" rel="noreferrer">▶</a>
              <a href={profile?.linkedinUrl || "https://www.linkedin.com/"} aria-label="LinkedIn" target="_blank" rel="noreferrer">in</a>
              <a href={profile?.xUrl || "https://x.com/"} aria-label="X" target="_blank" rel="noreferrer">t</a>
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
      <BackToTop />
    </div>
  );
}
