import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import adminCss from "../../styles/admin.css?url";
import { useAuth } from "@/lib/auth";
import { LoginPage } from "@/components/login-page";

export const Route = createFileRoute("/admin/login")({
  head: () => ({
    meta: [{ title: "Sign in — APHS" }],
    links: [{ rel: "stylesheet", href: adminCss }],
  }),
  component: AdminLoginRoute,
});

function AdminLoginRoute() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate({ to: "/admin" });
    }
  }, [loading, user, navigate]);

  if (loading || user) {
    return <div className="app-loading">Loading APHS…</div>;
  }

  return <LoginPage />;
}
