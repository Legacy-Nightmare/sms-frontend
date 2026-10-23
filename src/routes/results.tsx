import { createFileRoute } from "@tanstack/react-router";
import publicSiteCss from "../styles/public-site.css?url";
import { ResultsPage } from "@/components/public-site/results-page";

export const Route = createFileRoute("/results")({
  head: () => ({
    meta: [
      { title: "Results — Agradoot Preparatory and High School" },
      { name: "description", content: "Published exam results. Contact your class teacher for individual marks." },
    ],
    links: [{ rel: "stylesheet", href: publicSiteCss }],
  }),
  component: ResultsPage,
});
