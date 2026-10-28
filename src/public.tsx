import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  Menu,
  X,
  Play,
  Loader2,
  Check,
  MoveRight,
} from "lucide-react";
import { Provider, useStore } from "./store";
import { embedUrl, inquirySchema, safeLink } from "./content";
import { configured, demo, submitInquiry } from "./repository";
import type { Block, ContentDoc, Page, Project } from "./types";
function scrollToSection(id: string) {
  if (location.hash !== "#/" && location.hash !== "") {
    location.hash = "/";
    setTimeout(
      () => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }),
      120,
    );
  } else
    document.getElementById(id)?.scrollIntoView({
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
}
function SectionLink({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={`#/?section=${id}`}
      onClick={(e) => {
        e.preventDefault();
        scrollToSection(id);
      }}
    >
      {children}
    </a>
  );
}
function Header() {
  const { settings: s, docs, resolve } = useStore();
  const [menu, setMenu] = useState(false);
  const nav = s.sections.filter((x) => x.visible && x.nav);
  return (
    <header className="site-header">
      <a className="wordmark" href="#/" aria-label={`${s.name} homepage`}>
        {s.logo && resolve(s.logo) ? (
          <img src={resolve(s.logo)} alt="" />
        ) : (
          <b>{s.monogram}</b>
        )}
        <span>{s.name}</span>
      </a>
      <nav
        className={menu ? "public-nav open" : "public-nav"}
        aria-label="Main navigation"
      >
        {nav.map((x) => (
          <span key={x.id} onClick={() => setMenu(false)}>
            <SectionLink id={x.id}>
              <i>00:0{s.sections.findIndex((a) => a.id === x.id) + 1}</i>
              {x.label}
            </SectionLink>
          </span>
        ))}
        {docs
          .filter((d) => d.kind === "page" && (d.data as Page).nav)
          .sort((a, b) => (a.data as Page).order - (b.data as Page).order)
          .map((d) => (
            <a
              key={d.id}
              href={`#/page/${(d.data as Page).slug}`}
              onClick={() => setMenu(false)}
            >
              {(d.data as Page).title}
            </a>
          ))}
      </nav>
      <div className="header-right">
        <SectionLink id="contact">
          <span
            className={`availability-dot ${s.availability ? "" : "unavailable"}`}
          />
          {s.availability ? "Available" : "In the studio"}
        </SectionLink>
        <button
          className="mobile-menu"
          aria-label={menu ? "Close navigation" : "Open navigation"}
          aria-expanded={menu}
          onClick={() => setMenu(!menu)}
        >
          {menu ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
    </header>
  );
}
function Index({
  number,
  label,
  dark = false,
}: {
  number: string;
  label: string;
  dark?: boolean;
}) {
  return (
    <div className={`section-index ${dark ? "on-dark" : ""}`}>
      <span>{number}</span>
      <i />
      {label}
    </div>
  );
}
function Film({
  source,
  poster = "",
  captions = "",
  preview = false,
}: {
  source: string;
  poster?: string;
  captions?: string;
  preview?: boolean;
}) {
  const { resolve } = useStore();
  const [active, setActive] = useState(false);
  const ref = useRef<HTMLVideoElement>(null);
  const embed = embedUrl(source);
  const src = resolve(source);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const pause = () => {
      if (document.hidden) el.pause();
    };
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) el.pause();
        else if (
          preview &&
          !matchMedia("(prefers-reduced-motion: reduce)").matches
        )
          void el.play().catch(() => {});
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    document.addEventListener("visibilitychange", pause);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", pause);
    };
  }, [src, preview, active]);
  if (embed)
    return (
      <div className="film">
        {active ? (
          <iframe
            title="Project video"
            src={embed}
            allow="fullscreen; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <button className="play-cover" onClick={() => setActive(true)}>
            {poster && (
              <img loading="lazy" src={resolve(poster)} alt="Video poster" />
            )}
            <span>
              <Play size={22} />
              Play film
            </span>
          </button>
        )}
      </div>
    );
  if (!src) return null;
  return (
    <video
      ref={ref}
      className={preview ? "preview-film" : "film"}
      src={src}
      poster={resolve(poster)}
      controls={!preview}
      muted={preview}
      loop={preview}
      playsInline
      preload={preview ? "none" : "metadata"}
      crossOrigin="anonymous"
    >
      {captions && (
        <track
          kind="captions"
          src={resolve(captions)}
          srcLang="en"
          label="English"
          default
        />
      )}
      Your browser does not support this video.
    </video>
  );
}
function ProjectCard({
  doc,
  portrait = false,
  index = 0,
}: {
  doc: ContentDoc;
  portrait?: boolean;
  index?: number;
}) {
  const { resolve, srcSet, alt } = useStore();
  const p = doc.data as Project;
  return (
    <a
      className={`project-card ${portrait ? "portrait" : ""}`}
      href={`#/work/${p.slug}`}
    >
      <div className="project-art">
        <img
          src={resolve(p.image)}
          alt={alt(
            p.image,
            p.title +
              (p.client.includes("demo") ? " — demonstration styleframe" : ""),
          )}
          srcSet={srcSet(p.image)}
          sizes={
            portrait
              ? "(max-width: 480px) 90vw, 33vw"
              : "(max-width: 760px) 85vw, 58vw"
          }
          loading="lazy"
          width={portrait ? 600 : 1000}
          height={portrait ? 900 : 660}
          style={{ objectPosition: p.focal }}
        />
        <div className="card-top mono">
          <span>
            {String(index + 1).padStart(2, "0")} / {p.year}
          </span>
          <span className="view-study">
            View case study <ArrowUpRight size={14} />
          </span>
        </div>
        {portrait && (
          <div className="portrait-caption">
            <span className="mono">{p.duration} · LOOP STUDY</span>
            <h3>{p.title}</h3>
            <p className="mono">{p.client}</p>
            <ArrowUpRight size={25} />
          </div>
        )}
      </div>
      {!portrait && (
        <div className="project-caption">
          <div>
            <h3>{p.title}</h3>
            <p className="mono">{p.client}</p>
          </div>
          <div className="mono project-meta">
            <span>{p.category}</span>
            <span>{p.duration}</span>
          </div>
        </div>
      )}
    </a>
  );
}
function Hero() {
  const { settings: s, resolve, srcSet, alt } = useStore();
  const words = s.name.trim().split(/\s+/);
  return (
    <section className="hero" id="top">
      <img
        className="hero-art"
        src={resolve(s.heroImage)}
        alt={alt(
          s.heroImage,
          "Abstract crystalline forms refracting warm orange and cool blue light",
        )}
        srcSet={srcSet(s.heroImage)}
        sizes="100vw"
        fetchPriority="high"
        width="1920"
        height="1080"
      />
      {s.heroVideo && (
        <Film source={s.heroVideo} poster={s.heroImage} preview />
      )}
      <div className="hero-shade" style={{ opacity: s.heroOverlay / 100 }} />
      <div className="hero-inner">
        <div className="hero-meta mono">
          <span>
            {s.heroServices.split("\n").map((line, i) => (
              <span key={i}>
                {line}
                <br />
              </span>
            ))}
          </span>
          <span>
            {s.location}
            <br />
            {s.heroRange}
          </span>
        </div>
        <div className="hero-title">
          <h1>
            {words.length > 1 ? (
              <>
                {words.slice(0, -1).join(" ")}
                <br />
                {words.at(-1)}
              </>
            ) : (
              <>
                {s.name}
                <br />
                <span className="outline-name">in motion.</span>
              </>
            )}
          </h1>
          <span className="hero-number mono">/01</span>
        </div>
        <p className="hero-description">{s.tagline}</p>
        <div className="hero-bottom">
          <div className="mono hero-status">
            <span className="availability-dot" />
            {s.availabilityText}
            <span className="hero-role"> — Independent motion designer</span>
          </div>
          <div className="hero-actions">
            <SectionLink id="work">
              Selected work <ArrowDownIcon />
            </SectionLink>
            <SectionLink id="contact">
              Start a project <ArrowUpRight size={16} />
            </SectionLink>
          </div>
        </div>
      </div>
    </section>
  );
}
function ArrowDownIcon() {
  return <ArrowRight size={15} className="rotate-arrow" />;
}
function Work() {
  const { docs, settings: s } = useStore();
  const ref = useRef<HTMLDivElement>(null);
  const list = docs
    .filter(
      (d) =>
        d.kind === "project" &&
        (d.data as Project).featured &&
        !(d.data as Project).social,
    )
    .sort((a, b) => (a.data as Project).order - (b.data as Project).order);
  return (
    <section className="section work-section" id="work">
      <Index number="00:01" label="Selected work" />
      <div className="section-heading">
        <h2>{s.workTitle}</h2>
        <div>
          <p>{s.workIntro}</p>
          <div className="strip-controls">
            <button
              aria-label="Previous projects"
              onClick={() =>
                ref.current?.scrollBy({ left: -600, behavior: "smooth" })
              }
            >
              <ArrowLeft size={19} />
            </button>
            <button
              aria-label="Next projects"
              onClick={() =>
                ref.current?.scrollBy({ left: 600, behavior: "smooth" })
              }
            >
              <ArrowRight size={19} />
            </button>
          </div>
        </div>
      </div>
      {list.length ? (
        <div
          className="work-strip"
          ref={ref}
          tabIndex={0}
          aria-label="Selected projects; scroll horizontally"
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
              e.preventDefault();
              ref.current?.scrollBy({
                left: e.key === "ArrowRight" ? 400 : -400,
                behavior: "smooth",
              });
            }
          }}
        >
          {list.map((d, i) => (
            <ProjectCard key={d.id} doc={d} index={i} />
          ))}
        </div>
      ) : (
        <div className="content-empty">New work is on its way.</div>
      )}
      <div className="strip-caption mono">
        <span>A selection of moving things</span>
        <span>
          Scroll the strip <MoveRight size={17} />
        </span>
      </div>
    </section>
  );
}
function Social() {
  const { docs, settings: s } = useStore();
  const list = docs
    .filter((d) => d.kind === "project" && (d.data as Project).social)
    .sort((a, b) => (a.data as Project).order - (b.data as Project).order);
  return (
    <section className="section social-section" id="social">
      <Index number="00:02" label="Social-first" />
      <div className="section-heading">
        <h2>{s.socialTitle}</h2>
        <p>{s.socialIntro}</p>
      </div>
      <div className="social-grid">
        {list.map((d, i) => (
          <ProjectCard key={d.id} doc={d} portrait index={i} />
        ))}
      </div>
      {!list.length && (
        <div className="content-empty">A new loop is taking shape.</div>
      )}
    </section>
  );
}
function Studio() {
  const { settings: s, resolve } = useStore();
  return (
    <section className="section studio-section" id="studio">
      <Index number="00:03" label="Studio" />
      <div className="studio-grid">
        <div>
          <h2>{s.studioTitle}</h2>
          {s.portrait && (
            <img
              className="studio-portrait"
              loading="lazy"
              src={resolve(s.portrait)}
              alt={`${s.name} in the studio`}
            />
          )}
        </div>
        <div className="studio-copy">
          {s.bio
            .split("\n")
            .filter(Boolean)
            .map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          <div className="spec-sheet">
            <span className="mono accent">Spec sheet</span>
            <dl>
              {[
                ["Based", s.location],
                ["Practice", s.heroServices.replaceAll("\n", " · ")],
                ["Experience", s.experience],
                ["Tools", s.tools],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="mono">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          {s.clients && (
            <div className="clients">
              <span className="mono">Selected clients</span>
              <p>{s.clients}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
function Capabilities() {
  const { settings: s } = useStore();
  return (
    <section className="section capabilities" id="capabilities">
      <Index number="00:04" label="Capabilities" />
      <div className="service-grid">
        {s.services.map((service, i) => (
          <article key={i}>
            <div className="service-number mono">
              S.{String(i + 1).padStart(2, "0")}
              <ArrowUpRight size={20} />
            </div>
            <h3>{service.title}</h3>
            <p>{service.description}</p>
            <div className="service-tags mono">
              {service.items.split(",").map((t) => (
                <span key={t}>{t.trim()}</span>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
function Contact() {
  const { settings: s, notify } = useStore();
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle"),
    [error, setError] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form)) as Record<
      string,
      string
    >;
    const valid = inquirySchema.safeParse(data);
    if (!valid.success) {
      setError(valid.error.issues[0].message);
      return;
    }
    setState("sending");
    setError("");
    try {
      await submitInquiry(data);
      setState("sent");
      form.reset();
      notify(
        demo
          ? "Brief saved to this browser’s demo inquiries."
          : "Your brief has been sent. Thank you.",
      );
    } catch (e) {
      setError((e as Error).message);
      setState("idle");
    }
  }
  return (
    <section className="section contact-section" id="contact">
      <Index number="00:05" label="Transmission" />
      <div className="contact-grid">
        <div>
          <h2>{s.contactTitle}</h2>
          <a className="contact-email" href={`mailto:${s.email}`}>
            {s.email}
            <ArrowUpRight size={28} />
          </a>
          <p className="mono response-time">
            {s.availabilityText} — {s.responseTime}
          </p>
          <div className="brief-guidance">
            <span className="mono">What to send</span>
            <ul>
              {s.contactGuidance
                .split("\n")
                .filter(Boolean)
                .map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
            </ul>
          </div>
        </div>
        <form onSubmit={submit} className="brief-form">
          <div className="form-pair">
            <label>
              Name
              <input
                name="name"
                autoComplete="name"
                placeholder="Your name"
                required
                minLength={2}
                maxLength={100}
              />
            </label>
            <label>
              Email
              <input
                name="email"
                autoComplete="email"
                type="email"
                placeholder="you@studio.com"
                required
                maxLength={254}
              />
            </label>
          </div>
          <div className="form-pair">
            <label>
              Project type
              <select name="project_type">
                <option>Brand film</option>
                <option>Title sequence</option>
                <option>Social motion</option>
                <option>3D animation</option>
                <option>Something else</option>
              </select>
            </label>
            <label>
              Budget
              <select name="budget">
                <option>To be discussed</option>
                <option>Under $2,500</option>
                <option>$2,500–$5,000</option>
                <option>$5,000–$10,000</option>
                <option>$10,000+</option>
              </select>
            </label>
          </div>
          <label>
            The brief
            <textarea
              name="message"
              rows={5}
              placeholder="Tell me what you have in mind."
              required
              minLength={20}
              maxLength={5000}
            />
          </label>
          <label className="honeypot" aria-hidden="true">
            Leave this empty
            <input name="website" tabIndex={-1} autoComplete="off" />
          </label>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <button className="send-brief" disabled={state === "sending"}>
            {state === "sending" ? (
              <Loader2 className="spin" size={16} />
            ) : state === "sent" ? (
              <Check size={17} />
            ) : null}
            {state === "sending"
              ? "Sending brief"
              : state === "sent"
                ? "Sent · send another"
                : "Send brief"}
            <ArrowUpRight size={17} />
          </button>
          <span className="mono form-footnote">
            {demo
              ? "Demo form · saved on this device"
              : "Or email directly — whatever’s quicker"}
          </span>
        </form>
      </div>
    </section>
  );
}
function Footer() {
  const { settings: s } = useStore();
  return (
    <footer className="site-footer">
      <div className="footer-top">
        <div>
          <a className="footer-name" href="#/">
            {s.name}
            <span className="accent">.</span>
          </a>
          <p>{s.footerText}</p>
          <a className="mono" href={`mailto:${s.email}`}>
            {s.email}
            <ArrowUpRight size={14} />
          </a>
        </div>
        <div>
          <span className="mono footer-label">Index</span>
          {s.sections
            .filter((s) => s.visible)
            .map((s) => (
              <SectionLink key={s.id} id={s.id}>
                {s.label}
              </SectionLink>
            ))}
        </div>
        <div>
          <span className="mono footer-label">Elsewhere</span>
          {s.links.map((link, i) => (
            <a
              key={i}
              href={safeLink(link.url)}
              target="_blank"
              rel="noreferrer"
            >
              {link.label} ↗
            </a>
          ))}
        </div>
        <div>
          <span className="mono footer-label">Colophon</span>
          {s.colophon && (
            <p className="mono">
              Space Grotesk / Inter /<br />
              JetBrains Mono
            </p>
          )}
          <a href="#/admin" className="studio-access mono">
            Studio access <ArrowUpRight size={12} />
          </a>
        </div>
      </div>
      <div className="footer-bottom mono">
        <span>
          © {new Date().getFullYear()} {s.name}. All rights reserved.
        </span>
        <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          Back to 00:00 <ArrowUp size={14} />
        </button>
      </div>
    </footer>
  );
}
function RichText({ text }: { text: string }) {
  return (
    <>
      {text
        .split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g)
        .map((part, i) => {
          if (part.startsWith("**") && part.endsWith("**"))
            return <strong key={i}>{part.slice(2, -2)}</strong>;
          if (part.startsWith("*") && part.endsWith("*"))
            return <em key={i}>{part.slice(1, -1)}</em>;
          if (part.startsWith("`") && part.endsWith("`"))
            return <code key={i}>{part.slice(1, -1)}</code>;
          const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
          if (link) {
            const href = safeLink(link[2]);
            return href === "#" ? (
              link[1]
            ) : (
              <a key={i} href={href} rel="noreferrer">
                {link[1]}
              </a>
            );
          }
          return part;
        })}
    </>
  );
}
export function Blocks({ blocks }: { blocks: Block[] }) {
  const { resolve, docs, settings } = useStore();
  return (
    <div className="content-blocks">
      {blocks.map((b, i) => (
        <div className={`content-block block-${b.type}`} key={b.id}>
          {b.type === "heading" ? (
            <h2>{b.title || b.text}</h2>
          ) : b.type === "text" ? (
            <>
              <Index
                number={String(i + 1).padStart(2, "0")}
                label={b.title || "The process"}
              />
              {b.text.split("\n").map((t, j) => (
                <p key={j}>
                  <RichText text={t} />
                </p>
              ))}
            </>
          ) : b.type === "image" ? (
            <figure>
              {resolve(b.media) && (
                <img
                  loading="lazy"
                  width="1600"
                  height="1000"
                  src={resolve(b.media)}
                  alt={b.text || b.title}
                />
              )}
              <figcaption className="mono">{b.title}</figcaption>
            </figure>
          ) : b.type === "gallery" ? (
            <div className="block-gallery">
              {b.media
                .split("\n")
                .filter(Boolean)
                .map((m, j) => (
                  <img
                    key={j}
                    src={resolve(m)}
                    loading="lazy"
                    alt={`${b.title} ${j + 1}`}
                    width="800"
                    height="600"
                  />
                ))}
            </div>
          ) : b.type === "video" ? (
            <Film source={b.media} poster={b.secondary} />
          ) : b.type === "quote" ? (
            <blockquote>
              {b.text}
              <cite className="mono">{b.title}</cite>
            </blockquote>
          ) : b.type === "spacer" ? (
            <div
              style={{
                height: Math.min(160, Math.max(16, Number(b.text) || 64)),
              }}
            />
          ) : b.type === "cta" ? (
            <a className="public-button" href={safeLink(b.link || "#/")}>
              {b.title || "Get in touch"}
              <ArrowUpRight size={18} />
            </a>
          ) : b.type === "projects" ? (
            <div className="block-projects">
              {docs
                .filter((d) => d.kind === "project")
                .slice(0, 4)
                .map((d) => (
                  <ProjectCard key={d.id} doc={d} />
                ))}
            </div>
          ) : b.type === "services" ? (
            <div className="service-grid">
              {settings.services.map((s) => (
                <article key={s.title}>
                  <h3>{s.title}</h3>
                  <p>{s.description}</p>
                </article>
              ))}
            </div>
          ) : b.type === "comparison" ? (
            <Comparison block={b} />
          ) : null}
        </div>
      ))}
    </div>
  );
}
function Comparison({ block: b }: { block: Block }) {
  const { resolve } = useStore();
  const [position, setPosition] = useState(50);
  return (
    <figure>
      <div className="comparison">
        <img src={resolve(b.secondary || "")} alt="Before" />
        <img
          src={resolve(b.media)}
          alt="After"
          style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
        />
      </div>
      <label className="mono">
        {b.title || "Before / after"}
        <input
          type="range"
          min={0}
          max={100}
          value={position}
          onChange={(e) => setPosition(Number(e.target.value))}
        />
      </label>
    </figure>
  );
}
function CaseStudy({
  doc,
  preview = false,
}: {
  doc: ContentDoc;
  preview?: boolean;
}) {
  const { docs, resolve, srcSet, alt } = useStore();
  const p = doc.data as Project;
  const others = docs.filter((d) => d.kind === "project" && d.id !== doc.id);
  const next =
    others[
      Math.max(
        0,
        docs.findIndex((d) => d.id === doc.id),
      ) % Math.max(1, others.length)
    ];
  return (
    <>
      {preview && (
        <div className="preview-banner">
          Private draft preview{" "}
          <a href={`#/admin/projects/${doc.id}`}>Back to editor ↗</a>
        </div>
      )}
      <section className="case-hero">
        <img
          src={resolve(p.image)}
          alt={alt(p.image, p.title)}
          srcSet={srcSet(p.image)}
          sizes="100vw"
          width="1920"
          height="1080"
        />
        <div />
        <main>
          <a className="mono" href="#/">
            ← All work
          </a>
          <span className="mono">
            {p.category} — {p.client}
          </span>
          <h1>{p.title}</h1>
          <aside className="mono">
            {p.year}
            <br />
            {p.duration}
            <br />
            {p.format}
          </aside>
        </main>
      </section>
      <section className="section case-intro">
        <div>
          <Index number="F.01" label="Synopsis" />
          <p>{p.summary}</p>
        </div>
        <div className="spec-sheet">
          <span className="mono accent">Spec sheet</span>
          <dl>
            {[
              ["Client", p.client],
              ["Year", p.year],
              ["Format", p.format],
              ["Runtime", p.duration],
              ["Role", p.role],
              ["Tools", p.tools],
              ["Deliverables", p.deliverables],
            ]
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k}>
                  <dt className="mono">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
          </dl>
        </div>
      </section>
      {p.video && (
        <div className="section case-film">
          <Film source={p.video} poster={p.image} captions={p.captions} />
        </div>
      )}
      <section className="section case-breakdown">
        <Index number="F.02" label="The breakdown" />
        <h2>How it was built.</h2>
        <Blocks blocks={p.blocks} />
      </section>
      {p.credits && (
        <section className="section credits">
          <Index number="F.03" label="Credit roll" />
          <p>{p.credits}</p>
        </section>
      )}
      {next && (
        <a
          className="next-project section"
          href={`#/work/${(next.data as Project).slug}`}
        >
          <span className="mono">Next case study</span>
          <h2>
            {(next.data as Project).title}
            <ArrowUpRight />
          </h2>
          <span className="mono">
            {(next.data as Project).category} — {(next.data as Project).year}
          </span>
        </a>
      )}
    </>
  );
}
function Draft({ id }: { id: string }) {
  const { docs, role, loading } = useStore();
  if (loading) return <div className="boot">Loading private preview…</div>;
  if (!role)
    return (
      <div className="empty">
        <h1>Sign in to preview.</h1>
        <a href="#/admin">Studio sign-in ↗</a>
      </div>
    );
  const d = docs.find((d) => d.id === id);
  if (!d) return <NotFound />;
  return (
    <>
      {d.kind === "project" ? (
        <CaseStudy doc={d} preview />
      ) : d.kind === "page" ? (
        <>
          <div className="preview-banner">
            Private draft preview{" "}
            <a href={`#/admin/pages/${id}`}>Back to editor ↗</a>
          </div>
          <section className="section custom-page">
            <h1>{(d.data as Page).title}</h1>
            <Blocks blocks={(d.data as Page).blocks} />
          </section>
        </>
      ) : (
        <Home />
      )}
    </>
  );
}
function Home() {
  const { settings: s } = useStore();
  const components: Record<string, React.ReactNode> = {
    work: <Work />,
    social: <Social />,
    studio: <Studio />,
    capabilities: <Capabilities />,
    contact: <Contact />,
  };
  return (
    <>
      <Hero />
      {s.sections
        .filter((x) => x.visible)
        .map((x) => (
          <div key={x.id}>{components[x.id]}</div>
        ))}
    </>
  );
}
function NotFound() {
  return (
    <section className="empty">
      <span className="mono accent">404 / Missing frame</span>
      <h1>
        Let’s take it
        <br />
        from the top.
      </h1>
      <a href="#/" className="public-button">
        Return to the portfolio <ArrowUpRight size={18} />
      </a>
    </section>
  );
}
export default function Public({ route }: { route: string }) {
  const { settings: s, docs, loading, error, resolve } = useStore();
  const path = route.split("?")[0];
  const doc = docs.find(
    (d) =>
      ((path.startsWith("/work/") && d.kind === "project") ||
        (path.startsWith("/page/") && d.kind === "page")) &&
      (d.data as Project).slug === decodeURIComponent(path.split("/")[2] || ""),
  );
  useEffect(() => {
    const isPreview = path.startsWith("/preview/");
    const title = doc
      ? (doc.data as Project).title
      : s.name + " — Motion designer";
    document.title = title;
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute(
        "content",
        doc && doc.kind === "page"
          ? (doc.data as Page).description
          : s.description,
      );
    let robots = document.querySelector('meta[name="robots"]');
    if (!robots) {
      robots = document.createElement("meta");
      robots.setAttribute("name", "robots");
      document.head.appendChild(robots);
    }
    robots.setAttribute(
      "content",
      isPreview ? "noindex,nofollow" : "index,follow",
    );
    if (s.shareImage && resolve(s.shareImage)) {
      let share = document.querySelector('meta[property="og:image"]');
      if (!share) {
        share = document.createElement("meta");
        share.setAttribute("property", "og:image");
        document.head.appendChild(share);
      }
      share.setAttribute("content", resolve(s.shareImage));
    }
    if (s.favicon && resolve(s.favicon))
      document
        .querySelector('link[rel="icon"]')
        ?.setAttribute("href", resolve(s.favicon));
    const q = new URLSearchParams(route.split("?")[1]);
    if (q.get("section"))
      setTimeout(
        () => document.getElementById(q.get("section")!)?.scrollIntoView(),
        100,
      );
  }, [s, doc, route, path, resolve]);
  const style = {
    "--accent": s.accent,
    "--paper": s.background,
    "--display": `'${s.font}', sans-serif`,
    "--section-space": `${Math.min(140, Math.max(60, s.spacing))}px`,
  } as CSSProperties;
  if (loading)
    return (
      <div className="boot">
        Preparing the next frame<span>•</span>
      </div>
    );
  if (error)
    return (
      <main className="empty">
        <h1>The studio is temporarily offline.</h1>
        <p>{error}</p>
        <a href={`mailto:${s.email}`}>{s.email}</a>
      </main>
    );
  if (!configured && !demo)
    return (
      <main className="empty">
        <span className="mono">Setup required</span>
        <h1>
          The next frame
          <br />
          is almost ready.
        </h1>
        <p>
          Connect Supabase using the deployment instructions to publish this
          portfolio.
        </p>
        <a href="#/admin">Open setup ↗</a>
      </main>
    );
  if (s.maintenance && !path.startsWith("/preview/"))
    return (
      <main className="empty">
        <span className="mono accent">In the making</span>
        <h1>
          Something is
          <br />
          moving.
        </h1>
        <p>The studio is updating its portfolio. Come back soon.</p>
        <a href={`mailto:${s.email}`}>{s.email}</a>
        <a href="#/admin">Studio access ↗</a>
      </main>
    );
  return (
    <div className={`public-site ${s.motion ? "" : "no-motion"}`} style={style}>
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Skip to content
      </a>
      <Header />
      <main id="main-content" tabIndex={-1}>
        {path.startsWith("/preview/") ? (
          <Provider admin>
            <Draft id={path.split("/")[2]} />
          </Provider>
        ) : doc ? (
          doc.kind === "project" ? (
            <CaseStudy doc={doc} />
          ) : (
            <section className="section custom-page">
              <Index number="00" label="Studio notes" />
              <h1>{(doc.data as Page).title}</h1>
              <p>{(doc.data as Page).description}</p>
              <Blocks blocks={(doc.data as Page).blocks} />
            </section>
          )
        ) : path === "/" ? (
          <Home />
        ) : (
          <NotFound />
        )}
      </main>
      <Footer />
    </div>
  );
}
