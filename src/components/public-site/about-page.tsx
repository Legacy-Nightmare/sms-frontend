import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  Award,
  BookOpenCheck,
  Dumbbell,
  Flag,
  GraduationCap,
  HeartHandshake,
  Palette,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BackToTop, SiteFooter, SiteHeader, SubpageHero } from "@/components/public-site/site-chrome";
import { fetchPublicSite } from "@/lib/public-site-api";

const VALUES = [
  { Icon: HeartHandshake, title: "Respect & Discipline", text: "Every student is guided to treat teachers, peers, and staff with courtesy, and to carry that discipline into their studies and daily routine." },
  { Icon: Users, title: "Inclusivity", text: "Children from every background learn side by side in mixed-ability classrooms, with extra support available for anyone who needs it." },
  { Icon: Sparkles, title: "Curiosity First", text: "Lessons are built around questions, not just answers — teachers are trained to reward students for asking, not just reciting." },
  { Icon: Flag, title: "Community Service", text: "Annual blood-donation camps, tree-plantation drives, and neighbourhood clean-up days are part of the school calendar, not an afterthought." },
];

const ACTIVITIES = [
  "Debate & public speaking club",
  "Science & robotics club",
  "Cultural programme (annual day, Pohela Boishakh, Independence Day)",
  "Scouting / Girl Guides",
  "Art, craft & music classes",
  "Educational field trips and study tours",
];

export function AboutPage() {
  const site = useQuery({ queryKey: ["public-site"], queryFn: fetchPublicSite });
  const profile = site.data?.profile;
  const schoolName = profile?.schoolName ?? "Agradoot Preparatory and High School";

  return (
    <div className="school-site">
      <SiteHeader />
      <SubpageHero
        title="About Us"
        tagline={profile?.tagline ?? "Learn, Grow, Build a Better Tomorrow — the story, culture, and people behind our school."}
      />

      <main className="school-container subpage-main">
        <div className="about-layout">
          <div className="subpage-content">
            <section className="subpage-section">
              <h2><BookOpenCheck size={19} />Our Story</h2>
              <div className="subpage-card subpage-prose">
                <p>
                  {profile?.aboutText ||
                    `${schoolName} was established by a group of dedicated local educators and community
                    leaders who believed their neighbourhood deserved a school that took both academic
                    rigor and character-building seriously. What began as a handful of classrooms has
                    grown into a full preparatory-to-secondary institution serving hundreds of families
                    today.`}
                </p>
                <p>
                  From day one, the founding idea has stayed the same: no child should have to choose
                  between a disciplined academic environment and a warm, supportive one. Teachers here
                  are expected to know every student by name, and families are treated as partners in a
                  child's education rather than spectators to it.
                </p>
              </div>
            </section>

            <section className="subpage-section">
              <h2><HeartHandshake size={19} />Our Culture &amp; Values</h2>
              <div className="about-values-grid">
                {VALUES.map(({ Icon, title, text }) => (
                  <div className="about-value-card" key={title}>
                    <span className="about-value-icon"><Icon size={20} /></span>
                    <strong>{title}</strong>
                    <p>{text}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="subpage-section">
              <h2><GraduationCap size={19} />Quality of Education</h2>
              <div className="subpage-card subpage-prose">
                <p>
                  Classes follow the national curriculum, taught by trained, experienced subject
                  teachers in deliberately small sections so every student gets real attention. Progress
                  is tracked through regular class tests and two major examinations each year — tutorial
                  and final — with results combined into a single, transparent report for every family.
                </p>
                <p>
                  Classrooms are equipped with modern teaching aids, a dedicated science lab for
                  practical demonstrations, and a library stocked with both textbooks and storybooks to
                  build a genuine reading habit early.
                </p>
              </div>
            </section>

            <section className="subpage-section">
              <h2><Dumbbell size={19} />Games &amp; Sports</h2>
              <div className="subpage-card subpage-prose">
                <p>
                  Physical education is a scheduled part of every week, not an occasional break from
                  class. Students take part in football, cricket, badminton, and athletics, with an
                  Annual Sports Day that brings the whole school — and plenty of proud parents — onto the
                  field each year.
                </p>
              </div>
            </section>

            <section className="subpage-section">
              <h2><Palette size={19} />Extra-Curricular Activities</h2>
              <div className="subpage-card">
                <ul className="about-activity-list">
                  {ACTIVITIES.map((activity) => (
                    <li key={activity}><Trophy size={15} />{activity}</li>
                  ))}
                </ul>
              </div>
            </section>
          </div>

          <aside className="about-sidebar">
            <div className="subpage-card about-facts-card">
              <h3><Award size={16} />Quick Facts</h3>
              <dl>
                <div><dt>School type</dt><dd>Preparatory &amp; High School</dd></div>
                <div><dt>Medium of instruction</dt><dd>Bangla, with English language</dd></div>
                <div><dt>Classes offered</dt><dd>Play to Class 10</dd></div>
                <div><dt>Campus</dt><dd>{profile?.address || "Details on our Location page"}</dd></div>
              </dl>
            </div>
            <div className="subpage-card about-cta-card">
              <h3>Thinking of joining us?</h3>
              <p>See the admission process, required documents, and fee structure for the upcoming academic year.</p>
              <Button asChild className="hero-button">
                <Link to="/admission">Admissions</Link>
              </Button>
            </div>
          </aside>
        </div>
      </main>

      <SiteFooter />
      <BackToTop />
    </div>
  );
}
