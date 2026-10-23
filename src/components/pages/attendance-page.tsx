import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Badge, DataTable, EmptyRow, PageHeading, Panel } from "@/components/dashboard-ui";
import { StudentAvatar } from "@/components/student-avatar";
import { fetchClasses } from "@/lib/academics-api";
import { fetchClassAttendance } from "@/lib/attendance-api";

export function AttendancePage() {
  const classes = useQuery({ queryKey: ["classes"], queryFn: fetchClasses });
  const [classId, setClassId] = useState<string>("");
  const [sectionId, setSectionId] = useState<string>("");
  const [date, setDate] = useState(() => format(new Date(), "yyyy-MM-dd"));

  useEffect(() => {
    const first = classes.data?.[0];
    if (!classId && first) {
      setClassId(String(first.id));
    }
  }, [classes.data, classId]);

  const selectedClass = classes.data?.find((c) => String(c.id) === classId);
  const sections = selectedClass?.sections ?? [];

  const attendance = useQuery({
    queryKey: ["attendance", classId, sectionId, date],
    queryFn: () =>
      fetchClassAttendance(
        parseInt(classId, 10),
        sectionId ? parseInt(sectionId, 10) : undefined,
        date,
      ),
    enabled: Boolean(classId),
  });

  const presentCount = attendance.data?.filter((r) => r.status === "present").length ?? 0;
  const totalCount = attendance.data?.length ?? 0;
  const sectionLabel = sections.find((s) => String(s.id) === sectionId)?.name ?? "All sections";

  return (
    <>
      <PageHeading
        title="Attendance"
        subtitle="Fed directly from ZKTeco devices — no manual marking"
      />
      <Panel className="filters">
        <label>
          Class
          <select
            value={classId}
            onChange={(e) => {
              setClassId(e.target.value);
              setSectionId("");
            }}
          >
            {classes.data?.map((c) => (
              <option key={c.id} value={c.id}>
                Class {c.level}
              </option>
            ))}
          </select>
        </label>
        <label>
          Section
          <select value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
            <option value="">All sections</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      </Panel>
      <Panel>
        <div className="panel-title">
          <h2>
            {selectedClass ? `Class ${selectedClass.level}` : "Class"} · {sectionLabel} —{" "}
            {format(new Date(date), "d MMMM yyyy")}
          </h2>
          <Badge>
            {presentCount} of {totalCount} present
          </Badge>
        </div>
        <DataTable
          headers={["CODE", "STUDENT", "PUNCH TIME", "DEVICE", "STATUS"]}
          widths=".9fr 1.2fr 1fr 1.1fr .8fr"
        >
          {attendance.isLoading && <EmptyRow colSpan={5}>Loading…</EmptyRow>}
          {attendance.data?.length === 0 && (
            <EmptyRow colSpan={5}>No students in this class/section</EmptyRow>
          )}
          {attendance.data?.map((row) => (
            <tr key={row.studentId}>
              <td className="mono muted-cell">{row.studentCode}</td>
              <td>
                <StudentAvatar name={row.studentName} photoUrl={row.photoUrl} />
                {row.studentName}
              </td>
              <td className="mono strong">
                {row.punchTime ? format(new Date(row.punchTime), "hh:mm a") : "–"}
              </td>
              <td className="mono muted-cell">{row.deviceSn ?? "–"}</td>
              <td>
                <Badge tone={row.status === "present" ? "green" : "red"}>
                  {row.status === "present" ? "Present" : "Absent"}
                </Badge>
              </td>
            </tr>
          ))}
        </DataTable>
      </Panel>
    </>
  );
}
