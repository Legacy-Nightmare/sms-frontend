import { createFileRoute } from "@tanstack/react-router";
import publicSiteCss from "../styles/public-site.css?url";
import { AboutPage } from "@/components/public-site/about-page";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Us — Agradoot Preparatory and High School" },
      {
        name: "description",
        content: "Our story, culture and values, quality of education, games, and extra-curricular activities.",
      },
    ],
    links: [{ rel: "stylesheet", href: publicSiteCss }],
  }),
  component: AboutPage,
});
