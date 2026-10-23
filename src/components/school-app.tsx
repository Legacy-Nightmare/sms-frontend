import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { Sidebar, type Page } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { AddStudentDrawer } from "@/components/add-student-drawer";
import { canAccessPage, defaultPageFor } from "@/lib/permissions";
import { DashboardPage } from "@/components/pages/dashboard-page";
import { StudentsPage } from "@/components/pages/students-page";
import { ClassesPage } from "@/components/pages/classes-page";
import { AttendancePage } from "@/components/pages/attendance-page";
import { ExamsPage } from "@/components/pages/exams-page";
import { NoticesPage } from "@/components/pages/notices-page";
import { StaffPage } from "@/components/pages/staff-page";
import { FinancePage } from "@/components/pages/finance-page";
import { WebsiteManagePage } from "@/components/pages/website-manage-page";

export function SchoolApp() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [page, setPage] = useState<Page>("dashboard");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Backend guards are the real security boundary (every endpoint checks
  // role independently) — this just keeps a role from landing on, or being
  // left on, a page it has no business viewing. Covers both the initial
  // "dashboard" default for a finance-only user and any stale page state
  // left over from a role change.
  useEffect(() => {
    if (user && !canAccessPage(user.role, page)) {
      setPage(defaultPageFor(user.role));
    }
  }, [user, page]);

  // Login now has its own URL (/admin/login) rather than being rendered
  // inline here, so an unauthenticated visit to /admin redirects there.
  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/admin/login" });
    }
  }, [loading, user, navigate]);

  if (loading || !user) {
    return <div className="app-loading">Loading APHS…</div>;
  }

  if (!canAccessPage(user.role, page)) {
    return <div className="app-loading">Loading APHS…</div>;
  }

  const content: Record<Page, ReactNode> = {
    dashboard: <DashboardPage />,
    students: <StudentsPage onAdd={() => setDrawerOpen(true)} />,
    classes: <ClassesPage />,
    attendance: <AttendancePage />,
    exams: <ExamsPage />,
    notices: <NoticesPage />,
    staff: <StaffPage />,
    finance: <FinancePage />,
    website: <WebsiteManagePage />,
  };

  return (
    <div className="school-shell">
      <Sidebar page={page} setPage={setPage} mobileOpen={mobileOpen} closeMobile={() => setMobileOpen(false)} />
      {mobileOpen && <div className="mobile-backdrop" onClick={() => setMobileOpen(false)} />}
      <main className="main-content">
        <Button className="menu-button" size="icon" variant="outline" onClick={() => setMobileOpen(true)} aria-label="Open menu">
          <Menu />
        </Button>
        <Topbar />
        {content[page]}
      </main>
      <AddStudentDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
    </div>
  );
}
