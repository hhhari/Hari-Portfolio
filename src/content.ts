import { z } from "zod";
import type { Block, ContentDoc, Project, Settings } from "./types";
import { personal } from "./personal";
export const uid = () => crypto.randomUUID();
export const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
export const block = (type: Block["type"] = "text"): Block => ({
  id: uid(),
  type,
  title: "",
  text: "",
  media: "",
});
export const asset = (name: string) =>
  `${import.meta.env.BASE_URL}art/${name}.svg`;
export const baseSettings: Settings = {
  title: "Kinetic Showcase",
  name: "Hari",
  monogram: "H",
  logo: "",
  favicon: "",
  email: "hello@example.com",
  location: "Dubai — working worldwide",
  tagline:
    "I turn ideas into movement. Independent motion design for brands, screens, and everything in between.",
  bio: "I’m an independent motion designer exploring the space between design, rhythm, and storytelling. From a first sketch to the final frame, I build visual worlds that move with purpose.\n\nThis is a demonstration portfolio. Replace this introduction and the sample studies with your own practice and work.",
  experience: "Add your experience",
  tools: "After Effects, Cinema 4D, Blender, Figma",
  clients: "Add your selected clients",
  portrait: "",
  heroImage: "art:prism",
  heroVideo: "",
  heroOverlay: 35,
  heroServices: "Brand & advertising\nTitle sequences\nSocial-first loops",
  heroRange: "Selected studies 2024 — 2026",
  availability: true,
  availabilityText: "Open for commissions",
  responseTime: "Replies within two working days",
  workTitle: "Frames that move.",
  workIntro:
    "A selection of moving identities, visual experiments, and stories told one frame at a time.",
  socialTitle: "Built for the feed.",
  socialIntro:
    "Small screens. Lasting impressions. Motion systems made to loop, pause, and play again.",
  studioTitle: "Movement with a reason behind every frame.",
  contactTitle: "Got a frame that needs to move?",
  contactGuidance:
    "A line on the project and what it’s for.\nWhere it lands: broadcast, cinema, social, in-store.\nTimeline and any fixed delivery date.\nBudget range, or the conversation around it.\nReferences you love, and the ones you don’t.",
  footerText:
    "Independent motion designer. Made of curiosity, shaped by rhythm.",
  colophon: true,
  accent: "#ff3b00",
  background: "#f2f2f2",
  font: "Space Grotesk Variable",
  spacing: 100,
  motion: true,
  maintenance: false,
  description:
    "Independent motion design. Brand films, title sequences, and moving identities.",
  shareImage: "",
  links: [
    { label: "Vimeo", url: "https://vimeo.com/" },
    { label: "Instagram", url: "https://instagram.com/" },
    { label: "Behance", url: "https://behance.net/" },
  ],
  sections: [
    { id: "work", label: "Work", visible: true, nav: true },
    { id: "social", label: "Social", visible: true, nav: true },
    { id: "studio", label: "Studio", visible: true, nav: true },
    { id: "capabilities", label: "Capabilities", visible: true, nav: false },
    { id: "contact", label: "Contact", visible: true, nav: true },
  ],
  services: [
    {
      title: "Brand & ad animation",
      description:
        "An identity given a tempo. Launch films, product choreography, and motion systems that make a brand feel like itself.",
      items: "Launch films, Logo motion, Product & pack, Motion guidelines",
    },
    {
      title: "Title sequences",
      description:
        "The first frame sets the feeling. Cinematic typography and visual worlds built around a story.",
      items: "Main titles, Festival opens, Type & grade, End crawls",
    },
    {
      title: "Social-first loops",
      description:
        "Vertical, square, and six seconds long. Distinctive motion that stays recognizable with the sound off.",
      items: "Vertical series, Loop packs, Motion kits, Sound-off cuts",
    },
  ],
};
Object.assign(baseSettings, personal);
export const newProject = (): Project => ({
  title: "Untitled project",
  slug: `new-project-${Date.now()}`,
  client: "",
  category: "Brand & Ad",
  tags: "",
  year: String(new Date().getFullYear()),
  duration: "00:30",
  format: "16:9",
  role: "Design & animation",
  tools: "",
  deliverables: "",
  credits: "",
  summary: "",
  image: "art:prism",
  video: "",
  captions: "",
  featured: true,
  social: false,
  order: Date.now(),
  focal: "50% 50%",
  blocks: [],
});
const examples = [
  [
    "Refraction",
    "Light, given a new direction.",
    "prism",
    "Brand & Ad",
    "01:12",
  ],
  [
    "Soft matter",
    "An exploration of impossible softness.",
    "orb",
    "3D Exploration",
    "00:48",
  ],
  [
    "After hours",
    "A study in type, tension, and light.",
    "type",
    "Title Sequence",
    "01:04",
  ],
  [
    "Chromatic",
    "Color in constant conversation.",
    "ribbon",
    "Brand & Ad",
    "00:36",
  ],
  [
    "Orbit studies",
    "A small universe, on repeat.",
    "orbit",
    "Social Loop",
    "00:06",
  ],
  [
    "Bloom system",
    "An identity with room to grow.",
    "bloom",
    "Social Loop",
    "00:08",
  ],
  ["Frequency", "Find a different rhythm.", "wave", "Social Loop", "00:04"],
];
export function seeds(): ContentDoc[] {
  const time = new Date().toISOString();
  return [
    {
      id: "site-settings",
      kind: "settings",
      data: structuredClone(baseSettings),
      version: 1,
      published: true,
      archived: false,
      updated_at: time,
    },
    ...examples.map((e, i) => ({
      id: `sample-${i}`,
      kind: "project" as const,
      data: {
        ...newProject(),
        title: e[0],
        slug: slugify(e[0]),
        summary:
          e[1] +
          " This is a demonstration study, not commissioned client work. Replace the artwork, description, and credits with your own project.",
        client: "Independent study · demo",
        image: `art:${e[2]}`,
        category: e[3],
        duration: e[4],
        order: i,
        social: i > 3,
        featured: i < 4,
        year: String(2026 - (i % 2)),
        deliverables: "Styleframes, Motion exploration, Visual direction",
        blocks: [
          {
            ...block("text"),
            title: "The idea",
            text: "A visual experiment in form, rhythm, and restraint. This sample case study demonstrates the structure of a project breakdown.",
          },
          { ...block("image"), title: "A closer look", media: `art:${e[2]}` },
          {
            ...block("text"),
            title: "From form to feeling",
            text: "Use this section to share your process: references, storyboards, animation decisions, and the details that make the final piece.",
          },
        ],
      },
      version: 1,
      published: true,
      archived: false,
      updated_at: time,
    })),
  ];
}
export const inquirySchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.email().max(254),
  project_type: z.string().min(1).max(100),
  budget: z.string().max(100),
  message: z.string().trim().min(20).max(5000),
  website: z.string().max(0),
});
export function validateDoc(d: ContentDoc) {
  if (!["project", "page", "settings"].includes(d.kind))
    throw new Error("Invalid content type");
  if (d.kind !== "settings") {
    const v = d.data as Project;
    if (!v.title?.trim()) throw new Error("Add a title");
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v.slug))
      throw new Error(
        "Use a lowercase slug with letters, numbers, and hyphens",
      );
    if (!Array.isArray(v.blocks)) throw new Error("Invalid content blocks");
  } else {
    const s = d.data as Settings;
    if (!s.name?.trim() || !s.title?.trim())
      throw new Error("Site name and owner name are required");
    if (
      !/^#[\da-f]{6}$/i.test(s.accent) ||
      !/^#[\da-f]{6}$/i.test(s.background)
    )
      throw new Error("Use six-digit theme colors");
    if (
      !Array.isArray(s.sections) ||
      !Array.isArray(s.services) ||
      !Array.isArray(s.links)
    )
      throw new Error("Invalid site settings");
  }
  if (JSON.stringify(d.data).length > 500000)
    throw new Error("Content exceeds the document limit");
}
export function embedUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return null;
    if (["youtube.com", "www.youtube.com"].includes(u.hostname)) {
      const id = u.searchParams.get("v");
      return id && /^[\w-]{11}$/.test(id)
        ? `https://www.youtube-nocookie.com/embed/${id}`
        : null;
    }
    if (u.hostname === "youtu.be" && /^\/[\w-]{11}$/.test(u.pathname))
      return `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}`;
    if (
      ["vimeo.com", "www.vimeo.com"].includes(u.hostname) &&
      /^\/\d+$/.test(u.pathname)
    )
      return `https://player.vimeo.com/video/${u.pathname.slice(1)}`;
    return null;
  } catch {
    return null;
  }
}
export function safeLink(s: string) {
  if (s.startsWith("#/")) return s;
  try {
    const u = new URL(s);
    return ["https:", "mailto:"].includes(u.protocol) ? s : "#";
  } catch {
    return "#";
  }
}
export function mediaIds(value: unknown): string[] {
  const ids = new Set<string>();
  function walk(v: unknown) {
    if (typeof v === "string") {
      for (const m of v.matchAll(/media:([a-zA-Z0-9-]+)/g)) ids.add(m[1]);
    } else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  }
  walk(value);
  return [...ids];
}
