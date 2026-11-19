import { createFileRoute } from "@tanstack/react-router";
import publicSiteCss from "../styles/public-site.css?url";
import { AdmitCardPage } from "@/components/public-site/admit-card-page";

export const Route = createFileRoute("/admit-card")({
  head: () => ({
    meta: [
      { title: "Download Admit Card — Agradoot Preparatory and High School" },
      {
        name: "description",
        content: "Find and download your exam admit card by class, section, and roll number.",
      },
    ],
    links: [{ rel: "stylesheet", href: publicSiteCss }],
  }),
  component: AdmitCardPage,
});
