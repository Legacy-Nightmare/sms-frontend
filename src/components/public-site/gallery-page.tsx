import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { BackToTop, SiteFooter, SiteHeader, SubpageHero } from "@/components/public-site/site-chrome";
import { resolvePublicAssetUrl } from "@/lib/public-api";
import { fetchPublicSite, type GalleryPhotoDto } from "@/lib/public-site-api";

function Lightbox({ photo, onClose }: { photo: GalleryPhotoDto; onClose: () => void }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="notice-modal-overlay lightbox-overlay" onClick={onClose}>
      <div className="lightbox-frame" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="notice-modal-close lightbox-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
        <img src={resolvePublicAssetUrl(photo.imageUrl)} alt={photo.caption ?? ""} />
        {photo.caption && <p className="lightbox-caption">{photo.caption}</p>}
      </div>
    </div>
  );
}

export function GalleryPage() {
  const site = useQuery({ queryKey: ["public-site"], queryFn: fetchPublicSite });
  const gallery = site.data?.gallery ?? [];
  const [active, setActive] = useState<GalleryPhotoDto | null>(null);

  return (
    <div className="school-site">
      <SiteHeader />
      <SubpageHero title="Photo Gallery" tagline="Moments from campus life — events, classrooms, sports day, and more." />

      <main className="school-container subpage-main">
        {site.isLoading && <p className="empty-search">Loading photos…</p>}
        {!site.isLoading && gallery.length === 0 && (
          <p className="empty-search">No photos published yet — check back soon.</p>
        )}
        {gallery.length > 0 && (
          <div className="gallery-grid gallery-grid-full">
            {gallery.map((photo) => (
              <button
                type="button"
                className="gallery-item gallery-item-button"
                key={photo.id}
                onClick={() => setActive(photo)}
                aria-label={photo.caption ? `View photo: ${photo.caption}` : "View photo"}
              >
                <img src={resolvePublicAssetUrl(photo.imageUrl)} alt={photo.caption ?? ""} loading="lazy" />
              </button>
            ))}
          </div>
        )}
      </main>

      {active && <Lightbox photo={active} onClose={() => setActive(null)} />}

      <SiteFooter />
      <BackToTop />
    </div>
  );
}
