import { createFileRoute } from "@tanstack/react-router";
import publicSiteCss from "../styles/public-site.css?url";
import { GalleryPage } from "@/components/public-site/gallery-page";

export const Route = createFileRoute("/gallery")({
  head: () => ({
    meta: [
      { title: "Photo Gallery — Agradoot Preparatory and High School" },
      { name: "description", content: "Photos from campus life, events, and activities." },
    ],
    links: [{ rel: "stylesheet", href: publicSiteCss }],
  }),
  component: GalleryPage,
});
