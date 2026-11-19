import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Download, IdCard, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BackToTop, SiteFooter, SiteHeader, SubpageHero } from "@/components/public-site/site-chrome";
import { getRecaptchaToken } from "@/components/public-site/recaptcha";
import { fetchPublicSite } from "@/lib/public-site-api";
import { PublicApiError } from "@/lib/public-api";
import {
  fetchPublicAdmitCardClasses,
  fetchPublicAdmitCardExams,
  requestPublicAdmitCardDownload,
  type PublicAdmitCardExamDto,
} from "@/lib/public-admit-card-api";
import { downloadAdmitCardPdf, type AdmitCardData } from "@/lib/admit-card-pdf";

type Status = { kind: "error" | "info"; message: string } | null;

export function AdmitCardPage() {
  const site = useQuery({ queryKey: ["public-site"], queryFn: fetchPublicSite });
  const classes = useQuery({ queryKey: ["public-admit-card-classes"], queryFn: fetchPublicAdmitCardClasses });

  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [roll, setRoll] = useState("");
  const [exams, setExams] = useState<PublicAdmitCardExamDto[] | null>(null);
  const [examId, setExamId] = useState("");
  const [finding, setFinding] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  const selectedClass = classes.data?.find((c) => String(c.id) === classId);
  const sections = selectedClass?.sections ?? [];

  const resetBelow = () => {
    setExams(null);
    setExamId("");
    setStatus(null);
  };

  const findExams = async () => {
    setStatus(null);
    if (!classId || !sectionId || !roll) {
      setStatus({ kind: "error", message: "Select a class, section, and roll number first." });
      return;
    }
    setFinding(true);
    try {
      const { exams: found } = await fetchPublicAdmitCardExams({
        classId: parseInt(classId, 10),
        sectionId: parseInt(sectionId, 10),
        roll: parseInt(roll, 10),
      });
      setExams(found);
      setExamId("");
      if (found.length === 0) {
        setStatus({
          kind: "info",
          message:
            "No admit-card-eligible exams were found for these details. Double-check the class, section, and roll number, or contact the school office.",
        });
      }
    } catch {
      setStatus({ kind: "error", message: "Couldn't look up exams right now. Please try again shortly." });
    } finally {
      setFinding(false);
    }
  };

  const handleDownload = async () => {
    setStatus(null);
    if (!examId) {
      setStatus({ kind: "error", message: "Select an exam first." });
      return;
    }
    setDownloading(true);
    try {
      const recaptchaToken = await getRecaptchaToken("download_admit_card");
      if (!recaptchaToken) {
        setStatus({ kind: "error", message: "reCAPTCHA check failed to load. Please try again shortly." });
        return;
      }
      const result = await requestPublicAdmitCardDownload({
        classId: parseInt(classId, 10),
        sectionId: parseInt(sectionId, 10),
        roll: parseInt(roll, 10),
        examId: parseInt(examId, 10),
        recaptchaToken,
      });
      if (!result.eligible || !result.admitCard) {
        setStatus({ kind: "error", message: result.message ?? "This admit card isn't available yet." });
        return;
      }
      const data: AdmitCardData = {
        studentName: result.admitCard.studentName,
        studentCode: result.admitCard.studentCode,
        roll: result.admitCard.roll,
        className: result.admitCard.className,
        sectionName: result.admitCard.sectionName,
        examName: result.admitCard.examName,
      };
      await downloadAdmitCardPdf(data, site.data?.profile.phone, result.admitCard.photoDataUrl);
      setStatus({ kind: "info", message: "Admit card downloaded." });
    } catch (error) {
      setStatus({
        kind: "error",
        message:
          error instanceof PublicApiError
            ? "Please complete the reCAPTCHA check correctly and try again."
            : "Couldn't generate the admit card right now. Please try again shortly.",
      });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="school-site">
      <SiteHeader />
      <SubpageHero
        title="Download Admit Card"
        tagline="Find your exam admit card by class, section, and roll number — no login needed."
      />

      <main className="school-container subpage-main">
        <section className="subpage-section">
          <h2><IdCard size={19} />Find your admit card</h2>
          <div className="subpage-card admit-card-form">
            <div className="admit-form-row">
              <label>
                Class
                <select
                  value={classId}
                  onChange={(e) => {
                    setClassId(e.target.value);
                    setSectionId("");
                    resetBelow();
                  }}
                  disabled={classes.isLoading}
                >
                  <option value="" disabled>
                    {classes.isLoading ? "Loading…" : "Select class"}
                  </option>
                  {classes.data?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Section
                <select
                  value={sectionId}
                  onChange={(e) => {
                    setSectionId(e.target.value);
                    resetBelow();
                  }}
                  disabled={!classId}
                >
                  <option value="" disabled>
                    Select section
                  </option>
                  {sections.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Roll number
                <input
                  type="number"
                  min={1}
                  value={roll}
                  onChange={(e) => {
                    setRoll(e.target.value);
                    resetBelow();
                  }}
                  placeholder="e.g. 12"
                />
              </label>
            </div>

            <Button type="button" variant="outline" onClick={findExams} disabled={finding}>
              <Search size={14} />
              {finding ? "Searching…" : "Find exams"}
            </Button>

            {exams && exams.length > 0 && (
              <>
                <label className="admit-exam-label">
                  Exam
                  <select value={examId} onChange={(e) => { setExamId(e.target.value); setStatus(null); }}>
                    <option value="" disabled>
                      Select exam
                    </option>
                    {exams.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                        {e.academicYear ? ` (${e.academicYear})` : ""}
                      </option>
                    ))}
                  </select>
                </label>

                {examId && (
                  <Button type="button" onClick={handleDownload} disabled={downloading}>
                    <Download size={14} />
                    {downloading ? "Checking…" : "Download Admit Card"}
                  </Button>
                )}
              </>
            )}

            {status && (
              <p className={status.kind === "error" ? "admit-status admit-status-error" : "admit-status admit-status-info"}>
                {status.kind === "error" ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
                {status.message}
              </p>
            )}
          </div>
        </section>
      </main>

      <SiteFooter />
      <BackToTop />
    </div>
  );
}
