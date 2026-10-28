export type Kind = "project" | "page" | "settings";
export type Role = "owner" | "editor";
export type BlockType =
  | "heading"
  | "text"
  | "image"
  | "gallery"
  | "video"
  | "quote"
  | "spacer"
  | "cta"
  | "projects"
  | "services"
  | "comparison";
export interface Block {
  id: string;
  type: BlockType;
  title: string;
  text: string;
  media: string;
  secondary?: string;
  link?: string;
}
export interface Project {
  title: string;
  slug: string;
  client: string;
  category: string;
  tags: string;
  year: string;
  duration: string;
  format: string;
  role: string;
  tools: string;
  deliverables: string;
  credits: string;
  summary: string;
  image: string;
  video: string;
  captions: string;
  featured: boolean;
  social: boolean;
  order: number;
  focal: string;
  blocks: Block[];
}
export interface Page {
  title: string;
  slug: string;
  description: string;
  nav: boolean;
  order: number;
  blocks: Block[];
}
export interface Service {
  title: string;
  description: string;
  items: string;
}
export interface Settings {
  title: string;
  name: string;
  monogram: string;
  logo: string;
  favicon: string;
  email: string;
  location: string;
  tagline: string;
  bio: string;
  experience: string;
  tools: string;
  clients: string;
  portrait: string;
  heroImage: string;
  heroVideo: string;
  heroOverlay: number;
  heroServices: string;
  heroRange: string;
  availability: boolean;
  availabilityText: string;
  responseTime: string;
  workTitle: string;
  workIntro: string;
  socialTitle: string;
  socialIntro: string;
  studioTitle: string;
  contactTitle: string;
  contactGuidance: string;
  footerText: string;
  colophon: boolean;
  accent: string;
  background: string;
  font: string;
  spacing: number;
  motion: boolean;
  maintenance: boolean;
  description: string;
  shareImage: string;
  links: { label: string; url: string }[];
  sections: { id: string; label: string; visible: boolean; nav: boolean }[];
  services: Service[];
}
export interface ContentDoc {
  id: string;
  kind: Kind;
  data: Project | Page | Settings;
  version: number;
  published: boolean;
  archived: boolean;
  updated_at: string;
  updated_by?: string;
}
export interface Revision {
  id: string;
  document_id: string;
  data: ContentDoc["data"];
  version: number;
  created_at: string;
  actor: string;
  action: string;
}
export interface Media {
  id: string;
  name: string;
  path: string;
  url?: string;
  type: string;
  size: number;
  width: number;
  height: number;
  duration: number;
  alt: string;
  caption: string;
  folder: string;
  status: string;
  created_at: string;
  original_path?: string;
  variants?: Record<string, string>;
}
export interface Inquiry {
  id: string;
  name: string;
  email: string;
  project_type: string;
  budget: string;
  message: string;
  status: "new" | "read" | "archived" | "spam";
  created_at: string;
}
export interface Member {
  user_id: string;
  email: string;
  role: Role;
  created_at: string;
}
