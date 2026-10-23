import {
  Bell,
  BookOpen,
  CalendarCheck,
  DoorOpen,
  Globe,
  GraduationCap,
  LayoutDashboard,
  ShieldCheck,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { canAccessPage, type Page } from "@/lib/permissions";

export type { Page };

const navItems: Array<{ id: Page; label: string; icon: typeof LayoutDashboard; group: string }> = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, group: "OVERVIEW" },
  { id: "students", label: "Students", icon: Users, group: "ACADEMICS" },
  { id: "classes", label: "Classes & sections", icon: GraduationCap, group: "ACADEMICS" },
  { id: "attendance", label: "Attendance", icon: CalendarCheck, group: "ACADEMICS" },
  { id: "exams", label: "Exams & results", icon: BookOpen, group: "ACADEMICS" },
  { id: "notices", label: "Notices", icon: Bell, group: "ACADEMICS" },
  { id: "finance", label: "Finance", icon: Wallet, group: "ADMINISTRATION" },
  { id: "staff", label: "Staff accounts", icon: ShieldCheck, group: "ADMINISTRATION" },
  { id: "website", label: "Website manage", icon: Globe, group: "ADMINISTRATION" },
];

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function Sidebar({
  page,
  setPage,
  mobileOpen,
  closeMobile,
}: {
  page: Page;
  setPage: (p: Page) => void;
  mobileOpen: boolean;
  closeMobile: () => void;
}) {
  const { user, logout } = useAuth();
  const visibleItems = navItems.filter((item) => canAccessPage(user?.role, item.id));
  const roleLabel = user?.role === "admin" ? "Admin" : user?.role === "finance" ? "Finance Officer" : "Teacher";
  let previousGroup = "";

  return (
    <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
      <div className="brand">
        <img src="/logo.jpeg" alt="APHS logo" />
        <div>
          <strong>APHS</strong>
          <small>Agradoot Preparatory and High School</small>
        </div>
        <Button className="mobile-close" size="icon" variant="ghost" onClick={closeMobile} aria-label="Close menu">
          <X />
        </Button>
      </div>
      <nav>
        {visibleItems.map((item) => {
          const showGroup = item.group !== previousGroup;
          previousGroup = item.group;
          const Icon = item.icon;
          return (
            <div key={item.id}>
              {showGroup && <p className="nav-group">{item.group}</p>}
              <Button
                variant="ghost"
                onClick={() => {
                  setPage(item.id);
                  closeMobile();
                }}
                className={page === item.id ? "nav-button active" : "nav-button"}
              >
                <Icon />
                <span>{item.label}</span>
              </Button>
            </div>
          );
        })}
      </nav>
      <div className="account">
        <div>
          <span className="avatar avatar-0">{user ? initials(user.name) : "?"}</span>
          <p>
            <strong>{user?.name ?? "—"}</strong>
            <small>{roleLabel}</small>
          </p>
        </div>
        <Button variant="ghost" className="signout" onClick={logout}>
          <DoorOpen />
          Sign out
        </Button>
      </div>
    </aside>
  );
}
