import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { BookOpen, CalendarCheck, GraduationCap, Megaphone, Users } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { fetchDashboardSummary, fetchAttendanceTrend } from "@/lib/dashboard-api";
import { fetchRecentAttendance } from "@/lib/attendance-api";
import { fetchNotices } from "@/lib/notices-api";
import { fetchClasses } from "@/lib/academics-api";
import { WelcomeBanner } from "@/components/welcome-banner";
import { Badge, DataTable, EmptyRow, Panel } from "@/components/dashboard-ui";

const DONUT_COLORS = ["var(--teal)", "var(--blue)", "var(--purple)", "var(--orange)", "var(--pink)", "var(--lime)"];

function Sparkline({ data, color }: { data: Array<{ v: number }>; color: string }) {
  return (
    <div className="stat-spark">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id={`spark-${color}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.45} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.8} fill={`url(#spark-${color})`} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const summary = useQuery({ queryKey: ["dashboard-summary"], queryFn: fetchDashboardSummary });
  const trend = useQuery({ queryKey: ["attendance-trend"], queryFn: fetchAttendanceTrend });
  const recent = useQuery({
    queryKey: ["attendance-recent"],
    queryFn: () => fetchRecentAttendance(6),
  });
  const notices = useQuery({ queryKey: ["notices"], queryFn: fetchNotices });
  const classes = useQuery({ queryKey: ["classes"], queryFn: fetchClasses });

  const firstName = user?.name?.split(" ")[0] ?? "there";

  const totalStudents = summary.data?.totalStudents ?? 0;
  const presentToday = summary.data?.presentToday ?? 0;
  const presentPct = totalStudents > 0 ? ((presentToday / totalStudents) * 100).toFixed(1) : "0.0";
  const unpublishedExams = summary.data?.unpublishedExams ?? [];
  const unpublishedCount = unpublishedExams.length;

  const presentSpark = (trend.data ?? []).map((d) => ({ v: d.present }));

  const draftNotices = (notices.data ?? []).filter((n) => !n.publishedAt);
  const publishedNotices = (notices.data ?? [])
    .filter((n) => n.publishedAt)
    .sort((a, b) => new Date(b.publishedAt!).getTime() - new Date(a.publishedAt!).getTime());

  const classDistribution = (classes.data ?? []).map((c, i) => ({
    name: c.name,
    value: c.studentCount,
    color: DONUT_COLORS[i % DONUT_COLORS.length],
  }));
  const classTotal = classDistribution.reduce((sum, c) => sum + c.value, 0);

  return (
    <>
      <WelcomeBanner name={firstName} />

      <div className="stat-grid">
        <Panel className="stat stat-mint">
          <div className="stat-top">
            <span className="stat-icon stat-icon-teal">
              <Users />
            </span>
          </div>
          <strong>{totalStudents}</strong>
          <span>Total Students</span>
          <small>
            Across {summary.data?.totalClasses ?? 0} classes, {summary.data?.totalSections ?? 0} sections
          </small>
        </Panel>
        <Panel className="stat stat-orange">
          <div className="stat-top">
            <span className="stat-icon stat-icon-orange">
              <CalendarCheck />
            </span>
            <Sparkline data={presentSpark} color="var(--orange)" />
          </div>
          <strong>
            {presentToday}
            <em> / {totalStudents}</em>
          </strong>
          <span>Present Today</span>
          <small className="positive">{presentPct}% attendance</small>
        </Panel>
        <Panel className="stat stat-purple">
          <div className="stat-top">
            <span className="stat-icon stat-icon-purple">
              <GraduationCap />
            </span>
          </div>
          <strong>{summary.data?.totalClasses ?? 0}</strong>
          <span>Classes</span>
          <small>{summary.data?.totalSections ?? 0} sections</small>
        </Panel>
        <Panel className="stat stat-pink">
          <div className="stat-top">
            <span className="stat-icon stat-icon-pink">
              <BookOpen />
            </span>
          </div>
          <strong>{unpublishedCount}</strong>
          <span>Needs Attention</span>
          <small className={unpublishedCount > 0 ? "warning" : "positive"}>
            {unpublishedExams[0] ? `${unpublishedExams[0].className} ${unpublishedExams[0].name} unpublished` : "All caught up"}
          </small>
        </Panel>
      </div>

      <div className="dashboard-grid-3">
        <Panel className="chart-panel">
          <div className="panel-title">
            <h2>Attendance Overview</h2>
            <span className="chart-legend">
              <em style={{ background: "var(--teal)" }} /> Present
              <em style={{ background: "var(--border)" }} /> Absent
            </span>
          </div>
          <div className="attendance-chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend.data ?? []} margin={{ top: 10, right: 16, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="presentFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--teal)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--teal)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Tooltip
                  contentStyle={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                  labelFormatter={(d) => format(new Date(d as string), "d MMM")}
                />
                <Area
                  type="monotone"
                  dataKey="present"
                  stroke="var(--teal)"
                  strokeWidth={2.4}
                  fill="url(#presentFill)"
                  dot={{ r: 3, fill: "var(--teal)", strokeWidth: 0 }}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel className="chart-panel">
          <div className="panel-title">
            <h2>Class-wise Student Distribution</h2>
          </div>
          <div className="donut-wrap">
            <div className="donut-chart">
              {classDistribution.length > 0 && (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={classDistribution}
                      dataKey="value"
                      innerRadius={48}
                      outerRadius={70}
                      paddingAngle={2}
                      isAnimationActive={false}
                    >
                      {classDistribution.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} stroke="none" />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              )}
              <div className="donut-center">
                <strong>{classTotal}</strong>
                <small>Students</small>
              </div>
            </div>
            <ul className="donut-legend">
              {classDistribution.map((entry) => (
                <li key={entry.name}>
                  <span style={{ background: entry.color }} />
                  {entry.name}
                  <b>{entry.value}</b>
                </li>
              ))}
              {classDistribution.length === 0 && <li className="muted-cell">No classes yet</li>}
            </ul>
          </div>
        </Panel>

        <Panel className="chart-panel">
          <div className="panel-title">
            <h2>Upcoming Events &amp; Notices</h2>
          </div>
          <ul className="activity-list">
            {unpublishedExams.map((exam) => (
              <li key={`exam-${exam.id}`}>
                <span className="activity-icon activity-icon-red">
                  <BookOpen />
                </span>
                <div>
                  <strong>
                    {exam.className} {exam.name} unpublished
                  </strong>
                  <small>Results awaiting publish</small>
                </div>
                <Badge tone="red">Exam</Badge>
              </li>
            ))}
            {draftNotices.map((notice) => (
              <li key={`notice-${notice.id}`}>
                <span className="activity-icon activity-icon-purple">
                  <Megaphone />
                </span>
                <div>
                  <strong>{notice.title}</strong>
                  <small>{notice.classEntity ? notice.classEntity.name : "All classes"} · draft</small>
                </div>
                <Badge tone="purple">Notice</Badge>
              </li>
            ))}
            {unpublishedExams.length === 0 && draftNotices.length === 0 && (
              <li className="muted-cell">Nothing pending — all caught up</li>
            )}
          </ul>
        </Panel>
      </div>

      <div className="dashboard-grid">
        <Panel>
          <div className="panel-title">
            <h2>Recent attendance punches</h2>
            <Badge tone="green">Live from device</Badge>
          </div>
          <DataTable headers={["STUDENT", "CLASS", "TIME", "DEVICE"]} widths="1.3fr 1.1fr 1fr 1.2fr">
            {recent.isLoading && <EmptyRow colSpan={4}>Loading…</EmptyRow>}
            {recent.data?.length === 0 && <EmptyRow colSpan={4}>No punches yet today</EmptyRow>}
            {recent.data?.map((row) => (
              <tr key={row.id}>
                <td>{row.studentName}</td>
                <td>
                  <Badge tone={row.sectionName === "MOYUR" ? "teal" : "amber"}>
                    {row.className}-{row.sectionName}
                  </Badge>
                </td>
                <td className="mono strong">{format(new Date(row.punchTime), "hh:mm a")}</td>
                <td className="mono muted-cell">{row.deviceSn}</td>
              </tr>
            ))}
          </DataTable>
        </Panel>
        <Panel>
          <div className="panel-title">
            <h2>Recent notices &amp; activity</h2>
          </div>
          <ul className="activity-list">
            {publishedNotices.slice(0, 5).map((notice) => (
              <li key={notice.id}>
                <span className="activity-icon activity-icon-teal">
                  <Megaphone />
                </span>
                <div>
                  <strong>{notice.title}</strong>
                  <small>{notice.body.slice(0, 60)}</small>
                </div>
                <small className="muted-cell">{formatDistanceToNow(new Date(notice.publishedAt!), { addSuffix: true })}</small>
              </li>
            ))}
            {publishedNotices.length === 0 && <li className="muted-cell">No published notices yet</li>}
          </ul>
        </Panel>
      </div>

      <p className="dashboard-footer-tag">
        Learn <span /> Grow <span /> Build a Better Tomorrow
      </p>
    </>
  );
}
