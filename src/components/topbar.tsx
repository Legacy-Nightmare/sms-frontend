import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Bell, CalendarDays } from "lucide-react";
import { fetchDashboardSummary } from "@/lib/dashboard-api";

export function Topbar() {
  const [now, setNow] = useState(() => new Date());
  const summary = useQuery({ queryKey: ["dashboard-summary"], queryFn: fetchDashboardSummary });
  const alertCount = summary.data?.unpublishedExams.length ?? 0;

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="topbar">
      <p className="topbar-schoolname">Agradoot Preparatory and High School</p>
      <div className="topbar-actions">
        <button type="button" className="topbar-icon-button" aria-label="Notifications">
          <Bell />
          {alertCount > 0 && <span className="topbar-badge">{alertCount}</span>}
        </button>
        <div className="topbar-clock">
          <CalendarDays />
          <div>
            <strong>{format(now, "EEE, d MMM yyyy")}</strong>
            <small>{format(now, "h:mm a")}</small>
          </div>
        </div>
      </div>
    </div>
  );
}
