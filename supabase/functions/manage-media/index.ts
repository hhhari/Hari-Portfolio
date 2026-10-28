import {
  serve,
  response,
  staff,
  assertDb,
  uuid,
  json,
} from "../_shared/http.ts";
import { sniff } from "../_shared/file.ts";
interface UploadObject {
  slot: string;
  path: string;
  type: string;
  size: number;
}
const allowed = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "video/mp4",
  "video/webm",
  "application/pdf",
  "text/vtt",
];
serve(async (req) => {
  const { db, user } = await staff(req);
  const body = await json(req, 10000);
  const bucket = db.storage.from("portfolio-private");
  if (body.action === "delete") {
    if (!uuid(body.id)) throw new Error("Invalid asset");
    const usage = await db.rpc("media_in_use", { p_id: body.id });
    assertDb(usage.error);
    if (usage.data)
      throw new Error(
        "Remove the asset from drafts and published content before deleting it",
      );
    const result = await db
      .from("media")
      .select("*")
      .eq("id", body.id)
      .single();
    assertDb(result.error);
    if (!result.data) throw new Error("Asset not found");
    assertDb(
      (
        await bucket.remove(
          [
            result.data.path,
            result.data.original_path,
            ...Object.values(result.data.variants ?? {}),
          ].filter(Boolean),
        )
      ).error,
    );
    assertDb((await db.from("media").delete().eq("id", body.id)).error);
    return response(req, { ok: true });
  }
  if (body.action === "begin") {
    if (
      !Array.isArray(body.files) ||
      body.files.length < 1 ||
      body.files.length > 4
    )
      throw new Error("Invalid upload");
    const slots = new Set<string>();
    for (const f of body.files) {
      if (
        !["file", "original", "variant-640", "variant-1200"].includes(f.slot) ||
        slots.has(f.slot) ||
        !allowed.includes(f.type) ||
        !Number.isInteger(f.size) ||
        f.size < 1 ||
        f.size > 104857600
      )
        throw new Error("Invalid file");
      if (f.slot !== "file" && !f.type.startsWith("image/"))
        throw new Error("Derivatives must be images");
      if (
        f.slot.startsWith("variant-") &&
        (f.type !== "image/webp" || f.size > 5242880)
      )
        throw new Error("Invalid derivative");
      slots.add(f.slot);
    }
    if (!slots.has("file")) throw new Error("Missing delivery file");
    const stale = await db
      .from("upload_sessions")
      .select("id,objects")
      .lt("expires_at", new Date().toISOString())
      .limit(10);
    for (const old of stale.data ?? []) {
      await bucket.remove((old.objects as UploadObject[]).map((o) => o.path));
      await db.from("upload_sessions").delete().eq("id", old.id);
    }
    const id = crypto.randomUUID();
    const objects: UploadObject[] = body.files.map(
      (f: { slot: string; type: string; size: number }) => ({
        ...f,
        path: `uploads/${id}/${f.slot}.${f.type.split("/")[1].replace("jpeg", "jpg")}`,
      }),
    );
    assertDb(
      (
        await db
          .from("upload_sessions")
          .insert({
            id,
            owner: user.id,
            objects,
            metadata: body.metadata ?? {},
            expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          })
      ).error,
    );
    const targets = [];
    for (const o of objects) {
      const result = await bucket.createSignedUploadUrl(o.path, {
        upsert: false,
      });
      assertDb(result.error);
      targets.push({ slot: o.slot, url: result.data!.signedUrl });
    }
    return response(req, { id, targets });
  }
  if (!["finalize", "cancel"].includes(body.action) || !uuid(body.id))
    throw new Error("Invalid action");
  const session = await db
    .from("upload_sessions")
    .select("*")
    .eq("id", body.id)
    .eq("owner", user.id)
    .single();
  assertDb(session.error);
  if (!session.data) throw new Error("Upload session not found");
  const objects = session.data.objects as UploadObject[];
  if (body.action === "cancel") {
    await bucket.remove(objects.map((o) => o.path));
    await db.from("upload_sessions").delete().eq("id", body.id);
    return response(req, { ok: true });
  }
  if (new Date(session.data.expires_at) < new Date())
    throw new Error("Upload expired. Retry the file.");
  // Bytes move directly from browser to private storage. Only bounded header samples enter the function.
  const listing = await bucket.list(`uploads/${body.id}`, { limit: 10 });
  assertDb(listing.error);
  for (const o of objects) {
    const stored = listing.data?.find(
      (f) => f.name === o.path.split("/").at(-1),
    );
    if (
      !stored ||
      Number(stored.metadata?.size) !== o.size ||
      stored.metadata?.mimetype !== o.type
    )
      throw new Error("Uploaded file metadata does not match");
    const signed = await bucket.createSignedUrl(o.path, 60);
    assertDb(signed.error);
    const result = await fetch(signed.data!.signedUrl, {
      headers: { Range: "bytes=0-63" },
    });
    if (!result.ok || !result.body)
      throw new Error("Could not validate uploaded file");
    const reader = result.body.getReader();
    const { value } = await reader.read();
    await reader.cancel();
    if (!value || (await sniff(new Blob([value.slice(0, 64)]))) !== o.type)
      throw new Error("File type does not match its contents");
  }
  const metadata = session.data.metadata;
  const bounded = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) && v >= 0
      ? Math.min(100000, v)
      : 0;
  const delivery = objects.find((o) => o.slot === "file")!;
  const variants = Object.fromEntries(
    objects
      .filter((o) => o.slot.startsWith("variant-"))
      .map((o) => [o.slot.slice(8), o.path]),
  );
  const media = {
    id: body.id,
    name: String(metadata.name ?? "Untitled asset").slice(0, 255),
    path: delivery.path,
    original_path: objects.find((o) => o.slot === "original")?.path ?? null,
    variants,
    type: delivery.type,
    size: delivery.size,
    width: Math.round(bounded(metadata.width)),
    height: Math.round(bounded(metadata.height)),
    duration: bounded(metadata.duration),
    alt: "",
    caption: "",
    folder: "Uploads",
    status: delivery.type.startsWith("video/")
      ? "Original video · optimize before upload"
      : "Ready",
  };
  const inserted = await db.from("media").insert(media).select().single();
  assertDb(inserted.error);
  await db.from("upload_sessions").delete().eq("id", body.id);
  return response(req, { media: inserted.data });
});
