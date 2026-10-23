import { useQuery } from "@tanstack/react-query";
import { Building2, GraduationCap, MapPin, Navigation, Phone } from "lucide-react";
import { BackToTop, SiteFooter, SiteHeader, SubpageHero } from "@/components/public-site/site-chrome";
import { fetchPublicSite } from "@/lib/public-site-api";

const INSTITUTION_TONES = new Set(["blue", "pink", "green", "ice"]);

export function LocationPage() {
  const site = useQuery({ queryKey: ["public-site"], queryFn: fetchPublicSite });
  const profile = site.data?.profile;
  const institutions = site.data?.institutions ?? [];
  const schoolName = profile?.schoolName ?? "Agradoot Preparatory and High School";

  return (
    <div className="school-site">
      <SiteHeader />
      <SubpageHero title="Campus &amp; Location" tagline="Find our main campus and the institutions that make up the school." />

      <main className="school-container subpage-main">
        <section className="subpage-section">
          <h2><Building2 size={19} />Main Campus</h2>
          <div className="location-grid">
            <div className="location-card location-card-main">
              <span className="location-card-icon"><MapPin size={26} /></span>
              <strong>{schoolName}</strong>
              <p className="location-card-address">{profile?.address || "Address coming soon"}</p>
              {profile?.phone && (
                <p className="location-card-detail"><Phone size={14} />{profile.phone}</p>
              )}
              {profile?.mapUrl && (
                <a className="location-directions-link" href={profile.mapUrl} target="_blank" rel="noreferrer">
                  <Navigation size={14} />Get Directions
                </a>
              )}
            </div>
          </div>
        </section>

        {institutions.length > 0 && (
          <section className="subpage-section">
            <h2><GraduationCap size={19} />Our Institutions</h2>
            <div className="location-grid">
              {institutions.map((institution) => (
                <div
                  className={`location-card location-institution-${INSTITUTION_TONES.has(institution.tone) ? institution.tone : "blue"}`}
                  key={institution.id}
                >
                  <span className="location-card-icon"><GraduationCap size={24} /></span>
                  <strong>{institution.name}</strong>
                  {institution.caption && <p className="location-card-address">{institution.caption}</p>}
                  <p className="location-card-detail"><MapPin size={14} />Same campus as {schoolName}</p>
                  {profile?.mapUrl && (
                    <a className="location-directions-link" href={profile.mapUrl} target="_blank" rel="noreferrer">
                      <Navigation size={14} />Get Directions
                    </a>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <SiteFooter />
      <BackToTop />
    </div>
  );
}
