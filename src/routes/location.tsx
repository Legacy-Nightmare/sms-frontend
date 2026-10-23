import { createFileRoute } from "@tanstack/react-router";
import publicSiteCss from "../styles/public-site.css?url";
import { LocationPage } from "@/components/public-site/location-page";

export const Route = createFileRoute("/location")({
  head: () => ({
    meta: [
      { title: "Campus Location — Agradoot Preparatory and High School" },
      { name: "description", content: "Our main campus and institutions, with directions." },
    ],
    links: [{ rel: "stylesheet", href: publicSiteCss }],
  }),
  component: LocationPage,
});
