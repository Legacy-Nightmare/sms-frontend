import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Bell,
  BookMarked,
  BookOpen,
  CalendarCheck,
  DoorOpen,
  Globe,
  GraduationCap,
  KeyRound,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Users,
  UserCog,
  Wallet,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ApiError } from "@/lib/api";
import { changePassword, useAuth } from "@/lib/auth";
import { canAccessPage, type Page } from "@/lib/permissions";

export type { Page };

const navItems: Array<{ id: Page; label: string; icon: typeof LayoutDashboard; group: string }> = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, group: "OVERVIEW" },
  { id: "students", label: "Students", icon: Users, group: "ACADEMICS" },
  { id: "teachers", label: "Teachers", icon: UserCog, group: "ACADEMICS" },
  { id: "classes", label: "Classes & sections", icon: GraduationCap, group: "ACADEMICS" },
  { id: "subjects", label: "Subjects", icon: BookMarked, group: "ACADEMICS" },
  { id: "attendance", label: "Attendance", icon: CalendarCheck, group: "ACADEMICS" },
  { id: "exams", label: "Exams & results", icon: BookOpen, group: "ACADEMICS" },
  { id: "notices", label: "Notices", icon: Bell, group: "ACADEMICS" },
  { id: "finance", label: "Finance", icon: Wallet, group: "ADMINISTRATION" },
  { id: "staff", label: "Staff accounts", icon: ShieldCheck, group: "ADMINISTRATION" },
  { id: "website", label: "Website manage", icon: Globe, group: "ADMINISTRATION" },
];

function ChangePasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const reset = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const mutation = useMutation({
    mutationFn: () => changePassword(currentPassword, newPassword),
    onSuccess: () => {
      toast.success("Password changed");
      reset();
      onOpenChange(false);
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Couldn't change password"),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent style={{ maxWidth: 420 }}>
        <DialogHeader>
          <DialogTitle>Change password</DialogTitle>
        </DialogHeader>
        <form
          className="student-form"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            if (newPassword !== confirmPassword) {
              toast.error("New passwords don't match");
              return;
            }
            mutation.mutate();
          }}
        >
          <label>
            Current password
            <input
              required
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </label>
          <label>
            New password
            <input
              required
              type="password"
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </label>
          <label>
            Confirm new password
            <input
              required
              type="password"
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </label>
          <div className="drawer-actions">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving…" : "Change password"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

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
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" aria-label="Account settings">
              <Settings />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setChangePasswordOpen(true)}>
              <KeyRound />
              Change password
            </DropdownMenuItem>
            <DropdownMenuItem onClick={logout}>
              <DoorOpen />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <ChangePasswordDialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen} />
    </aside>
  );
}
