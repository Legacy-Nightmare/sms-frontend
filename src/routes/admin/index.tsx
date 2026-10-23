import { createFileRoute } from "@tanstack/react-router";
import adminCss from "../../styles/admin.css?url";
import { SchoolApp } from "@/components/school-app";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [{ title: "APHS — School Management" }],
    links: [{ rel: "stylesheet", href: adminCss }],
  }),
  component: SchoolApp,
});
