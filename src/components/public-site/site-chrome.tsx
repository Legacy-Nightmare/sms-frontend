import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  CalendarDays,
  FileText,
  GraduationCap,
  Images,
  Mail,
  MapPin,
  Menu,
  Phone,
  Search,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { resolvePublicAssetUrl } from "@/lib/public-api";
import { fetchPublicSite, type InstitutionDto, type SchoolProfileDto } from "@/lib/public-site-api";

export interface SiteNavItem {
  label: string;
  to: string;
  Icon: LucideIcon;
}

// Real routes now — this used to be a list of in-page #anchors, which is why
// none of these menu items "worked" (they only scrolled the homepage, and
// did nothing at all from any other page). Each entry below has a matching
// file under routes/.
export const SITE_NAV_ITEMS: SiteNavItem[] = [
  { label: "Home", to: "/", Icon: GraduationCap },
  { label: "About Us", to: "/about", Icon: UsersRound },
  { label: "Notices", to: "/notices", Icon: Bell },
  { label: "Admissions", to: "/admission", Icon: GraduationCap },
  { label: "Results", to: "/results", Icon: FileText },
  { label: "Photo Gallery", to: "/gallery", Icon: Images },
  { label: "Campus Location", to: "/location", Icon: MapPin },
  { label: "Contact Us", to: "/contact", Icon: Mail },
];

// Shared by every public page so chrome (branding, nav, footer) stays
// identical no matter which route rendered it. react-query dedupes this
// query key, so mounting both SiteHeader and SiteFooter on the same page
// costs one network request, not two.
function useSiteProfile() {
  return useQuery({ queryKey: ["public-site"], queryFn: fetchPublicSite });
}

// The seeded default (logoUrl: "/logo.jpeg") is a static asset served by the
// frontend itself, not something the backend has — resolving it against the
// API origin would 404. Only a logo an admin actually uploaded through
// Website Manage lives under /uploads/website/logo/... on the backend and
// needs resolvePublicAssetUrl.
function resolveLogoUrl(logoUrl: string | null | undefined) {
  if (logoUrl?.startsWith("/uploads/")) return resolvePublicAssetUrl(logoUrl);
  return logoUrl || "/logo.jpeg";
}

/**
 * The top-strip + masthead + nav. `onSearchSubmit`, when provided, receives
 * the typed term instead of the default behaviour (navigate to /notices
 * with the term as a ?q= search param) — the homepage uses this to keep its
 * existing in-place preview filtering instead of leaving the page.
 */
export function SiteHeader({ onSearchSubmit }: { onSearchSubmit?: (term: string) => void }) {
  const site = useSiteProfile();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [search, setSearch] = useState("");
  const profile = site.data?.profile;

  const today = new Intl.DateTimeFormat("en-GB", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(new Date());
  const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "long" }).format(new Date());

  const schoolName = profile?.schoolName ?? "Agradoot Preparatory and High School";
  const tagline = profile?.tagline ?? "Learn, Grow, Build a Better Tomorrow";
  const logoUrl = resolveLogoUrl(profile?.logoUrl);
  const contactEmail = profile?.email || "info@aphs.edu.bd";

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = search.trim();
    if (onSearchSubmit) {
      onSearchSubmit(term);
      return;
    }
    navigate({ to: "/notices", search: term ? { q: term } : {} });
  }

  return (
    <>
      <div className="top-strip">
        <div className="school-container top-strip-inner">
          <div className="top-date">
            <CalendarDays aria-hidden="true" size={15} />
            <span>{today}</span>
            <span className="top-divider" />
            <span>{weekday}</span>
          </div>
          <div className="top-actions">
            <a href={`mailto:${contactEmail}`}>
              <Phone aria-hidden="true" size={14} />
              <span>Contact school</span>
            </a>
            <a href="/admin/login">
              <UsersRound aria-hidden="true" size={14} />
              <span>Login</span>
            </a>
            <Link to="/contact">
              <Mail aria-hidden="true" size={15} />
              <span>Contact Us</span>
            </Link>
          </div>
        </div>
      </div>

      <header className="masthead">
        <div className="school-container masthead-inner">
          <Link className="site-brand" to="/" aria-label={`${schoolName} home`}>
            <span className="brand-emblem">
              <img src={logoUrl} alt="" width={66} height={66} />
            </span>
            <span className="brand-copy">
              <strong>{schoolName}</strong>
              <span>{tagline}</span>
            </span>
          </Link>
          <form className="site-search" role="search" onSubmit={submitSearch}>
            <label className="sr-only" htmlFor="school-search">
              Search notices and documents
            </label>
            <input
              id="school-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search here..."
            />
            <Button type="submit" className="search-submit" aria-label="Search the website">
              <Search size={19} />
            </Button>
          </form>
        </div>
      </header>

      <nav className="main-nav" aria-label="Main navigation">
        <div className="school-container nav-inner">
          <Button
            variant="outline"
            className="mobile-nav-toggle"
            type="button"
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? "Close navigation" : "Open navigation"}
            onClick={() => setMobileMenuOpen((open) => !open)}
          >
            {mobileMenuOpen ? <X size={19} /> : <Menu size={19} />}
            <span>Menu</span>
          </Button>
          <div className={`nav-links${mobileMenuOpen ? " nav-links-open" : ""}`}>
            {SITE_NAV_ITEMS.map(({ label, to, Icon }) => {
              const isActive = to === "/" ? pathname === "/" : pathname === to;
              return (
                <Link
                  key={label}
                  className={`nav-link${isActive ? " nav-link-home" : ""}`}
                  to={to}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Icon aria-hidden="true" size={17} strokeWidth={2.5} />
                  <span>{label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </>
  );
}

export function SiteFooter() {
  const site = useSiteProfile();
  const profile = site.data?.profile;
  const institutions = site.data?.institutions ?? [];
  const schoolName = profile?.schoolName ?? "Agradoot Preparatory and High School";
  const logoUrl = resolveLogoUrl(profile?.logoUrl);
  const contactEmail = profile?.email || "info@aphs.edu.bd";
  const contactPhone = profile?.phone;

  return (
    <footer className="site-footer">
      <div className="school-container footer-main">
        <div className="footer-about">
          <Link to="/" className="footer-brand">
            <img src={logoUrl} alt="" width={50} height={50} />
            <strong>{schoolName}</strong>
          </Link>
          <p>
            {profile?.aboutText ||
              "We are committed to providing quality education and moral values to build a better tomorrow."}
          </p>
          <div className="social-links" aria-label="Social media">
            <a href={profile?.facebookUrl || "https://www.facebook.com/"} aria-label="Facebook" target="_blank" rel="noreferrer">f</a>
            <a href={profile?.youtubeUrl || "https://www.youtube.com/"} aria-label="YouTube" target="_blank" rel="noreferrer">▶</a>
            <a href={profile?.linkedinUrl || "https://www.linkedin.com/"} aria-label="LinkedIn" target="_blank" rel="noreferrer">in</a>
            <a href={profile?.xUrl || "https://x.com/"} aria-label="X" target="_blank" rel="noreferrer">t</a>
          </div>
        </div>
        <div className="footer-column">
          <h2>Pages</h2>
          {SITE_NAV_ITEMS.filter((item) => item.label !== "Home").map(({ label, to }) => (
            <Link key={label} to={to}>
              <FooterChevron />
              {label}
              <FooterChevron trailing />
            </Link>
          ))}
        </div>
        <div className="footer-column footer-contact">
          <h2>Contact Information</h2>
          <p><MapPin size={15} /><span>{profile?.address || "Address coming soon"}</span></p>
          <a href={`mailto:${contactEmail}`}><Mail size={15} />{contactEmail}</a>
          {contactPhone && <a href={`tel:${contactPhone}`}><Phone size={15} />{contactPhone}</a>}
          {profile?.mapUrl && (
            <a href={profile.mapUrl} target="_blank" rel="noreferrer">
              <MapPin size={15} />Google Maps
            </a>
          )}
          <Link to="/contact"><Mail size={15} />Full contact details</Link>
          <a href="/admin/login"><UsersRound size={15} />Staff &amp; admin login</a>
        </div>
        <div className="footer-column footer-institutions">
          <h2>Our Institutions</h2>
          {(institutions.length > 0 ? institutions : [{ id: 0, name: schoolName } as InstitutionDto]).map((inst) => (
            <Link key={inst.id} to="/location"><GraduationCap size={14} />{inst.name}</Link>
          ))}
        </div>
      </div>
      <div className="footer-bottom">
        <div className="school-container footer-bottom-inner">
          <p>Copyright © {new Date().getFullYear()}. All rights reserved by {schoolName}.</p>
          <div className="footer-follow">
            <span>Follow us</span>
            <div className="social-links social-links-small" aria-label="Follow us">
              <a href={profile?.facebookUrl || "https://www.facebook.com/"} aria-label="Facebook" target="_blank" rel="noreferrer">f</a>
              <a href={profile?.linkedinUrl || "https://www.linkedin.com/"} aria-label="LinkedIn" target="_blank" rel="noreferrer">in</a>
              <a href={profile?.youtubeUrl || "https://www.youtube.com/"} aria-label="YouTube" target="_blank" rel="noreferrer">▶</a>
              <a href={profile?.xUrl || "https://x.com/"} aria-label="X" target="_blank" rel="noreferrer">t</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterChevron({ trailing }: { trailing?: boolean }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      className={trailing ? "footer-trailing" : undefined}
      aria-hidden="true"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

export function BackToTop() {
  return (
    <Button
      className="back-to-top"
      size="icon"
      aria-label="Back to top"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
    >
      <ArrowUpIcon />
    </Button>
  );
}

function ArrowUpIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}

/** Small banner used at the top of every non-home public page. */
export function SubpageHero({
  title,
  tagline,
}: {
  title: string;
  tagline?: string;
}) {
  return (
    <section className="subpage-hero">
      <div className="school-container subpage-hero-inner">
        <nav className="subpage-breadcrumb" aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <span>/</span>
          <span>{title}</span>
        </nav>
        <h1 className="subpage-title">{title}</h1>
        {tagline && <p className="subpage-tagline">{tagline}</p>}
      </div>
    </section>
  );
}

export type { SchoolProfileDto };
