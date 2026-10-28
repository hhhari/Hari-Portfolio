import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  LayoutDashboard,
  FolderOpen,
  Image as ImageIcon,
  Files,
  House,
  Settings,
  Inbox,
  Users,
  History,
  Search,
  Plus,
  Upload,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  MoreHorizontal,
  Trash2,
  Copy,
  Archive,
  RotateCcw,
  Check,
  Loader2,
  Menu,
  X,
  LogOut,
  Globe,
  ShieldCheck,
  GripVertical,
  Eye,
  Save,
  Download,
  Link as LinkIcon,
  FileText,
  Film,
  CheckCircle2,
} from "lucide-react";
import * as repo from "./repository";
import {
  baseSettings,
  block,
  mediaIds,
  newProject,
  slugify,
  uid,
  validateDoc,
} from "./content";
import { broadcast, useStore } from "./store";
import type {
  Block,
  ContentDoc,
  Inquiry,
  Media,
  Member,
  Page,
  Project,
  Revision,
  Settings as SiteSettings,
} from "./types";
import "./admin.css";
const nav = [
  ["overview", "Overview", LayoutDashboard],
  ["projects", "Projects", FolderOpen],
  ["media", "Media library", ImageIcon],
  ["pages", "Pages", Files],
  ["homepage", "Homepage", House],
  ["inquiries", "Inquiries", Inbox],
  ["users", "Users & access", Users],
  ["history", "Activity & history", History],
  ["settings", "Site settings", Settings],
] as const;
const textError = (e: unknown) =>
  e instanceof Error ? e.message : "Something went wrong. Please try again.";
function Button({
  children,
  onClick,
  primary = false,
  disabled = false,
  type = "button",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  primary?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`admin-btn ${primary ? "primary" : ""} ${className}`}
    >
      {children}
    </button>
  );
}
function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
function Empty({
  icon: Icon = FolderOpen,
  title,
  description,
  children,
}: {
  icon?: typeof FolderOpen;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="admin-empty">
      <Icon size={30} />
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}
function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    ref.current?.showModal();
    return () => {
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="admin-modal"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="modal-title">
        <h2>{title}</h2>
        <button
          className="icon-btn"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function Field({
  label,
  value,
  onChange,
  area = false,
  type = "text",
  hint = "",
  min,
  max,
  disabled = false,
}: {
  label: string;
  value: string | number;
  onChange: (s: string) => void;
  area?: boolean;
  type?: string;
  hint?: string;
  min?: number;
  max?: number;
  disabled?: boolean;
}) {
  return (
    <label className="admin-field">
      <span>{label}</span>
      {area ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          disabled={disabled}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          min={min}
          max={max}
          disabled={disabled}
        />
      )}{" "}
      {hint && <small>{hint}</small>}
    </label>
  );
}
function Toggle({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <label className="toggle-row">
      <span>
        {label}
        {hint && <small>{hint}</small>}
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}
function MediaField({
  label,
  value,
  onChange,
  type = "image",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  const { resolve } = useStore();
  const [open, setOpen] = useState(false);
  return (
    <div className="admin-field">
      <span>{label}</span>
      <div className="media-field">
        {type === "image" && resolve(value) ? (
          <img src={resolve(value)} alt="Selected asset" />
        ) : (
          <ImageIcon size={20} />
        )}
        <input
          aria-label={`${label} reference`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={
            type === "video"
              ? "HTTPS video URL or media reference"
              : "Select from your library"
          }
        />
        <Button onClick={() => setOpen(true)}>Choose</Button>
        {value && (
          <button
            className="icon-btn"
            aria-label={`Remove ${label}`}
            onClick={() => onChange("")}
          >
            <X size={15} />
          </button>
        )}
      </div>
      {open && (
        <MediaPicker
          type={type}
          onClose={() => setOpen(false)}
          onPick={(v) => {
            onChange(v);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}
function MediaPicker({
  onPick,
  onClose,
  type,
}: {
  onPick: (v: string) => void;
  onClose: () => void;
  type: string;
}) {
  const [items, setItems] = useState<Media[]>([]),
    [urls, setUrls] = useState<Record<string, string>>({}),
    [error, setError] = useState("");
  useEffect(() => {
    repo
      .loadMedia()
      .then(async (list) => {
        const filtered = list.filter(
          (m) =>
            type === "all" ||
            m.type.startsWith(type) ||
            (type === "captions" && m.type === "text/vtt"),
        );
        setItems(filtered);
        setUrls(
          await repo.mediaUrls(
            filtered.map((m) => m.id),
            true,
          ),
        );
      })
      .catch((e) => setError(textError(e)));
  }, [type]);
  return (
    <Modal title="Choose an asset" onClose={onClose}>
      {error && <div className="alert">{error}</div>}
      <div className="picker-grid">
        {items.map((m) => (
          <button
            key={m.id}
            className="picker-item"
            onClick={() => onPick(`media:${m.id}`)}
          >
            {m.type.startsWith("image/") ? (
              <img src={urls[m.id]} alt={m.alt || m.name} />
            ) : (
              <Film />
            )}
            <span>{m.name}</span>
          </button>
        ))}
      </div>
      {!items.length && (
        <Empty
          icon={ImageIcon}
          title="Your library is ready for its first upload"
          description="Upload media in the Media library, then select it here."
        />
      )}
      <p className="helper">Built-in demonstration artwork</p>
      <div className="art-choices">
        {["prism", "orb", "type", "ribbon", "orbit", "bloom", "wave"].map(
          (a) => (
            <button key={a} onClick={() => onPick(`art:${a}`)}>
              {a}
            </button>
          ),
        )}
      </div>
    </Modal>
  );
}
function Overview() {
  const { docs, settings: s, notify } = useStore();
  const [activity, setActivity] = useState<Revision[]>([]),
    [media, setMedia] = useState<Media[]>([]),
    [inquiries, setInquiries] = useState<Inquiry[]>([]);
  useEffect(() => {
    Promise.all([repo.revisions(), repo.loadMedia(), repo.loadInquiries()])
      .then(([a, m, i]) => {
        setActivity(a);
        setMedia(m);
        setInquiries(i);
      })
      .catch((e) => notify(textError(e)));
  }, [notify]);
  const projects = docs.filter((d) => d.kind === "project");
  const stats = [
    [
      "Published projects",
      projects.filter((d) => d.published && !d.archived).length,
      FolderOpen,
    ],
    [
      "Draft projects",
      projects.filter((d) => !d.published && !d.archived).length,
      Files,
    ],
    ["Media assets", media.length, ImageIcon],
    [
      "New inquiries",
      inquiries.filter((i) => i.status === "new").length,
      Inbox,
    ],
  ] as const;
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <div className="eyebrow">Your studio, at a glance</div>
          <h1>Overview</h1>
          <p>A little less managing. A little more making.</p>
        </div>
        <a className="admin-btn primary" href="#/admin/projects/new">
          <Plus size={16} />
          Add a project
        </a>
      </div>
      {repo.demo && (
        <div className="demo-notice">
          <div>
            <span className="demo-pip" />
            <strong>You’re exploring the local demo.</strong> Changes stay in
            this browser. Connect Supabase for secure, shared publishing.
          </div>
          <a href="#/admin/settings">
            Setup guide <ArrowUpRight size={14} />
          </a>
        </div>
      )}
      <div className="stats-grid">
        {stats.map(([label, value, Icon]) => (
          <div className="stat-card" key={label}>
            <span>
              {label}
              <Icon size={17} />
            </span>
            <strong>{value.toString().padStart(2, "0")}</strong>
            <span className="stat-foot">
              {label === "Media assets"
                ? "Images, video & documents"
                : label === "New inquiries"
                  ? "Waiting for your next move"
                  : label === "Published projects"
                    ? "Live on your portfolio"
                    : "Ideas in progress"}
            </span>
          </div>
        ))}
      </div>
      <div className="overview-grid">
        <section className="admin-card">
          <div className="card-heading">
            <div>
              <h2>Website visibility</h2>
              <p>Your next great impression starts here.</p>
            </div>
            <Globe size={18} />
          </div>
          <div className="visibility-value">
            <span className="status-dot" />
            {s.maintenance ? "Maintenance mode" : "Public portfolio"}
            <Badge tone={repo.demo ? "amber" : "green"}>
              {repo.demo ? "Demo" : "Connected"}
            </Badge>
          </div>
          <div className="card-bottom">
            <a className="admin-btn" href="#/" target="_blank" rel="noreferrer">
              View website <ExternalLink size={14} />
            </a>
            <a href="#/admin/settings" className="text-link">
              Manage settings <ArrowRight size={14} />
            </a>
          </div>
        </section>
        <section className="admin-card">
          <div className="card-heading">
            <div>
              <h2>Make your next move</h2>
              <p>Everything you need to keep things moving.</p>
            </div>
            <ArrowUpRight size={19} />
          </div>
          <div className="quick-actions">
            <a href="#/admin/media">
              <Upload size={19} />
              <span>Upload media</span>
              <ArrowUpRight size={14} />
            </a>
            <a href="#/admin/homepage">
              <House size={19} />
              <span>Edit homepage</span>
              <ArrowUpRight size={14} />
            </a>
            <a href="#/admin/pages/new">
              <Files size={19} />
              <span>Create a page</span>
              <ArrowUpRight size={14} />
            </a>
          </div>
        </section>
      </div>
      <section className="admin-card recent-projects">
        <div className="card-heading">
          <div>
            <h2>Your projects</h2>
            <p>From first frame to final cut.</p>
          </div>
          <a className="text-link" href="#/admin/projects">
            View all projects <ArrowRight size={14} />
          </a>
        </div>
        <div className="overview-project-grid">
          {projects
            .filter((p) => !p.archived)
            .slice(0, 3)
            .map((d) => (
              <OverviewProject key={d.id} doc={d} />
            ))}
        </div>
        {!projects.length && (
          <Empty
            title="Your work belongs here"
            description="Create your first project and bring your portfolio to life."
          />
        )}
      </section>
      <div className="overview-grid bottom-overview">
        <section className="admin-card">
          <div className="card-heading">
            <div>
              <h2>Recent activity</h2>
              <p>The latest from your studio.</p>
            </div>
            <History size={18} />
          </div>
          {activity.length ? (
            <div className="activity-list">
              {activity.slice(0, 4).map((a) => (
                <div key={a.id}>
                  <span className="activity-icon">
                    <Check size={14} />
                  </span>
                  <div>
                    <strong>
                      {String(
                        (a.data as Project).title ||
                          (a.data as SiteSettings).title ||
                          "Content",
                      )}{" "}
                      {a.action}
                    </strong>
                    <small>
                      {a.actor} · {new Date(a.created_at).toLocaleString()}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="quiet-empty">
              A fresh start. Your changes will appear here.
            </p>
          )}
        </section>
        <section className="admin-card studio-status">
          <div className="card-heading">
            <div>
              <h2>Studio status</h2>
              <p>A small signal. A new opportunity.</p>
            </div>
            <span className="status-dot" />
          </div>
          <p className="status-statement">
            {s.availability ? "Open to what’s next." : "Deep in the making."}
          </p>
          <p>{s.availabilityText}</p>
          <a href="#/admin/homepage" className="text-link">
            Update availability <ArrowRight size={14} />
          </a>
        </section>
      </div>
      <p className="admin-colophon">
        MADE FOR MOTION. BUILT FOR YOUR NEXT CHAPTER.
      </p>
    </>
  );
}
function OverviewProject({ doc }: { doc: ContentDoc }) {
  const { resolve } = useStore();
  const p = doc.data as Project;
  return (
    <a href={`#/admin/projects/${doc.id}`} className="overview-project">
      <div>
        <img src={resolve(p.image)} alt={p.title} />
        <Badge tone={doc.published ? "green" : "amber"}>
          {doc.archived ? "Archived" : doc.published ? "Published" : "Draft"}
        </Badge>
      </div>
      <h3>
        {p.title}
        <ArrowUpRight size={15} />
      </h3>
      <p>
        {p.category} <span>· {p.year}</span>
      </p>
    </a>
  );
}
function Collection({ kind }: { kind: "project" | "page" }) {
  const { docs, notify, refresh, resolve } = useStore();
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState("all"),
    [sort, setSort] = useState("order"),
    [page, setPage] = useState(0),
    [busy, setBusy] = useState(false);
  const plural = kind === "project" ? "projects" : "pages";
  const all = docs.filter((d) => d.kind === kind);
  const filtered = all
    .filter((d) => {
      const p = d.data as Project;
      return (
        `${p.title} ${p.category || ""} ${p.tags || ""}`
          .toLowerCase()
          .includes(search.toLowerCase()) &&
        (status === "all"
          ? !d.archived
          : status === "archived"
            ? d.archived
            : status === "published"
              ? d.published && !d.archived
              : !d.published && !d.archived)
      );
    })
    .sort((a, b) =>
      sort === "title"
        ? (a.data as Project).title.localeCompare((b.data as Project).title)
        : sort === "updated"
          ? b.updated_at.localeCompare(a.updated_at)
          : (a.data as Project).order - (b.data as Project).order,
    );
  const list = filtered.slice(page * 8, page * 8 + 8);
  useEffect(() => setPage(0), [search, status, sort]);
  async function action(
    d: ContentDoc,
    a: "duplicate" | "archive" | "restore" | "delete" | "unpublish",
  ) {
    if (
      (a === "delete" || a === "unpublish") &&
      !confirm(
        a === "delete"
          ? "Permanently delete this content? Revision history remains in your backup only."
          : "Remove this content from the public website?",
      )
    )
      return;
    setBusy(true);
    try {
      if (a === "duplicate") {
        const data = {
          ...structuredClone(d.data),
          title: (d.data as Project).title + " copy",
          slug: (d.data as Project).slug + "-copy-" + Date.now(),
        };
        await repo.saveDoc({
          ...d,
          id: uid(),
          data,
          version: 0,
          published: false,
          archived: false,
        });
      } else await repo.docAction(d.id, a);
      broadcast();
      await refresh();
      notify(
        `Content ${a === "duplicate" ? "duplicated" : a === "delete" ? "deleted" : a === "unpublish" ? "unpublished" : a === "archive" ? "archived" : "restored"}.`,
      );
    } catch (e) {
      notify(textError(e));
    } finally {
      setBusy(false);
    }
  }
  async function move(d: ContentDoc, direction: number) {
    const i = filtered.findIndex((x) => x.id === d.id),
      other = filtered[i + direction];
    if (!other) return;
    setBusy(true);
    try {
      const order = (d.data as Project).order,
        otherOrder = (other.data as Project).order;
      await repo.saveDoc({ ...d, data: { ...d.data, order: otherOrder } });
      await repo.saveDoc({ ...other, data: { ...other.data, order } });
      broadcast();
      await refresh();
      notify(
        "Order saved as draft. Publish both changed items to update the public order.",
      );
    } catch (e) {
      notify(textError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <div className="eyebrow">Content management</div>
          <h1>{kind === "project" ? "Projects" : "Pages"}</h1>
          <p>
            {kind === "project"
              ? "Your work, beautifully organized."
              : "Build a home for every story."}
          </p>
        </div>
        <a className="admin-btn primary" href={`#/admin/${plural}/new`}>
          <Plus size={16} />
          Add {kind}
        </a>
      </div>
      <section className="admin-card collection">
        <div className="collection-toolbar">
          <div className="search-field">
            <Search size={16} />
            <input
              placeholder={`Search ${plural}…`}
              aria-label={`Search ${plural}`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            aria-label="Content status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">All active</option>
            <option value="published">Published</option>
            <option value="draft">Drafts</option>
            <option value="archived">Archived</option>
          </select>
          <select
            aria-label="Sort content"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="order">Display order</option>
            <option value="updated">Recently updated</option>
            <option value="title">Title A–Z</option>
          </select>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{kind === "project" ? "Project" : "Page"}</th>
                <th>Status</th>
                <th>{kind === "project" ? "Category" : "Navigation"}</th>
                <th>Updated</th>
                <th>Order</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.map((d, i) => {
                const p = d.data as Project;
                return (
                  <tr
                    key={d.id}
                    draggable={
                      !busy && sort === "order" && !search && status === "all"
                    }
                    onDragStart={(e) =>
                      e.dataTransfer.setData("text/plain", d.id)
                    }
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const from = filtered.find(
                        (x) => x.id === e.dataTransfer.getData("text/plain"),
                      );
                      if (from)
                        void move(
                          from,
                          filtered.indexOf(d) - filtered.indexOf(from),
                        );
                    }}
                  >
                    <td>
                      <a
                        className="table-project"
                        href={`#/admin/${plural}/${d.id}`}
                      >
                        {kind === "project" ? (
                          <img src={resolve(p.image)} alt="" />
                        ) : (
                          <span className="page-icon">
                            <FileText size={20} />
                          </span>
                        )}
                        <span>
                          <strong>{p.title}</strong>
                          <small>/{p.slug}</small>
                        </span>
                      </a>
                    </td>
                    <td>
                      <Badge
                        tone={
                          d.archived
                            ? "neutral"
                            : d.published
                              ? "green"
                              : "amber"
                        }
                      >
                        {d.archived
                          ? "Archived"
                          : d.published
                            ? "Published"
                            : "Draft"}
                      </Badge>
                    </td>
                    <td>
                      {kind === "project"
                        ? p.category
                        : (d.data as Page).nav
                          ? "In menu"
                          : "Hidden from menu"}
                    </td>
                    <td className="muted">
                      {new Date(d.updated_at).toLocaleDateString()}
                    </td>
                    <td>
                      <div className="order-buttons">
                        <button
                          className="icon-btn"
                          disabled={busy || i + page * 8 === 0}
                          aria-label={`Move ${p.title} up`}
                          onClick={() => move(d, -1)}
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          className="icon-btn"
                          disabled={
                            busy || i + page * 8 === filtered.length - 1
                          }
                          aria-label={`Move ${p.title} down`}
                          onClick={() => move(d, 1)}
                        >
                          <ArrowDown size={14} />
                        </button>
                      </div>
                    </td>
                    <td>
                      <details className="row-menu">
                        <summary aria-label={`Actions for ${p.title}`}>
                          <MoreHorizontal size={18} />
                        </summary>
                        <div>
                          {[
                            ["duplicate", Copy, "Duplicate"],
                            [
                              d.archived ? "restore" : "archive",
                              d.archived ? RotateCcw : Archive,
                              d.archived ? "Restore" : "Archive",
                            ],
                            ...(d.published
                              ? [["unpublish", Eye, "Unpublish"]]
                              : []),
                            ["delete", Trash2, "Delete"],
                          ].map(([a, Icon, label]) => {
                            const I = Icon as typeof Copy;
                            return (
                              <button
                                disabled={busy}
                                key={String(a)}
                                onClick={() => action(d, a as "duplicate")}
                              >
                                <I size={14} />
                                {label as string}
                              </button>
                            );
                          })}
                        </div>
                      </details>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!list.length && (
          <Empty
            title={`No ${plural} here yet`}
            description="Try another filter, or create something new."
          />
        )}
        <div className="pagination">
          <span>
            {filtered.length} {plural} ·{" "}
            {docs.filter((d) => d.kind === "page").length} total pages
          </span>
          <div>
            <Button disabled={page === 0} onClick={() => setPage(page - 1)}>
              <ChevronLeft size={15} />
            </Button>
            <span>
              {page + 1} / {Math.max(1, Math.ceil(filtered.length / 8))}
            </span>
            <Button
              disabled={(page + 1) * 8 >= filtered.length}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight size={15} />
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
function BlockEditor({
  blocks,
  onChange,
}: {
  blocks: Block[];
  onChange: (b: Block[]) => void;
}) {
  const [add, setAdd] = useState<Block["type"]>("text");
  const update = (i: number, v: Partial<Block>) =>
    onChange(blocks.map((b, j) => (j === i ? { ...b, ...v } : b)));
  const move = (i: number, j: number) => {
    const next = [...blocks];
    const [b] = next.splice(i, 1);
    next.splice(j, 0, b);
    onChange(next);
  };
  return (
    <div className="block-editor">
      {blocks.map((b, i) => (
        <section
          key={b.id}
          className="editor-block"
          draggable
          onDragStart={(e) => {
            e.stopPropagation();
            e.dataTransfer.setData("application/block", String(i));
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const n = e.dataTransfer.getData("application/block");
            if (n !== "") move(Number(n), i);
          }}
        >
          <div className="editor-block-header">
            <GripVertical size={15} />
            <strong>
              {String(i + 1).padStart(2, "0")} · {b.type}
            </strong>
            <button
              aria-label="Move block up"
              className="icon-btn"
              disabled={i === 0}
              onClick={() => move(i, i - 1)}
            >
              <ArrowUp size={14} />
            </button>
            <button
              aria-label="Move block down"
              className="icon-btn"
              disabled={i === blocks.length - 1}
              onClick={() => move(i, i + 1)}
            >
              <ArrowDown size={14} />
            </button>
            <button
              aria-label="Delete block"
              className="icon-btn"
              onClick={() => onChange(blocks.filter((_, j) => j !== i))}
            >
              <Trash2 size={14} />
            </button>
          </div>
          {!["spacer", "projects", "services"].includes(b.type) && (
            <Field
              label="Heading or caption"
              value={b.title}
              onChange={(title) => update(i, { title })}
            />
          )}{" "}
          {[
            "text",
            "quote",
            "heading",
            "spacer",
            "image",
            "comparison",
          ].includes(b.type) && (
            <Field
              label={
                b.type === "spacer"
                  ? "Height in pixels"
                  : "Text / accessible description"
              }
              value={b.text}
              area={b.type !== "spacer"}
              onChange={(text) => update(i, { text })}
            />
          )}{" "}
          {["image", "video", "comparison"].includes(b.type) && (
            <MediaField
              label={b.type === "comparison" ? "After image" : "Media"}
              value={b.media}
              type={b.type === "video" ? "video" : "image"}
              onChange={(media) => update(i, { media })}
            />
          )}{" "}
          {["video", "comparison"].includes(b.type) && (
            <MediaField
              label={b.type === "comparison" ? "Before image" : "Video poster"}
              value={b.secondary || ""}
              onChange={(secondary) => update(i, { secondary })}
            />
          )}{" "}
          {b.type === "gallery" && (
            <Field
              label="Media references (one per line)"
              value={b.media}
              area
              onChange={(media) => update(i, { media })}
              hint="Use media:ID values from the media library."
            />
          )}{" "}
          {b.type === "cta" && (
            <Field
              label="Link (HTTPS, mailto, or #/ route)"
              value={b.link || ""}
              onChange={(link) => update(i, { link })}
            />
          )}
        </section>
      ))}
      <div className="add-block">
        <select
          aria-label="Block type"
          value={add}
          onChange={(e) => setAdd(e.target.value as Block["type"])}
        >
          {[
            "text",
            "heading",
            "image",
            "gallery",
            "video",
            "quote",
            "comparison",
            "projects",
            "services",
            "cta",
            "spacer",
          ].map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <Button onClick={() => onChange([...blocks, block(add)])}>
          <Plus size={15} />
          Add block
        </Button>
      </div>
    </div>
  );
}
function Editor({
  kind,
  id,
  initialTab = "content",
}: {
  kind: "project" | "page" | "settings";
  id: string;
  initialTab?: string;
}) {
  const { docs, notify, refresh } = useStore();
  const initial = docs.find((d) => d.id === id);
  const [doc, setDoc] = useState<ContentDoc>(
    initial ?? {
      id: id === "new" ? uid() : id,
      kind,
      data:
        kind === "settings"
          ? structuredClone(baseSettings)
          : kind === "project"
            ? newProject()
            : {
                title: "Untitled page",
                slug: `new-page-${Date.now()}`,
                description: "",
                nav: false,
                order: Date.now(),
                blocks: [],
              },
      version: 0,
      published: false,
      archived: false,
      updated_at: new Date().toISOString(),
    },
  );
  const [dirty, setDirty] = useState(false),
    [saving, setSaving] = useState(false),
    [lastSave, setLastSave] = useState(""),
    [history, setHistory] = useState<Revision[] | null>(null),
    [tab, setTab] = useState(initialTab);
  const current = useRef(doc),
    editCount = useRef(0),
    lock = useRef(false);
  current.current = doc;
  const update = (data: Partial<Project & Page & SiteSettings>) => {
    editCount.current++;
    setDoc((d) => ({ ...d, data: { ...d.data, ...data } }));
    setDirty(true);
  };
  async function save(publish = false) {
    if (lock.current) return;
    lock.current = true;
    setSaving(true);
    const count = editCount.current;
    try {
      const saved = await repo.saveDoc(current.current, publish);
      setDoc((d) => ({
        ...d,
        version: saved.version,
        published: saved.published,
        updated_at: saved.updated_at,
      }));
      if (editCount.current === count) setDirty(false);
      setLastSave(
        new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
      broadcast();
      await refresh();
      if (id === "new") {
        location.hash = `/admin/${kind === "project" ? "projects" : kind === "page" ? "pages" : "settings"}/${saved.id}`;
      }
      if (publish) notify("Published. Your website is up to date.");
    } catch (e) {
      notify(textError(e));
    } finally {
      lock.current = false;
      setSaving(false);
    }
  }
  useEffect(() => {
    if (!dirty) return;
    const timer = setTimeout(() => void save(), 1800);
    return () => clearTimeout(timer);
  });
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!dirty) return;
      const a = (e.target as HTMLElement).closest("a");
      if (
        a?.getAttribute("href")?.startsWith("#/") &&
        !confirm("You have unsaved changes. Leave this editor?")
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [dirty]);
  const p = doc.data as Project,
    page = doc.data as Page,
    s = doc.data as SiteSettings;
  const isSettings = kind === "settings";
  return (
    <>
      <div className="editor-sticky">
        <div>
          <a
            className="editor-back"
            href={`#/admin/${kind === "project" ? "projects" : kind === "page" ? "pages" : "overview"}`}
          >
            <ArrowLeftIcon />
            {isSettings
              ? "Overview"
              : kind === "project"
                ? "Projects"
                : "Pages"}
          </a>
          <h1>{isSettings ? "Your website, your way." : p.title}</h1>
          <div className="save-status">
            {saving ? (
              <>
                <Loader2 className="spin" size={13} />
                Saving…
              </>
            ) : dirty ? (
              "Unsaved changes"
            ) : lastSave ? (
              <>
                <CheckCircle2 size={13} />
                Saved at {lastSave}
              </>
            ) : (
              "Draft changes autosave"
            )}
            <Badge tone={doc.published ? "green" : "amber"}>
              {doc.published ? "Has published version" : "Draft"}
            </Badge>
          </div>
        </div>
        <div className="editor-actions">
          <Button
            disabled={saving || dirty || !doc.version}
            onClick={() =>
              window.open(
                `${location.pathname}#/preview/${doc.id}`,
                "_blank",
                "noopener",
              )
            }
          >
            <Eye size={15} />
            Preview
          </Button>
          <Button disabled={saving} onClick={() => save()}>
            <Save size={15} />
            Save draft
          </Button>
          <Button
            primary
            disabled={saving || doc.archived}
            onClick={() => save(true)}
          >
            {saving ? (
              <Loader2 size={15} className="spin" />
            ) : (
              <Globe size={15} />
            )}
            Publish
          </Button>
        </div>
      </div>
      <div className="editor-tabs">
        {(isSettings
          ? ["identity", "homepage", "navigation", "theme", "backup"]
          : ["content", "details", "history"]
        ).map((t) => (
          <button
            key={t}
            className={
              tab === t || (isSettings && tab === "content" && t === "identity")
                ? "active"
                : ""
            }
            onClick={() => {
              setTab(t);
              if (t === "history")
                repo
                  .revisions(doc.id)
                  .then(setHistory)
                  .catch((e) => notify(textError(e)));
            }}
          >
            {t}
          </button>
        ))}
      </div>
      {isSettings ? (
        <SettingsEditor
          settings={s}
          tab={tab === "content" ? "identity" : tab}
          update={update}
        />
      ) : (
        <div className="editor-layout">
          <div className="editor-main">
            {tab === "content" ? (
              <>
                <section className="admin-card">
                  <h2>
                    {kind === "project"
                      ? "The first impression"
                      : "Page content"}
                  </h2>
                  <Field
                    label="Title"
                    value={p.title}
                    onChange={(title) => update({ title })}
                  />
                  <Field
                    label="URL slug"
                    value={p.slug}
                    onChange={(slug) => update({ slug: slugify(slug) })}
                  />
                  <Field
                    label={kind === "project" ? "Synopsis" : "Description"}
                    value={kind === "project" ? p.summary : page.description}
                    area
                    onChange={(v) =>
                      update(
                        kind === "project"
                          ? { summary: v }
                          : { description: v },
                      )
                    }
                  />
                  {kind === "project" && (
                    <>
                      <MediaField
                        label="Cover image"
                        value={p.image}
                        onChange={(image) => update({ image })}
                      />
                      <Field
                        label="Image focal point"
                        value={p.focal}
                        hint="For example: 50% 50% or 30% 60%"
                        onChange={(focal) => update({ focal })}
                      />
                      <MediaField
                        label="Main video"
                        value={p.video}
                        type="video"
                        onChange={(video) => update({ video })}
                      />
                      <MediaField
                        label="Captions (.vtt)"
                        value={p.captions}
                        type="captions"
                        onChange={(captions) => update({ captions })}
                      />
                    </>
                  )}
                </section>
                <section className="admin-card">
                  <h2>
                    {kind === "project" ? "The breakdown" : "Page blocks"}
                  </h2>
                  <p className="helper">
                    Build a story, one frame at a time. Drag blocks or use the
                    arrows to reorder.
                  </p>
                  <BlockEditor
                    blocks={p.blocks}
                    onChange={(blocks) => update({ blocks })}
                  />
                </section>
              </>
            ) : tab === "details" ? (
              <section className="admin-card">
                <h2>Project information</h2>
                {kind === "project" ? (
                  <>
                    <div className="field-grid">
                      {(
                        [
                          "client",
                          "category",
                          "tags",
                          "year",
                          "duration",
                          "format",
                          "role",
                          "tools",
                          "deliverables",
                        ] as const
                      ).map((key) => (
                        <Field
                          label={key[0].toUpperCase() + key.slice(1)}
                          key={key}
                          value={p[key]}
                          onChange={(v) => update({ [key]: v })}
                        />
                      ))}
                    </div>
                    <Field
                      label="Credits"
                      value={p.credits}
                      area
                      onChange={(credits) => update({ credits })}
                    />
                  </>
                ) : (
                  <Field
                    label="Search description"
                    value={page.description}
                    area
                    onChange={(description) => update({ description })}
                  />
                )}
              </section>
            ) : (
              <section className="admin-card">
                <h2>Revision history</h2>
                <p className="helper">
                  Restoring a revision creates a draft. Publish when you’re
                  ready.
                </p>
                {history?.map((r) => (
                  <div className="revision-row" key={r.id}>
                    <div>
                      <strong>
                        Version {r.version} · {r.action}
                      </strong>
                      <small>
                        {new Date(r.created_at).toLocaleString()} · {r.actor}
                      </small>
                    </div>
                    <Button
                      onClick={() => {
                        setDoc((d) => ({ ...d, data: r.data }));
                        setDirty(true);
                        editCount.current++;
                        setTab("content");
                        notify("Revision restored to draft.");
                      }}
                    >
                      <RotateCcw size={14} />
                      Restore
                    </Button>
                  </div>
                ))}
                {history?.length === 0 && (
                  <p className="quiet-empty">
                    Save your first draft to begin its history.
                  </p>
                )}
              </section>
            )}
          </div>
          <aside className="editor-aside">
            <section className="admin-card">
              <h2>Publishing</h2>
              <p className="helper">
                Draft edits stay private until you publish. The last published
                version remains live.
              </p>
              {kind === "project" ? (
                <>
                  <Toggle
                    label="Featured project"
                    checked={p.featured}
                    onChange={(featured) => update({ featured })}
                  />
                  <Toggle
                    label="Social-first project"
                    checked={p.social}
                    onChange={(social) => update({ social })}
                  />
                </>
              ) : (
                <Toggle
                  label="Show in navigation"
                  checked={page.nav}
                  onChange={(nav) => update({ nav })}
                />
              )}
              <Field
                label="Display order"
                type="number"
                value={p.order}
                onChange={(order) => update({ order: Number(order) })}
              />
            </section>
            <section className="admin-card">
              <ShieldCheck size={20} />
              <h3>A little peace of mind.</h3>
              <p className="helper">
                Drafts and revisions are private. Your website only reads
                published content.
              </p>
              {repo.demo && <Badge tone="amber">Local demonstration</Badge>}
            </section>
          </aside>
        </div>
      )}
    </>
  );
}
function ArrowLeftIcon() {
  return <ChevronLeft size={14} />;
}
function SettingsEditor({
  settings: s,
  update,
  tab,
}: {
  settings: SiteSettings;
  update: (v: Partial<SiteSettings>) => void;
  tab: string;
}) {
  const { notify, docs, role } = useStore();
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  async function exportBackup() {
    setBusy(true);
    try {
      const blob = new Blob([JSON.stringify(await repo.backup(), null, 2)], {
        type: "application/json",
      });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `kinetic-content-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      notify("Content manifest exported. Back up media binaries separately.");
    } catch (e) {
      notify(textError(e));
    } finally {
      setBusy(false);
    }
  }
  async function importBackup(file?: File) {
    if (!file) return;
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error("Backup is too large.");
      const value = JSON.parse(await file.text());
      if (
        value.format !== "kinetic-content-v1" ||
        !Array.isArray(value.documents) ||
        value.documents.length > 1000
      )
        throw new Error("Invalid Kinetic content backup.");
      const imported = value.documents as ContentDoc[];
      for (const d of imported) validateDoc(d);
      if (
        !confirm(
          `Import ${imported.length} documents as private drafts? Existing drafts with matching IDs will be replaced. Media files must be restored separately.`,
        )
      )
        return;
      setBusy(true);
      for (const d of imported) {
        const existing = docs.find((x) => x.id === d.id);
        await repo.saveDoc({
          ...d,
          version: existing?.version ?? 0,
          published: existing?.published ?? false,
          archived: false,
        });
      }
      broadcast();
      notify("Content imported as drafts. Review each item before publishing.");
    } catch (e) {
      notify(textError(e));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }
  return (
    <div className="settings-layout">
      {tab === "identity" ? (
        <>
          <section className="admin-card">
            <h2>Studio identity</h2>
            <p className="helper">The details that make this place yours.</p>
            <div className="field-grid">
              {(
                ["title", "name", "monogram", "email", "location"] as const
              ).map((k) => (
                <Field
                  key={k}
                  label={
                    {
                      title: "Website name",
                      name: "Your display name",
                      monogram: "Monogram",
                      email: "Contact email",
                      location: "Location",
                    }[k]
                  }
                  value={s[k]}
                  onChange={(v) => update({ [k]: v })}
                />
              ))}
            </div>
            <MediaField
              label="Logo"
              value={s.logo}
              onChange={(logo) => update({ logo })}
            />
            <MediaField
              label="Favicon"
              value={s.favicon}
              onChange={(favicon) => update({ favicon })}
            />
            <Field
              label="Default search description"
              value={s.description}
              area
              onChange={(description) => update({ description })}
            />
            <MediaField
              label="Social sharing image"
              value={s.shareImage}
              onChange={(shareImage) => update({ shareImage })}
            />
            <Field
              label="Footer introduction"
              value={s.footerText}
              area
              onChange={(footerText) => update({ footerText })}
            />
            <Toggle
              label="Typography colophon"
              checked={s.colophon}
              onChange={(colophon) => update({ colophon })}
            />
            <Toggle
              label="Maintenance mode"
              hint="Temporarily replace the public portfolio with a holding page. Admin access remains available."
              checked={s.maintenance}
              onChange={(maintenance) => update({ maintenance })}
            />
          </section>
          <SetupCard />
        </>
      ) : tab === "homepage" ? (
        <>
          <section className="admin-card">
            <h2>The opening frame</h2>
            <Field
              label="Hero introduction"
              value={s.tagline}
              area
              onChange={(tagline) => update({ tagline })}
            />
            <Field
              label="Hero service labels (one per line)"
              value={s.heroServices}
              area
              onChange={(heroServices) => update({ heroServices })}
            />
            <Field
              label="Selected-work date range"
              value={s.heroRange}
              onChange={(heroRange) => update({ heroRange })}
            />
            <MediaField
              label="Hero artwork / poster"
              value={s.heroImage}
              onChange={(heroImage) => update({ heroImage })}
            />
            <MediaField
              label="Optional hero video"
              type="video"
              value={s.heroVideo}
              onChange={(heroVideo) => update({ heroVideo })}
            />
            <Field
              label="Dark overlay (%)"
              type="number"
              min={0}
              max={90}
              value={s.heroOverlay}
              onChange={(v) =>
                update({ heroOverlay: Math.min(90, Math.max(0, Number(v))) })
              }
            />
            <Toggle
              label="Available for work"
              checked={s.availability}
              onChange={(availability) => update({ availability })}
            />
            <Field
              label="Availability message"
              value={s.availabilityText}
              onChange={(availabilityText) => update({ availabilityText })}
            />
            <Field
              label="Reply time"
              value={s.responseTime}
              onChange={(responseTime) => update({ responseTime })}
            />
          </section>
          <section className="admin-card">
            <h2>Section introductions</h2>
            {(
              [
                "workTitle",
                "workIntro",
                "socialTitle",
                "socialIntro",
                "studioTitle",
                "contactTitle",
                "contactGuidance",
              ] as const
            ).map((k) => (
              <Field
                key={k}
                label={k
                  .replace(/([A-Z])/g, " $1")
                  .replace(/^./, (t) => t.toUpperCase())}
                value={s[k]}
                area={k.endsWith("Intro") || k === "contactGuidance"}
                onChange={(v) => update({ [k]: v })}
              />
            ))}
          </section>
          <section className="admin-card">
            <h2>Your studio</h2>
            {(["bio", "experience", "tools", "clients"] as const).map((k) => (
              <Field
                label={k[0].toUpperCase() + k.slice(1)}
                key={k}
                value={s[k]}
                area={k === "bio"}
                onChange={(v) => update({ [k]: v })}
              />
            ))}
            <MediaField
              label="Portrait / studio image"
              value={s.portrait}
              onChange={(portrait) => update({ portrait })}
            />
          </section>
          <section className="admin-card">
            <h2>Capabilities</h2>
            {s.services.map((service, i) => (
              <div className="service-editor" key={i}>
                <Field
                  label="Service title"
                  value={service.title}
                  onChange={(title) =>
                    update({
                      services: s.services.map((v, j) =>
                        j === i ? { ...v, title } : v,
                      ),
                    })
                  }
                />
                <Field
                  label="Description"
                  value={service.description}
                  area
                  onChange={(description) =>
                    update({
                      services: s.services.map((v, j) =>
                        j === i ? { ...v, description } : v,
                      ),
                    })
                  }
                />
                <Field
                  label="Deliverables (comma separated)"
                  value={service.items}
                  onChange={(items) =>
                    update({
                      services: s.services.map((v, j) =>
                        j === i ? { ...v, items } : v,
                      ),
                    })
                  }
                />
                <Button
                  onClick={() =>
                    update({ services: s.services.filter((_, j) => j !== i) })
                  }
                >
                  <Trash2 size={14} />
                  Remove service
                </Button>
              </div>
            ))}
            <Button
              onClick={() =>
                update({
                  services: [
                    ...s.services,
                    { title: "New service", description: "", items: "" },
                  ],
                })
              }
            >
              <Plus size={14} />
              Add service
            </Button>
          </section>
        </>
      ) : tab === "navigation" ? (
        <>
          <section className="admin-card">
            <h2>Homepage sections & menu</h2>
            <p className="helper">
              Change the order, visibility, and navigation label of every
              section.
            </p>
            {s.sections.map((section, i) => (
              <div className="section-setting" key={section.id}>
                <div className="order-buttons">
                  <Button
                    disabled={i === 0}
                    onClick={() => {
                      const sections = [...s.sections];
                      [sections[i - 1], sections[i]] = [
                        sections[i],
                        sections[i - 1],
                      ];
                      update({ sections });
                    }}
                  >
                    <ArrowUp size={14} />
                  </Button>
                  <Button
                    disabled={i === s.sections.length - 1}
                    onClick={() => {
                      const sections = [...s.sections];
                      [sections[i + 1], sections[i]] = [
                        sections[i],
                        sections[i + 1],
                      ];
                      update({ sections });
                    }}
                  >
                    <ArrowDown size={14} />
                  </Button>
                </div>
                <Field
                  label={`${section.id} menu label`}
                  value={section.label}
                  onChange={(label) =>
                    update({
                      sections: s.sections.map((v, j) =>
                        j === i ? { ...v, label } : v,
                      ),
                    })
                  }
                />
                <Toggle
                  label="Visible"
                  checked={section.visible}
                  onChange={(visible) =>
                    update({
                      sections: s.sections.map((v, j) =>
                        j === i ? { ...v, visible } : v,
                      ),
                    })
                  }
                />
                <Toggle
                  label="In menu"
                  checked={section.nav}
                  onChange={(nav) =>
                    update({
                      sections: s.sections.map((v, j) =>
                        j === i ? { ...v, nav } : v,
                      ),
                    })
                  }
                />
              </div>
            ))}
          </section>
          <section className="admin-card">
            <h2>Elsewhere</h2>
            {s.links.map((link, i) => (
              <div className="link-row" key={i}>
                <Field
                  label="Label"
                  value={link.label}
                  onChange={(label) =>
                    update({
                      links: s.links.map((v, j) =>
                        j === i ? { ...v, label } : v,
                      ),
                    })
                  }
                />
                <Field
                  label="HTTPS link"
                  value={link.url}
                  onChange={(url) =>
                    update({
                      links: s.links.map((v, j) =>
                        j === i ? { ...v, url } : v,
                      ),
                    })
                  }
                />
                <Button
                  onClick={() =>
                    update({ links: s.links.filter((_, j) => j !== i) })
                  }
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            ))}
            <Button
              onClick={() =>
                update({
                  links: [...s.links, { label: "New link", url: "https://" }],
                })
              }
            >
              <Plus size={14} />
              Add social link
            </Button>
          </section>
        </>
      ) : tab === "theme" ? (
        <section className="admin-card">
          <h2>Look & feel</h2>
          <p className="helper">
            The reference palette is the starting point. Make it yours.
          </p>
          <div className="field-grid">
            <Field
              label="Accent color"
              type="color"
              value={s.accent}
              onChange={(accent) => update({ accent })}
            />
            <Field
              label="Paper color"
              type="color"
              value={s.background}
              onChange={(background) => update({ background })}
            />
          </div>
          <label className="admin-field">
            <span>Display font</span>
            <select
              value={s.font}
              onChange={(e) => update({ font: e.target.value })}
            >
              {[
                "Space Grotesk Variable",
                "Inter Variable",
                "JetBrains Mono Variable",
              ].map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </label>
          <Field
            label="Section spacing (60–140 px)"
            type="number"
            min={60}
            max={140}
            value={s.spacing}
            onChange={(v) =>
              update({ spacing: Math.max(60, Math.min(140, Number(v))) })
            }
          />
          <Toggle
            label="Interface motion"
            checked={s.motion}
            hint="Visitor reduced-motion preferences always take priority."
            onChange={(motion) => update({ motion })}
          />
        </section>
      ) : (
        <>
          <section className="admin-card">
            <h2>Content backups</h2>
            <p className="helper">
              Export a content manifest including documents, metadata,
              inquiries, and the latest 100 revisions. It does not include media
              binaries or authentication accounts. See README for a complete
              storage and database backup.
            </p>
            <div className="button-row">
              <Button
                disabled={busy || role !== "owner"}
                onClick={exportBackup}
              >
                <Download size={15} />
                Export content manifest
              </Button>
              <Button
                disabled={busy || role !== "owner"}
                onClick={() => fileRef.current?.click()}
              >
                <Upload size={15} />
                Import drafts
              </Button>
              <input
                type="file"
                accept="application/json"
                ref={fileRef}
                className="sr-only"
                onChange={(e) => void importBackup(e.target.files?.[0])}
              />
            </div>
          </section>
          <SetupCard />
        </>
      )}
    </div>
  );
}
function SetupCard() {
  return (
    <section className="admin-card setup-card">
      <div className="card-heading">
        <div>
          <h2>{repo.demo ? "Connect your studio" : "Backend connection"}</h2>
          <p>
            {repo.demo
              ? "Local demo · Supabase is not configured"
              : "Supabase configured · see errors above for connection failures"}
          </p>
        </div>
        <Badge tone={repo.demo ? "amber" : "green"}>
          {repo.demo ? "Setup pending" : "Configured"}
        </Badge>
      </div>
      <ol>
        <li>
          Create a Supabase project and apply the included database migration.
        </li>
        <li>Enable GitHub OAuth and set your exact website callback URL.</li>
        <li>
          Deploy the included backend functions and configure their secrets.
        </li>
        <li>
          Add the public Supabase URL and publishable key to GitHub repository
          variables.
        </li>
        <li>Provision the first owner, then publish your content.</li>
      </ol>
      <p className="helper">
        Full instructions are in README.md. Administrative secrets belong in
        Supabase’s secure configuration, never this interface.
      </p>
      <p className="connection-detail">
        <Globe size={14} /> GitHub Pages: hhhari.github.io/Hari-Portfolio/
      </p>
    </section>
  );
}
function MediaLibrary() {
  const { notify, docs } = useStore();
  const [items, setItems] = useState<Media[]>([]),
    [urls, setUrls] = useState<Record<string, string>>({}),
    [search, setSearch] = useState(""),
    [type, setType] = useState("all"),
    [selected, setSelected] = useState<Media | null>(null),
    [progress, setProgress] = useState<
      { name: string; p: number; error?: string }[]
    >([]),
    [uploading, setUploading] = useState(false),
    [page, setPage] = useState(0);
  const file = useRef<HTMLInputElement>(null),
    controller = useRef<AbortController | null>(null),
    retry = useRef<File[]>([]);
  async function refresh() {
    const list = await repo.loadMedia();
    setItems(list);
    setUrls((old) => {
      Object.values(old)
        .filter((u) => u.startsWith("blob:"))
        .forEach(URL.revokeObjectURL);
      return {};
    });
    setUrls(
      await repo.mediaUrls(
        list.map((m) => m.id),
        true,
      ),
    );
  }
  useEffect(() => {
    refresh().catch((e) => notify(textError(e)));
    return () => controller.current?.abort();
  }, [notify]);
  async function upload(files: File[]) {
    if (uploading) return;
    setUploading(true);
    controller.current = new AbortController();
    retry.current = [];
    setProgress(files.map((f) => ({ name: f.name, p: 0 })));
    for (let i = 0; i < files.length; i++) {
      if (controller.current.signal.aborted) break;
      try {
        await repo.upload(
          files[i],
          (p) =>
            setProgress((old) =>
              old.map((v, j) => (i === j ? { ...v, p } : v)),
            ),
          controller.current.signal,
        );
      } catch (e) {
        retry.current.push(files[i]);
        setProgress((old) =>
          old.map((v, j) => (i === j ? { ...v, error: textError(e) } : v)),
        );
      }
    }
    setUploading(false);
    await refresh();
  }
  const filtered = items.filter(
    (m) =>
      (type === "all" || m.type.startsWith(type)) &&
      `${m.name} ${m.alt} ${m.folder}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  useEffect(() => setPage(0), [search, type]);
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <div className="eyebrow">The raw materials</div>
          <h1>Media library</h1>
          <p>Every image, every frame, all in one place.</p>
        </div>
        <Button
          primary
          onClick={() => file.current?.click()}
          disabled={uploading}
        >
          <Upload size={16} />
          Upload files
        </Button>
        <input
          ref={file}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm,application/pdf,text/vtt"
          className="sr-only"
          onChange={(e) => {
            void upload(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      </div>
      <div
        className="upload-drop"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void upload(Array.from(e.dataTransfer.files));
        }}
      >
        <Upload size={24} />
        <strong>Drop your next great frame here.</strong>
        <span>Images, MP4, WebM, PDF & VTT · up to 100 MB per file</span>
        <Button onClick={() => file.current?.click()} disabled={uploading}>
          Browse files
        </Button>
      </div>
      {progress.length > 0 && (
        <section className="admin-card upload-progress">
          {progress.map((v, i) => (
            <div key={i}>
              <span>{v.name}</span>
              {v.error ? (
                <span className="error-text">{v.error}</span>
              ) : (
                <>
                  <progress max={100} value={v.p} />
                  <span>{v.p}%</span>
                </>
              )}
            </div>
          ))}
          <div className="button-row">
            {uploading ? (
              <Button onClick={() => controller.current?.abort()}>
                Cancel remaining uploads
              </Button>
            ) : retry.current.length > 0 ? (
              <Button onClick={() => upload([...retry.current])}>
                Retry failed uploads
              </Button>
            ) : (
              <span className="helper">
                Uploads complete. Originals are kept separately from optimized
                image copies.
              </span>
            )}
          </div>
        </section>
      )}
      <div className="collection-toolbar">
        <div className="search-field">
          <Search size={16} />
          <input
            aria-label="Search media"
            placeholder="Search your library…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          aria-label="Media type"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="all">All files</option>
          <option value="image">Images</option>
          <option value="video">Videos</option>
          <option value="application">Documents</option>
          <option value="text">Captions</option>
        </select>
        <span className="media-storage">
          {items.length} assets ·{" "}
          {formatBytes(items.reduce((n, m) => n + m.size, 0))}
        </span>
      </div>
      <div className="media-grid">
        {filtered.slice(page * 18, page * 18 + 18).map((m) => (
          <button
            className="media-tile"
            key={m.id}
            onClick={() => setSelected(m)}
          >
            <div>
              {m.type.startsWith("image/") ? (
                <img loading="lazy" src={urls[m.id]} alt={m.alt || m.name} />
              ) : m.type.startsWith("video/") ? (
                <Film size={36} />
              ) : (
                <FileText size={36} />
              )}
            </div>
            <strong>{m.name}</strong>
            <small>
              {m.width ? `${m.width} × ${m.height} · ` : ""}
              {formatBytes(m.size)}
            </small>
            <Badge>{m.folder || "Unsorted"}</Badge>
          </button>
        ))}
      </div>
      {!filtered.length && (
        <Empty
          icon={ImageIcon}
          title="Room for your imagination"
          description="Upload your first image or video to get started."
        />
      )}
      <div className="pagination">
        <span>{filtered.length} matching assets</span>
        <div>
          <Button disabled={page === 0} onClick={() => setPage(page - 1)}>
            <ChevronLeft size={15} />
          </Button>
          <span>{page + 1}</span>
          <Button
            disabled={(page + 1) * 18 >= filtered.length}
            onClick={() => setPage(page + 1)}
          >
            <ChevronRight size={15} />
          </Button>
        </div>
      </div>
      {selected && (
        <Modal title="Asset details" onClose={() => setSelected(null)}>
          {selected.type.startsWith("image/") && (
            <img
              className="asset-preview"
              src={urls[selected.id]}
              alt={selected.alt || selected.name}
            />
          )}
          <Field
            label="File name"
            value={selected.name}
            onChange={(name) => setSelected({ ...selected, name })}
          />
          <Field
            label="Alt text"
            value={selected.alt}
            onChange={(alt) => setSelected({ ...selected, alt })}
          />
          <Field
            label="Caption"
            value={selected.caption}
            onChange={(caption) => setSelected({ ...selected, caption })}
          />
          <Field
            label="Folder / tag"
            value={selected.folder}
            onChange={(folder) => setSelected({ ...selected, folder })}
          />
          <p className="helper">
            {selected.type} · {formatBytes(selected.size)} · {selected.width} ×{" "}
            {selected.height}
            {selected.duration ? ` · ${Math.round(selected.duration)}s` : ""}
            <br />
            {selected.status}
          </p>
          <p className="helper">
            Used in:{" "}
            {docs
              .filter((d) => mediaIds(d.data).includes(selected.id))
              .map((d) => (d.data as Project).title)
              .join(", ") ||
              "No current drafts (published references are also checked before deletion)."}
          </p>
          <div className="button-row">
            <Button
              primary
              onClick={async () => {
                try {
                  await repo.saveMedia(selected);
                  await refresh();
                  setSelected(null);
                  notify("Asset details saved.");
                } catch (e) {
                  notify(textError(e));
                }
              }}
            >
              Save details
            </Button>
            <Button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(`media:${selected.id}`);
                  notify("Media reference copied.");
                } catch {
                  notify("Could not copy. Reference: media:" + selected.id);
                }
              }}
            >
              <LinkIcon size={14} />
              Copy reference
            </Button>
            <Button
              onClick={async () => {
                if (
                  !confirm(
                    "Delete this asset and its original file? This cannot be undone.",
                  )
                )
                  return;
                try {
                  await repo.deleteMedia(selected.id);
                  setSelected(null);
                  await refresh();
                  notify("Asset deleted.");
                } catch (e) {
                  notify(textError(e));
                }
              }}
            >
              <Trash2 size={14} />
              Delete
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
function formatBytes(n: number) {
  return n < 1024 * 1024
    ? `${Math.round(n / 1024)} KB`
    : `${(n / 1024 / 1024).toFixed(1)} MB`;
}
function Inquiries() {
  const { notify } = useStore();
  const [items, setItems] = useState<Inquiry[]>([]),
    [selected, setSelected] = useState<Inquiry | null>(null),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState("all");
  const refresh = () =>
    repo
      .loadInquiries()
      .then(setItems)
      .catch((e) => notify(textError(e)));
  useEffect(() => {
    void refresh();
  }, [notify]);
  async function update(i: Inquiry, remove = false) {
    if (remove && !confirm("Permanently delete this inquiry?")) return;
    try {
      await repo.updateInquiry(i, remove);
      setSelected(remove ? null : i);
      await refresh();
      notify(remove ? "Inquiry deleted." : "Inquiry updated.");
    } catch (e) {
      notify(textError(e));
    }
  }
  const filtered = items.filter(
    (i) =>
      (status === "all" || i.status === status) &&
      `${i.name} ${i.email} ${i.message}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <div className="eyebrow">Good things start with a conversation</div>
          <h1>Inquiries</h1>
          <p>Every brief, read properly.</p>
        </div>
        <Badge tone="green">
          <ShieldCheck size={13} />
          Private inbox
        </Badge>
      </div>
      <section className="admin-card">
        <div className="collection-toolbar">
          <div className="search-field">
            <Search size={16} />
            <input
              placeholder="Search inquiries…"
              aria-label="Search inquiries"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            aria-label="Inquiry status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {["all", "new", "read", "archived", "spam"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        {filtered.map((i) => (
          <button
            className="inquiry-row"
            key={i.id}
            onClick={() => {
              setSelected(i);
              if (i.status === "new") void update({ ...i, status: "read" });
            }}
          >
            <span className="inquiry-avatar">{i.name[0].toUpperCase()}</span>
            <div>
              <strong>{i.name}</strong>
              <small>
                {i.project_type} · {i.message.slice(0, 85)}
              </small>
            </div>
            <Badge tone={i.status === "new" ? "green" : "neutral"}>
              {i.status}
            </Badge>
            <span>{new Date(i.created_at).toLocaleDateString()}</span>
            <ChevronRight size={16} />
          </button>
        ))}
        {!filtered.length && (
          <Empty
            icon={Inbox}
            title="The next conversation is on its way"
            description="New project briefs from your website will appear here."
          />
        )}
      </section>
      {selected && (
        <Modal title={selected.name} onClose={() => setSelected(null)}>
          <div className="inquiry-detail">
            <a href={`mailto:${selected.email}`}>
              {selected.email} <ArrowUpRight size={14} />
            </a>
            <p>
              <strong>{selected.project_type}</strong> · {selected.budget}
            </p>
            <p className="inquiry-message">{selected.message}</p>
            <label className="admin-field">
              <span>Status</span>
              <select
                value={selected.status}
                onChange={(e) =>
                  void update({
                    ...selected,
                    status: e.target.value as Inquiry["status"],
                  })
                }
              >
                {["new", "read", "archived", "spam"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <Button onClick={() => void update(selected, true)}>
              <Trash2 size={14} />
              Delete inquiry
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
function UsersAccess() {
  const { notify, role } = useStore();
  const [items, setItems] = useState<Member[]>([]),
    [email, setEmail] = useState(""),
    [inviteRole, setInviteRole] = useState<"owner" | "editor">("editor"),
    [busy, setBusy] = useState(false);
  const refresh = () =>
    repo
      .members()
      .then(setItems)
      .catch((e) => notify(textError(e)));
  useEffect(() => {
    void refresh();
  }, [notify]);
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <div className="eyebrow">A trusted circle</div>
          <h1>Users & access</h1>
          <p>The right people, with the right permissions.</p>
        </div>
        <ShieldCheck size={23} />
      </div>
      <section className="admin-card">
        <h2>Invite a collaborator</h2>
        <p className="helper">
          Invitees can use their invitation link or a GitHub account with this
          verified email address.
        </p>
        <form
          className="invite-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              const message = await repo.invite(email, inviteRole);
              notify(message);
              setEmail("");
              await refresh();
            } catch (e) {
              notify(textError(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field
            label="Email address"
            type="email"
            value={email}
            onChange={setEmail}
          />
          <label className="admin-field">
            <span>Role</span>
            <select
              value={inviteRole}
              onChange={(e) =>
                setInviteRole(e.target.value as "owner" | "editor")
              }
            >
              <option value="editor">Editor</option>
              <option value="owner">Owner</option>
            </select>
          </label>
          <Button
            primary
            type="submit"
            disabled={busy || role !== "owner" || !email}
          >
            Send invitation <ArrowUpRight size={14} />
          </Button>
        </form>
        {repo.demo && (
          <p className="demo-note">
            Invitations are disabled in the local demo. Connect Supabase to
            invite real users.
          </p>
        )}
      </section>
      <section className="admin-card">
        <h2>Studio members</h2>
        {items.map((m) => (
          <div className="member-row" key={m.user_id}>
            <div className="inquiry-avatar">{m.email[0].toUpperCase()}</div>
            <div>
              <strong>{m.email}</strong>
              <small>
                Joined {new Date(m.created_at).toLocaleDateString()}
              </small>
            </div>
            <select
              aria-label={`Role for ${m.email}`}
              value={m.role}
              disabled={role !== "owner" || repo.demo}
              onChange={async (e) => {
                try {
                  await repo.changeRole(
                    m.user_id,
                    e.target.value as "owner" | "editor",
                  );
                  await refresh();
                  notify("Role updated.");
                } catch (e) {
                  notify(textError(e));
                }
              }}
            >
              <option value="owner">Owner</option>
              <option value="editor">Editor</option>
            </select>
            <button
              className="icon-btn"
              aria-label={`Revoke access for ${m.email}`}
              disabled={repo.demo || role !== "owner"}
              onClick={async () => {
                if (!confirm(`Revoke ${m.email}'s access to the workspace?`))
                  return;
                try {
                  await repo.revokeAccess(m.user_id);
                  await refresh();
                  notify("Workspace access revoked.");
                } catch (e) {
                  notify(textError(e));
                }
              }}
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </section>
      <section className="admin-card role-explanation">
        <div>
          <h3>Owner</h3>
          <p>
            Manage all content, site settings, inquiries, backups, and team
            access.
          </p>
        </div>
        <div>
          <h3>Editor</h3>
          <p>
            Create and publish projects and pages, manage media, and read
            inquiries. Cannot change site settings or grant access.
          </p>
        </div>
      </section>
    </>
  );
}
function Activity() {
  const { notify } = useStore();
  const [items, setItems] = useState<Revision[]>([]);
  useEffect(() => {
    repo
      .revisions()
      .then(setItems)
      .catch((e) => notify(textError(e)));
  }, [notify]);
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <div className="eyebrow">Every change has a story</div>
          <h1>Activity & history</h1>
          <p>
            The latest 100 saves and publications. Restore revisions inside each
            content editor.
          </p>
        </div>
      </div>
      <section className="admin-card activity-list">
        {items.map((r) => (
          <div key={r.id}>
            <span className="activity-icon">
              <History size={16} />
            </span>
            <div>
              <strong>
                {(r.data as Project).title} · {r.action}
              </strong>
              <small>
                {new Date(r.created_at).toLocaleString()} · {r.actor} · Version{" "}
                {r.version}
              </small>
            </div>
            <a
              className="admin-btn"
              href={`#/admin/${r.document_id === "site-settings" ? "settings" : "slug" in r.data && "client" in r.data ? "projects" : "pages"}/${r.document_id}`}
            >
              Open editor <ArrowUpRight size={14} />
            </a>
          </div>
        ))}
        {!items.length && (
          <Empty
            icon={History}
            title="A clean slate"
            description="Saves and published changes will appear here."
          />
        )}
      </section>
    </>
  );
}
function SearchResults({ query }: { query: string }) {
  const { docs } = useStore();
  const filtered = docs.filter((d) =>
    JSON.stringify(d.data).toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <h1>Search results</h1>
          <p>
            {filtered.length} results for “{query}”
          </p>
        </div>
      </div>
      <section className="admin-card">
        {filtered.map((d) => (
          <a
            className="search-result"
            key={d.id}
            href={`#/admin/${d.kind === "settings" ? "settings" : d.kind === "project" ? "projects" : "pages"}/${d.id}`}
          >
            <FileText size={18} />
            <span>
              <strong>{(d.data as Project).title}</strong>
              <small>{d.kind}</small>
            </span>
            <ArrowUpRight size={16} />
          </a>
        ))}
        {!filtered.length && (
          <Empty
            icon={Search}
            title="No matching frames"
            description="Try a project title, category, page name, or phrase."
          />
        )}
      </section>
    </>
  );
}
function AccessGate() {
  const { loading, error, refresh } = useStore();
  const [busy, setBusy] = useState(false),
    [loginError, setLoginError] = useState("");
  if (loading) return <div className="boot">Opening the studio…</div>;
  return (
    <div className="admin-login">
      <a href="#/" className="login-wordmark">
        H<span>STUDIO ACCESS</span>
      </a>
      <section className="login-card">
        <div className="login-symbol">
          <ShieldCheck size={30} />
        </div>
        <span className="eyebrow">Behind the frames</span>
        <h1>
          A space for
          <br />
          your next idea.
        </h1>
        <p>
          {repo.configured
            ? "Sign in with your authorized GitHub account to manage the portfolio."
            : "The website is ready to connect. Set up Supabase to enable secure publishing, shared content, and uploads."}
        </p>
        {(error || loginError) && (
          <div className="alert" role="alert">
            {error || loginError}
          </div>
        )}
        {repo.configured ? (
          <>
            <Button
              primary
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await repo.login();
                } catch (e) {
                  setLoginError(textError(e));
                  setBusy(false);
                }
              }}
            >
              Continue with GitHub <ArrowUpRight size={17} />
            </Button>
            <Button onClick={() => void refresh()}>Check my access</Button>
            <p className="helper">
              Signed in but still here? An owner needs to grant this account
              access.
            </p>
          </>
        ) : (
          <SetupCard />
        )}
        <a className="back-portfolio" href="#/">
          ← Back to the portfolio
        </a>
      </section>
    </div>
  );
}
export default function Admin({ route }: { route: string }) {
  const { settings: s, role, loading, error, notify } = useStore();
  const [menu, setMenu] = useState(false),
    [search, setSearch] = useState("");
  const [mobile, setMobile] = useState(matchMedia("(max-width:760px)").matches);
  useEffect(() => {
    const media = matchMedia("(max-width:760px)");
    const change = () => setMobile(media.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    if (!menu) return;
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(false);
    };
    document.addEventListener("keydown", close);
    if (mobile)
      (
        document.querySelector(".admin-sidebar nav a") as HTMLElement | null
      )?.focus();
    return () => document.removeEventListener("keydown", close);
  }, [menu, mobile]);
  const parts = route.split("?")[0].split("/");
  const section = parts[2] || "overview",
    id = parts[3];
  useEffect(() => {
    document.title = `Studio — ${s.title}`;
    let meta = document.querySelector('meta[name="robots"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "robots");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", "noindex,nofollow");
  }, [s.title]);
  useEffect(() => setMenu(false), [route]);
  if (loading) return <div className="boot">Opening the studio…</div>;
  if (!role) return <AccessGate />;
  const ownerOnly = ["settings", "homepage", "users"];
  const forbidden = ownerOnly.includes(section) && role !== "owner";
  let content: ReactNode;
  if (forbidden)
    content = (
      <Empty
        icon={ShieldCheck}
        title="Owner access required"
        description="Your editor role does not include this area."
      />
    );
  else if (section === "overview") content = <Overview />;
  else if (["projects", "pages"].includes(section))
    content = id ? (
      <Editor
        key={id}
        kind={section === "projects" ? "project" : "page"}
        id={id}
      />
    ) : (
      <Collection
        key={section}
        kind={section === "projects" ? "project" : "page"}
      />
    );
  else if (section === "settings" || section === "homepage")
    content = (
      <Editor
        key={section}
        kind="settings"
        id="site-settings"
        initialTab={section === "homepage" ? "homepage" : "identity"}
      />
    );
  else if (section === "media") content = <MediaLibrary />;
  else if (section === "inquiries") content = <Inquiries />;
  else if (section === "users") content = <UsersAccess />;
  else if (section === "history") content = <Activity />;
  else if (section === "search")
    content = (
      <SearchResults
        query={new URLSearchParams(route.split("?")[1]).get("q") ?? ""}
      />
    );
  else
    content = (
      <Empty
        title="Page not found"
        description="Choose a section from the sidebar."
      />
    );
  return (
    <div className="admin-shell">
      <a
        className="skip-link"
        href="#admin-main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("admin-main")?.focus();
        }}
      >
        Skip to workspace
      </a>
      <aside
        className={`admin-sidebar ${menu ? "open" : ""}`}
        inert={mobile && !menu}
        aria-hidden={mobile && !menu}
        role={mobile ? "dialog" : undefined}
        aria-modal={mobile && menu ? true : undefined}
        aria-label="Studio navigation"
      >
        {mobile && (
          <button
            className="icon-btn drawer-close"
            aria-label="Close studio navigation"
            onClick={() => setMenu(false)}
          >
            <X size={20} />
          </button>
        )}
        <a className="sidebar-brand" href="#/admin">
          <span className="brand-square">
            H<span />
          </span>
          <div>
            <strong>{s.title}</strong>
            <small>Your creative workspace</small>
          </div>
        </a>
        <form
          className="sidebar-search"
          onSubmit={(e) => {
            e.preventDefault();
            location.hash = `/admin/search?q=${encodeURIComponent(search)}`;
          }}
        >
          <Search size={15} />
          <input
            aria-label="Search all content"
            placeholder="Search anything…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <kbd>↵</kbd>
        </form>
        <span className="sidebar-label">Workspace</span>
        <nav aria-label="Admin navigation">
          {nav
            .filter(([k]) => role === "owner" || !ownerOnly.includes(k))
            .map(([key, label, Icon]) => (
              <a
                key={key}
                className={section === key ? "active" : ""}
                href={`#/admin/${key}`}
              >
                <Icon size={17} />
                <span>{label}</span>
                {section === key && <ChevronRight size={13} />}
              </a>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <a href="#/" target="_blank" rel="noreferrer">
            <Globe size={16} />
            View live website
            <ArrowUpRight size={14} />
          </a>
          <div className="sidebar-connection">
            <span className={repo.demo ? "demo-pip" : "status-dot"} />
            <span>
              {repo.demo ? "Local demonstration" : "Supabase configured"}
            </span>
          </div>
          <div className="sidebar-profile">
            <span className="profile-avatar">{s.monogram}</span>
            <div>
              <strong>{s.name}</strong>
              <small>{role === "owner" ? "Studio owner" : "Editor"}</small>
            </div>
            {!repo.demo && (
              <button
                className="icon-btn"
                aria-label="Sign out"
                onClick={async () => {
                  await repo.logout();
                  location.reload();
                }}
              >
                <LogOut size={15} />
              </button>
            )}
          </div>
        </div>
      </aside>
      {menu && (
        <button
          className="sidebar-scrim"
          aria-label="Close sidebar"
          onClick={() => setMenu(false)}
        />
      )}
      <div className="admin-workspace" inert={mobile && menu}>
        <header className="admin-topbar">
          <div>
            <button
              className="admin-mobile-menu icon-btn"
              aria-label="Toggle sidebar"
              onClick={() => setMenu(!menu)}
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>
              {nav.find((n) => n[0] === section)?.[1] || "Search"}
            </strong>
          </div>
          <div>
            <span className="draft-live">
              <span className="status-dot" />
              {repo.demo ? "Demo workspace" : "Connected workspace"}
            </span>
            <a href="#/" target="_blank" rel="noreferrer">
              View website <ArrowUpRight size={14} />
            </a>
          </div>
        </header>
        <div className="workspace-identity">
          <div className="workspace-icon">
            {s.monogram}
            <span />
          </div>
          <div>
            <h2>
              {s.title}
              <span className="identity-star">✧</span>
            </h2>
            <p>Your work deserves a beautiful place to live.</p>
            <span>
              {repo.demo
                ? "A private local demonstration"
                : "Your portfolio content workspace"}
            </span>
          </div>
          <a href="#/" className="admin-btn" target="_blank" rel="noreferrer">
            <ExternalLink size={15} />
            Visit portfolio
          </a>
        </div>
        <main className="admin-content" id="admin-main" tabIndex={-1}>
          {error && (
            <div className="alert" role="alert">
              {error}
            </div>
          )}
          {content}
        </main>
        <footer className="admin-workspace-footer">
          <span>{s.title} · Your work. In motion.</span>
          <button
            onClick={() =>
              notify(
                repo.demo
                  ? "Local demo. Follow README.md to connect Supabase and publish to GitHub Pages."
                  : "Content saves to Supabase. See README.md for backup and deployment instructions.",
              )
            }
          >
            Workspace help <ArrowUpRight size={12} />
          </button>
        </footer>
      </div>
    </div>
  );
}
