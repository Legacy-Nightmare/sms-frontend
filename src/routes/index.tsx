import { createFileRoute } from "@tanstack/react-router";
import publicSiteCss from "../styles/public-site.css?url";
import { HomePage } from "@/components/public-site/home-page";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Agradoot Preparatory and High School" },
      {
        name: "description",
        content:
          "Agradoot Preparatory and High School — notices, admissions, results, and campus information.",
      },
      { property: "og:title", content: "Agradoot Preparatory and High School" },
      {
        property: "og:description",
        content: "Building a brighter future through quality education and strong values.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "stylesheet", href: publicSiteCss }],
  }),
  component: HomePage,
});
