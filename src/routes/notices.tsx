import { createFileRoute } from "@tanstack/react-router";
import publicSiteCss from "../styles/public-site.css?url";
import { NoticesListPage } from "@/components/public-site/notices-list-page";

export const Route = createFileRoute("/notices")({
  validateSearch: (search: Record<string, unknown>): { q?: string | undefined } => ({
    q: typeof search["q"] === "string" ? (search["q"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Notices — Agradoot Preparatory and High School" },
      { name: "description", content: "All notices and result announcements published by the school." },
    ],
    links: [{ rel: "stylesheet", href: publicSiteCss }],
  }),
  component: NoticesRoute,
});

function NoticesRoute() {
  const { q } = Route.useSearch();
  return <NoticesListPage initialQuery={q} />;
}
