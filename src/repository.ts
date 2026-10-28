import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { mediaIds, uid, validateDoc } from "./content";
import * as local from "./db";
import type {
  ContentDoc,
  Inquiry,
  Media,
  Member,
  Revision,
  Role,
} from "./types";
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const configured = Boolean(url && key);
export const demo =
  !configured &&
  (["localhost", "127.0.0.1", "[::1]"].includes(location.hostname) ||
    import.meta.env.VITE_ENABLE_DEMO === "true");
export const supabase: SupabaseClient | null = configured
  ? createClient(url, key, {
      auth: {
        flowType: "pkce",
        detectSessionInUrl: false,
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;
function checked<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data;
}
export async function authInit() {
  if (!supabase) return;
  const q = new URL(location.href);
  const fragment = new URLSearchParams(q.hash.slice(1));
  if (fragment.has("access_token") && fragment.has("refresh_token")) {
    const { error } = await supabase.auth.setSession({
      access_token: fragment.get("access_token")!,
      refresh_token: fragment.get("refresh_token")!,
    });
    if (error) throw error;
    q.hash = "/admin";
    history.replaceState(null, "", q);
  }
  if (q.searchParams.has("code")) {
    const { error } = await supabase.auth.exchangeCodeForSession(
      q.searchParams.get("code")!,
    );
    if (error) throw error;
    q.searchParams.delete("code");
    q.hash = "/admin";
    history.replaceState(null, "", q);
  }
  if (
    q.searchParams.has("error_description") ||
    fragment.has("error_description")
  )
    throw new Error(
      q.searchParams.get("error_description") ||
        fragment.get("error_description")!,
    );
}
export async function getRole(): Promise<Role | null> {
  if (demo) return "owner";
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  checked(await supabase.rpc("claim_invitation"));
  const r = await supabase
    .from("members")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  return checked(r)?.role ?? null;
}
export async function login() {
  if (!supabase) throw new Error("Connect Supabase first.");
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: { redirectTo: location.origin + import.meta.env.BASE_URL },
  });
  if (error) throw error;
}
export async function logout() {
  if (supabase) await supabase.auth.signOut();
}
export async function loadDocs(admin = false): Promise<ContentDoc[]> {
  if (demo) {
    await local.initDemo();
    return local.readAll<ContentDoc>(admin ? "docs" : "published");
  }
  if (!supabase) return [];
  return (
    checked(
      await supabase
        .from(admin ? "documents" : "published_documents")
        .select("*")
        .order("updated_at", { ascending: false }),
    ) ?? []
  );
}
export async function saveDoc(
  doc: ContentDoc,
  publish = false,
): Promise<ContentDoc> {
  validateDoc(doc);
  if (demo) return local.saveDemo(doc, publish);
  if (!supabase) throw new Error("Backend is not configured.");
  return checked(
    await supabase.rpc("save_document", {
      p_id: doc.id,
      p_kind: doc.kind,
      p_data: doc.data,
      p_version: doc.version,
      p_publish: publish,
    }),
  ) as ContentDoc;
}
export async function docAction(
  id: string,
  action: "unpublish" | "archive" | "restore" | "delete",
) {
  if (demo) {
    const docs = await local.readAll<ContentDoc>("docs");
    const d = docs.find((d) => d.id === id);
    if (!d) return;
    if (action === "delete") {
      await local.remove("docs", id);
      await local.remove("published", id);
    } else {
      if (action !== "restore") await local.remove("published", id);
      await local.put("docs", {
        ...d,
        published: action === "restore" ? d.published : false,
        archived: action === "archive",
        version: d.version + 1,
        updated_at: new Date().toISOString(),
      });
    }
    return;
  }
  checked(
    await supabase!.rpc("document_action", { p_id: id, p_action: action }),
  );
}
export async function revisions(id?: string): Promise<Revision[]> {
  if (demo)
    return (await local.readAll<Revision>("revisions"))
      .filter((r) => !id || r.document_id === id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  let q = supabase!
    .from("revisions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (id) q = q.eq("document_id", id);
  return checked(await q) ?? [];
}
export async function loadMedia(): Promise<Media[]> {
  if (demo) return local.readAll<Media>("media");
  return (
    checked(
      await supabase!
        .from("media")
        .select("*")
        .order("created_at", { ascending: false }),
    ) ?? []
  );
}
export async function saveMedia(m: Media) {
  if (demo) {
    const old = (await local.readAll<Media & { blob: Blob }>("media")).find(
      (x) => x.id === m.id,
    );
    await local.put("media", { ...old, ...m });
    return;
  }
  checked(
    await supabase!
      .from("media")
      .update({
        name: m.name,
        alt: m.alt,
        caption: m.caption,
        folder: m.folder,
      })
      .eq("id", m.id),
  );
}
export async function deleteMedia(id: string) {
  if (demo) {
    const docs = await local.readAll<ContentDoc>("docs");
    const pub = await local.readAll<ContentDoc>("published");
    if ([...docs, ...pub].some((d) => mediaIds(d.data).includes(id)))
      throw new Error("Remove this asset from content before deleting it.");
    await local.remove("media", id);
    return;
  }
  checked(
    await supabase!.functions.invoke("manage-media", {
      body: { action: "delete", id },
    }),
  );
}
export interface ResolvedMedia {
  urls: Record<string, string>;
  meta: Record<string, { alt: string; caption: string; width: number }>;
}
export async function resolveMedia(
  ids: string[],
  admin = false,
): Promise<ResolvedMedia> {
  if (!ids.length) return { urls: {}, meta: {} };
  if (demo) {
    const list = await local.readAll<
      Media & { blob: Blob; derivatives?: Record<string, Blob> }
    >("media");
    const urls: Record<string, string> = {},
      meta: ResolvedMedia["meta"] = {};
    for (const m of list.filter((m) => ids.includes(m.id) && m.blob)) {
      urls[m.id] = URL.createObjectURL(m.blob);
      for (const [w, blob] of Object.entries(m.derivatives ?? {}))
        urls[`${m.id}:${w}`] = URL.createObjectURL(blob);
      meta[m.id] = { alt: m.alt, caption: m.caption, width: m.width };
    }
    return { urls, meta };
  }
  if (!supabase) return { urls: {}, meta: {} };
  const result = checked(
    await supabase.functions.invoke("resolve-media", { body: { ids, admin } }),
  );
  return { urls: result.urls ?? {}, meta: result.meta ?? {} };
}
export async function mediaUrls(ids: string[], admin = false) {
  return (await resolveMedia(ids, admin)).urls;
}
export async function upload(
  file: File,
  onProgress: (p: number) => void,
  signal: AbortSignal,
): Promise<Media> {
  if (signal.aborted) throw new Error("Upload cancelled");
  if (
    ![
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/avif",
      "video/mp4",
      "video/webm",
      "application/pdf",
      "text/vtt",
    ].includes(file.type)
  )
    throw new Error("Use JPG, PNG, WebP, AVIF, MP4, WebM, PDF, or VTT.");
  if (file.size > 100 * 1024 * 1024)
    throw new Error("Maximum file size is 100 MB.");
  let width = 0,
    height = 0,
    duration = 0;
  let delivery: Blob = file;
  const derivatives: Record<string, Blob> = {};
  if (file.type.startsWith("image/")) {
    const bitmap = await createImageBitmap(file);
    width = bitmap.width;
    height = bitmap.height;
    if (!file.type.includes("avif")) {
      const ratio = Math.min(1, 2200 / width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas
        .getContext("2d")!
        .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((r) =>
        canvas.toBlob(r, "image/webp", 0.85),
      );
      if (blob && blob.size < file.size) delivery = blob;
    }
    for (const size of [640, 1200]) {
      if (bitmap.width <= size) continue;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = Math.round((bitmap.height * size) / bitmap.width);
      canvas
        .getContext("2d")!
        .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const small = await new Promise<Blob | null>((r) =>
        canvas.toBlob(r, "image/webp", 0.8),
      );
      if (small) derivatives[String(size)] = small;
    }
    bitmap.close();
  }
  if (file.type.startsWith("video/")) {
    const objectUrl = URL.createObjectURL(file);
    try {
      const el = document.createElement("video");
      el.preload = "metadata";
      el.src = objectUrl;
      await new Promise<void>((resolve, reject) => {
        el.onloadedmetadata = () => {
          width = el.videoWidth;
          height = el.videoHeight;
          duration = Number.isFinite(el.duration) ? el.duration : 0;
          resolve();
        };
        el.onerror = () =>
          reject(
            new Error(
              "This video cannot be decoded. Export a browser-compatible MP4 or WebM.",
            ),
          );
      });
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }
  const m: Media = {
    id: uid(),
    name: file.name,
    path: "",
    type: delivery.type,
    size: delivery.size,
    width,
    height,
    duration,
    alt: "",
    caption: "",
    folder: "Uploads",
    status: file.type.startsWith("video/")
      ? "Original video · optimize before upload"
      : "Ready",
    created_at: new Date().toISOString(),
  };
  if (demo) {
    onProgress(30);
    if (signal.aborted) throw new Error("Upload cancelled");
    await local.put("media", {
      ...m,
      blob: delivery,
      original: file,
      derivatives,
    });
    onProgress(100);
    return m;
  }
  const files: Record<string, Blob> = { file: delivery };
  if (delivery !== file) files.original = file;
  for (const [w, blob] of Object.entries(derivatives))
    files["variant-" + w] = blob;
  const started = checked(
    await supabase!.functions.invoke("manage-media", {
      body: {
        action: "begin",
        metadata: m,
        files: Object.entries(files).map(([slot, blob]) => ({
          slot,
          type: blob.type,
          size: blob.size,
        })),
      },
    }),
  ) as { id: string; targets: { slot: string; url: string }[] };
  const total = Object.values(files).reduce((n, b) => n + b.size, 0);
  let completed = 0;
  try {
    for (const target of started.targets) {
      if (signal.aborted) throw new Error("Upload cancelled");
      const blob = files[target.slot];
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", target.url);
        xhr.setRequestHeader("Content-Type", blob.type);
        xhr.setRequestHeader("x-upsert", "false");
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable)
            onProgress(
              Math.min(95, Math.round(((completed + e.loaded) / total) * 95)),
            );
        };
        const abort = () => xhr.abort();
        xhr.onload = () => {
          signal.removeEventListener("abort", abort);
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error("Storage upload failed. Please retry."));
        };
        xhr.onerror = () => {
          signal.removeEventListener("abort", abort);
          reject(new Error("Upload interrupted. Please retry."));
        };
        xhr.onabort = () => {
          signal.removeEventListener("abort", abort);
          reject(new Error("Upload cancelled"));
        };
        signal.addEventListener("abort", abort, { once: true });
        xhr.send(blob);
      });
      completed += blob.size;
    }
    if (signal.aborted) throw new Error("Upload cancelled");
    const result = checked(
      await supabase!.functions.invoke("manage-media", {
        body: { action: "finalize", id: started.id },
      }),
    );
    onProgress(100);
    return result.media;
  } catch (e) {
    await supabase!.functions.invoke("manage-media", {
      body: { action: "cancel", id: started.id },
    });
    throw e;
  }
}
export async function loadInquiries(): Promise<Inquiry[]> {
  if (demo)
    return (await local.readAll<Inquiry>("inquiries")).sort((a, b) =>
      b.created_at.localeCompare(a.created_at),
    );
  return (
    checked(
      await supabase!
        .from("inquiries")
        .select("*")
        .order("created_at", { ascending: false }),
    ) ?? []
  );
}
export async function submitInquiry(data: Record<string, string>) {
  if (demo) {
    await local.put("inquiries", {
      ...data,
      id: uid(),
      status: "new",
      created_at: new Date().toISOString(),
    });
    return;
  }
  if (!supabase)
    throw new Error(
      "Contact form setup is pending. Please use the email link.",
    );
  checked(await supabase.functions.invoke("submit-inquiry", { body: data }));
}
export async function updateInquiry(i: Inquiry, remove = false) {
  if (demo) {
    if (remove) await local.remove("inquiries", i.id);
    else await local.put("inquiries", i);
    return;
  }
  checked(
    remove
      ? await supabase!.from("inquiries").delete().eq("id", i.id)
      : await supabase!
          .from("inquiries")
          .update({ status: i.status })
          .eq("id", i.id),
  );
}
export async function members(): Promise<Member[]> {
  if (demo) return local.readAll<Member>("members");
  return checked(await supabase!.from("members").select("*")) ?? [];
}
export async function invite(email: string, role: Role) {
  if (demo) throw new Error("Invitations require a connected backend.");
  const result = checked(
    await supabase!.functions.invoke("manage-members", {
      body: { email, role, action: "invite" },
    }),
  );
  return String(result.message || "Invitation sent.");
}
export async function changeRole(id: string, role: Role) {
  if (demo) throw new Error("Member management requires a connected backend.");
  checked(
    await supabase!.functions.invoke("manage-members", {
      body: { id, role, action: "role" },
    }),
  );
}
export async function revokeAccess(id: string) {
  if (demo) throw new Error("Member management requires a connected backend.");
  checked(
    await supabase!.functions.invoke("manage-members", {
      body: { id, role: "editor", action: "remove" },
    }),
  );
}
export async function backup() {
  if (demo) return local.exportDemo();
  const [documents, media, inq, rev, mem] = await Promise.all([
    loadDocs(true),
    loadMedia(),
    loadInquiries(),
    revisions(),
    members(),
  ]);
  return {
    format: "kinetic-content-v1",
    created_at: new Date().toISOString(),
    documents,
    media,
    inquiries: inq,
    revisions: rev,
    members: mem,
  };
}
