import { seeds, validateDoc } from "./content";
import type { ContentDoc, Inquiry, Media, Member, Revision } from "./types";
type Store =
  "docs" | "published" | "media" | "inquiries" | "revisions" | "members";
let opening: Promise<IDBDatabase> | undefined;
function db() {
  return (opening ??= new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open("kinetic-demo-v1", 1);
    req.onupgradeneeded = () => {
      for (const s of [
        "docs",
        "published",
        "media",
        "inquiries",
        "revisions",
        "members",
      ])
        req.result.createObjectStore(s, {
          keyPath: s === "members" ? "user_id" : "id",
        });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
}
export async function readAll<T>(store: Store): Promise<T[]> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const req = database.transaction(store).objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
export async function put(store: Store, value: unknown) {
  const database = await db();
  return new Promise<void>((resolve, reject) => {
    const tx = database.transaction(store, "readwrite");
    tx.objectStore(store).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
export async function remove(store: Store, id: string) {
  const database = await db();
  return new Promise<void>((resolve, reject) => {
    const tx = database.transaction(store, "readwrite");
    tx.objectStore(store).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
export async function initDemo() {
  if (!(await readAll("docs")).length) {
    const docs = seeds();
    for (const d of docs) {
      await put("docs", d);
      await put("published", d);
    }
    await put("members", {
      user_id: "demo-owner",
      email: "local-demo@example.com",
      role: "owner",
      created_at: new Date().toISOString(),
    });
  }
}
// The version check and write share one transaction so two tabs cannot silently overwrite.
export async function saveDemo(
  doc: ContentDoc,
  publish = false,
): Promise<ContentDoc> {
  validateDoc(doc);
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(
      ["docs", "published", "revisions"],
      "readwrite",
    );
    const docs = tx.objectStore("docs");
    const req = docs.get(doc.id);
    let next: ContentDoc;
    req.onsuccess = () => {
      const current = req.result as ContentDoc | undefined;
      if (current && current.version !== doc.version) {
        tx.abort();
        reject(
          new Error(
            "This content changed in another session. Reload before saving.",
          ),
        );
        return;
      }
      next = {
        ...doc,
        version: (current?.version ?? 0) + 1,
        updated_at: new Date().toISOString(),
        published: publish || current?.published || false,
      };
      docs.put(next);
      if (publish) tx.objectStore("published").put(next);
      tx.objectStore("revisions").put({
        id: crypto.randomUUID(),
        document_id: doc.id,
        data: doc.data,
        version: next.version,
        created_at: next.updated_at,
        actor: "Local demo owner",
        action: publish ? "published" : "saved",
      });
    };
    tx.oncomplete = () => resolve(next);
    tx.onerror = () => reject(tx.error);
  });
}
export async function exportDemo() {
  const [docs, media, inquiries, revisions, members] = await Promise.all([
    readAll<ContentDoc>("docs"),
    readAll<Media>("media"),
    readAll<Inquiry>("inquiries"),
    readAll<Revision>("revisions"),
    readAll<Member>("members"),
  ]);
  return {
    format: "kinetic-content-v1",
    created_at: new Date().toISOString(),
    documents: docs,
    media: media.map(({ ...m }) => ({
      ...m,
      url: undefined,
      blob: undefined,
      original: undefined,
      derivatives: undefined,
    })),
    inquiries,
    revisions,
    members,
  };
}
