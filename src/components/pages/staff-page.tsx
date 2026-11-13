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
  setStaffActive,
  updateStaffRole,
  type StaffDto,
  type StaffRole,
} from "@/lib/staff-api";
import { fetchTeachers } from "@/lib/teachers-api";
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
  const [teacherId, setTeacherId] = useState("");

  const teachers = useQuery({ queryKey: ["teachers"], queryFn: fetchTeachers, enabled: open });

  const mutation = useMutation({
    mutationFn: () =>
      createStaff({
        name,
        email,
        password,
        role,
        teacherId: role === "teacher" && teacherId ? parseInt(teacherId, 10) : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      toast.success(`${name} added as ${role}`);
      setOpen(false);
      setName("");
      setEmail("");
      setPassword("");
      setRole("teacher");
      setTeacherId("");
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
          {role === "teacher" && (
            <label>
              Linked teacher <span className="muted-cell">(optional)</span>
              <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
                <option value="">Not linked yet</option>
                {teachers.data?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <p className="muted-cell" style={{ fontSize: 12, margin: "4px 0 0" }}>
                Determines which classes/subjects this login can enter marks for. Leave unset
                until the roster entry exists, then link it from Edit.
              </p>
            </label>
          )}
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
  const [teacherId, setTeacherId] = useState(staff.teacherId != null ? String(staff.teacherId) : "");
  const [isActive, setIsActive] = useState(staff.isActive);

  const teachers = useQuery({ queryKey: ["teachers"], queryFn: fetchTeachers, enabled: open });

  const mutation = useMutation({
    mutationFn: async () => {
      await updateStaffRole(
        staff.id,
        role,
        role === "teacher" ? (teacherId ? parseInt(teacherId, 10) : null) : undefined,
      );
      if (isActive !== staff.isActive) {
        await setStaffActive(staff.id, isActive);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      toast.success(`${staff.name}'s account updated`);
      setOpen(false);
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Couldn't update account"),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setRole(staff.role);
          setTeacherId(staff.teacherId != null ? String(staff.teacherId) : "");
          setIsActive(staff.isActive);
        }
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
          {role === "teacher" && (
            <label>
              Linked teacher <span className="muted-cell">(optional)</span>
              <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
                <option value="">Not linked</option>
                {teachers.data?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              style={{ width: "auto" }}
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Active (can sign in)
          </label>
          {!isActive && (
            <p className="muted-cell" style={{ fontSize: 12, margin: "-8px 0 0" }}>
              Deactivated — this login will be rejected at sign-in until reactivated.
            </p>
          )}
          <div className="drawer-actions">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving…" : "Save"}
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
        subtitle="Admins have full access · teachers can enter marks for their own assigned classes/subjects · finance officers manage fees, salary, and expenses"
        action={<AddStaffDialog />}
      />
      <Panel>
        <DataTable headers={["NAME", "EMAIL", "ROLE", "STATUS", ""]} widths="1.1fr 1.5fr .6fr .6fr .45fr">
          {staff.isLoading && <EmptyRow colSpan={5}>Loading…</EmptyRow>}
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
                <Badge tone={member.isActive ? "green" : "red"}>
                  {member.isActive ? "Active" : "Inactive"}
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
