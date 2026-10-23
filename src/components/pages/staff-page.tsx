import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge, DataTable, EmptyRow, PageHeading, Panel } from "@/components/dashboard-ui";
import { PasswordInput } from "@/components/password-input";
import {
  createStaff,
  fetchStaff,
  updateStaffRole,
  type StaffDto,
  type StaffRole,
} from "@/lib/staff-api";
import { ApiError } from "@/lib/api";

const avatarTones = ["0", "1", "2"];

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function AddStaffDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<StaffRole>("teacher");

  const mutation = useMutation({
    mutationFn: () => createStaff({ name, email, password, role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      toast.success(`${name} added as ${role}`);
      setOpen(false);
      setName("");
      setEmail("");
      setPassword("");
      setRole("teacher");
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Couldn't add staff account"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)}>
        <Plus />
        Add staff
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add staff account</DialogTitle>
        </DialogHeader>
        <form
          className="student-form"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            mutation.mutate();
          }}
        >
          <label>
            Full name
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Staff member's name"
            />
          </label>
          <label>
            Email
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@school.edu.bd"
            />
          </label>
          <div className="two-fields">
            <label>
              Password
              <PasswordInput
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
            </label>
            <label>
              Role
              <select value={role} onChange={(e) => setRole(e.target.value as StaffRole)}>
                <option value="teacher">Teacher</option>
                <option value="finance">Finance Officer</option>
                <option value="admin">Admin</option>
              </select>
            </label>
          </div>
          <div className="drawer-actions">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving…" : "Save account"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditStaffDialog({ staff }: { staff: StaffDto }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<StaffRole>(staff.role);

  const mutation = useMutation({
    mutationFn: () => updateStaffRole(staff.id, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      toast.success(`${staff.name}'s role updated to ${role}`);
      setOpen(false);
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Couldn't update role"),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setRole(staff.role);
      }}
    >
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Edit
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {staff.name}</DialogTitle>
        </DialogHeader>
        <form
          className="student-form"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            mutation.mutate();
          }}
        >
          <label>
            Email
            <input value={staff.email} disabled />
          </label>
          <label>
            Role
            <select value={role} onChange={(e) => setRole(e.target.value as StaffRole)}>
              <option value="teacher">Teacher</option>
              <option value="finance">Finance Officer</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <div className="drawer-actions">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving…" : "Save role"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function StaffPage() {
  const staff = useQuery({ queryKey: ["staff"], queryFn: fetchStaff });

  return (
    <>
      <PageHeading
        title="Staff accounts"
        subtitle="Admins have full access · teachers can enter marks and post notices · finance officers manage fees, salary, and expenses"
        action={<AddStaffDialog />}
      />
      <Panel>
        <DataTable headers={["NAME", "EMAIL", "ROLE", ""]} widths="1.1fr 1.65fr .65fr .45fr">
          {staff.isLoading && <EmptyRow colSpan={4}>Loading…</EmptyRow>}
          {staff.data?.map((member, i) => (
            <tr key={member.id}>
              <td>
                <span className={`avatar avatar-${avatarTones[i % avatarTones.length]}`}>
                  {initials(member.name)}
                </span>
                {member.name}
              </td>
              <td className="mono muted-cell">{member.email}</td>
              <td>
                <Badge
                  tone={
                    member.role === "admin"
                      ? "amber"
                      : member.role === "finance"
                        ? "purple"
                        : "neutral"
                  }
                >
                  {member.role === "admin"
                    ? "Admin"
                    : member.role === "finance"
                      ? "Finance Officer"
                      : "Teacher"}
                </Badge>
              </td>
              <td>
                <EditStaffDialog staff={member} />
              </td>
            </tr>
          ))}
        </DataTable>
      </Panel>
    </>
  );
}
