import { createFileRoute } from "@tanstack/react-router";
import publicSiteCss from "../styles/public-site.css?url";
import { ContactPage } from "@/components/public-site/contact-page";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact Us — Agradoot Preparatory and High School" },
      { name: "description", content: "Address, phone, email, and office hours." },
    ],
    links: [{ rel: "stylesheet", href: publicSiteCss }],
  }),
  component: ContactPage,
});
