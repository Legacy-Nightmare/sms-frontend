import { createFileRoute } from "@tanstack/react-router";
import publicSiteCss from "../styles/public-site.css?url";
import { AdmissionPage } from "@/components/public-site/admission-page";

export const Route = createFileRoute("/admission")({
  head: () => ({
    meta: [
      { title: "Admissions — Agradoot Preparatory and High School" },
      {
        name: "description",
        content: "Admission process, required documents, fee structure, and important dates.",
      },
    ],
    links: [{ rel: "stylesheet", href: publicSiteCss }],
  }),
  component: AdmissionPage,
});
