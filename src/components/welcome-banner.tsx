import { format } from "date-fns";

function greeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function WelcomeBanner({ name }: { name: string }) {
  const now = new Date();

  return (
    <div className="welcome-banner">
      <div className="welcome-blob welcome-blob-1" />
      <div className="welcome-blob welcome-blob-2" />
      <div className="welcome-content">
        <h1>
          <span className="welcome-wave">👋</span> {greeting(now.getHours())}, {name}!
        </h1>
        <p>Here's what's happening at Agradoot Preparatory and High School today — {format(now, "EEEE, d MMMM yyyy")}.</p>
      </div>
      <p className="welcome-tagline">
        Better Education
        <br />
        Brighter Future
      </p>
    </div>
  );
}
