import { useQuery } from "@tanstack/react-query";
import {
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileText,
  Mail,
  Phone,
  Wallet,
} from "lucide-react";
import { BackToTop, SiteFooter, SiteHeader, SubpageHero } from "@/components/public-site/site-chrome";
import { fetchPublicSite } from "@/lib/public-site-api";

const PROCESS_STEPS = [
  { title: "Collect the admission form", text: "Pick up a form from the school office, or download it from the Document Download section if it's been published online." },
  { title: "Submit with required documents", text: "Hand in the completed form along with the documents listed below, within the published submission window." },
  { title: "Assessment / interview", text: "Classes 1 and above sit a short written assessment; Play–KG applicants and their guardians attend an informal interview instead." },
  { title: "Confirm the seat", text: "Pay the admission fee by the deadline to confirm the seat — unpaid seats are released to the waiting list." },
];

const REQUIRED_DOCUMENTS = [
  "Birth certificate (photocopy, original for verification)",
  "Transfer certificate from previous school (for Class 2 and above)",
  "Latest report card / academic transcript (for ongoing students)",
  "2 recent passport-size photographs of the student",
  "Photocopy of guardian's National ID card",
  "Immunization / vaccination card (for Play, Nursery, and KG applicants)",
];

const FEE_TIERS = [
  { tier: "Play / Nursery / KG", admission: "৳3,500", tuition: "৳800 / month", session: "৳2,000 / year" },
  { tier: "Class 1 – 3", admission: "৳4,000", tuition: "৳1,000 / month", session: "৳2,500 / year" },
  { tier: "Class 4 – 6", admission: "৳4,500", tuition: "৳1,200 / month", session: "৳3,000 / year" },
  { tier: "Class 7 – 10", admission: "৳5,000", tuition: "৳1,500 / month", session: "৳3,500 / year" },
];

const IMPORTANT_DATES = [
  { label: "Admission form distribution begins", date: "1 November 2026" },
  { label: "Last date for form submission", date: "15 December 2026" },
  { label: "Assessment / interview", date: "22 December 2026" },
  { label: "Admission result publication", date: "28 December 2026" },
  { label: "Seat confirmation deadline", date: "10 January 2027" },
  { label: "New academic year begins", date: "1 February 2027" },
];

export function AdmissionPage() {
  const site = useQuery({ queryKey: ["public-site"], queryFn: fetchPublicSite });
  const profile = site.data?.profile;
  const contactEmail = profile?.email || "info@aphs.edu.bd";
  const contactPhone = profile?.phone;

  return (
    <div className="school-site">
      <SiteHeader />
      <SubpageHero
        title="Admissions"
        tagline="Join the family — here's how admission works, what you'll need, and what it costs."
      />

      <main className="school-container subpage-main">
        <section className="subpage-section">
          <h2><ClipboardList size={19} />Admission Process</h2>
          <ol className="admission-steps">
            {PROCESS_STEPS.map((step, index) => (
              <li key={step.title} className="admission-step">
                <span className="admission-step-number">{index + 1}</span>
                <div>
                  <strong>{step.title}</strong>
                  <p>{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="subpage-section">
          <h2><FileText size={19} />Required Documents</h2>
          <div className="subpage-card">
            <ul className="about-activity-list">
              {REQUIRED_DOCUMENTS.map((doc) => (
                <li key={doc}><CheckCircle2 size={15} />{doc}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="subpage-section">
          <h2><Wallet size={19} />Fee Structure</h2>
          <div className="subpage-card" style={{ overflowX: "auto" }}>
            <table className="fee-table">
              <thead>
                <tr>
                  <th>Class</th>
                  <th>Admission Fee</th>
                  <th>Tuition Fee</th>
                  <th>Session Fee</th>
                </tr>
              </thead>
              <tbody>
                {FEE_TIERS.map((row) => (
                  <tr key={row.tier}>
                    <td>{row.tier}</td>
                    <td>{row.admission}</td>
                    <td>{row.tuition}</td>
                    <td>{row.session}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="fee-table-note">
              Fees are reviewed annually by the school committee. Please contact the admission office
              for the fee structure currently in effect before making any payment.
            </p>
          </div>
        </section>

        <section className="subpage-section">
          <h2><CalendarClock size={19} />Important Dates</h2>
          <ol className="timeline">
            {IMPORTANT_DATES.map((item) => (
              <li key={item.label} className="timeline-item">
                <span className="timeline-dot" />
                <div>
                  <strong>{item.label}</strong>
                  <span className="timeline-date">{item.date}</span>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="subpage-card admission-contact-cta">
          <div>
            <strong>Have a question about admissions?</strong>
            <p>Our admission office is happy to help with eligibility, fees, or document requirements.</p>
          </div>
          <div className="admission-contact-links">
            <a href={`mailto:${contactEmail}`}><Mail size={15} />{contactEmail}</a>
            {contactPhone && <a href={`tel:${contactPhone}`}><Phone size={15} />{contactPhone}</a>}
          </div>
        </section>
      </main>

      <SiteFooter />
      <BackToTop />
    </div>
  );
}
