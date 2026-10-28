import {
  serve,
  response,
  service,
  staff,
  json,
  uuid,
  assertDb,
} from "../_shared/http.ts";
serve(async (req) => {
  const { ids, admin } = await json(req);
  if (
    !Array.isArray(ids) ||
    ids.length > 500 ||
    ids.some((id) => typeof id !== "string" || !uuid(id))
  )
    throw new Error("Invalid media IDs");
  const db = service();
  let paths: { id: string; path: string }[] = [];
  if (admin) {
    await staff(req);
    const result = await db.from("media").select("id,path").in("id", ids);
    assertDb(result.error);
    paths = result.data ?? [];
  } else {
    const result = await db.rpc("public_media_paths", { p_ids: ids });
    assertDb(result.error);
    paths = result.data ?? [];
  }
  const metadata = await db
    .from("media")
    .select("id,alt,caption,width,variants")
    .in(
      "id",
      paths.map((m) => m.id),
    );
  assertDb(metadata.error);
  const entries = paths.flatMap((m) => [
    { key: m.id, path: m.path },
    ...Object.entries(
      metadata.data?.find((a) => a.id === m.id)?.variants ?? {},
    ).map(([w, path]) => ({ key: m.id + ":" + w, path: String(path) })),
  ]);
  const signed = await db.storage.from("portfolio-private").createSignedUrls(
    entries.map((m) => m.path),
    3600,
  );
  assertDb(signed.error);
  const urls = Object.fromEntries(
    entries
      .map((m, i) => [m.key, signed.data?.[i]?.signedUrl])
      .filter(([, url]) => url),
  );
  const meta = Object.fromEntries(
    (metadata.data ?? []).map((m) => [
      m.id,
      { alt: m.alt, caption: m.caption, width: m.width },
    ]),
  );
  return response(req, { urls, meta });
});
