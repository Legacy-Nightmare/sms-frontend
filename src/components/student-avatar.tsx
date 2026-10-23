import { studentPhotoUrl } from "@/lib/students-api";

export function StudentAvatar({
  name,
  photoUrl,
  size = "sm",
}: {
  name: string;
  photoUrl: string | null;
  size?: "sm" | "lg";
}) {
  const sizeClass = size === "lg" ? " student-avatar-lg" : "";
  const url = studentPhotoUrl(photoUrl);
  if (url) {
    return <img className={`student-avatar${sizeClass}`} src={url} alt="" />;
  }
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return <span className={`student-avatar-placeholder${sizeClass}`}>{initials || "?"}</span>;
}
