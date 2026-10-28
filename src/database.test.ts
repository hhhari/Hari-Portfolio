import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { baseSettings, newProject } from "./content";
let db: PGlite;
const owner = "11111111-1111-4111-8111-111111111111",
  editor = "22222222-2222-4222-8222-222222222222",
  outsider = "33333333-3333-4333-8333-333333333333";
async function as(id: string | null) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    id ?? "",
  ]);
  await db.exec(`set role ${id ? "authenticated" : "anon"}`);
}
const save = (
  id: string,
  data: unknown,
  version: number,
  publish = false,
  kind = "project",
) =>
  db.query("select public.save_document($1,$2,$3::jsonb,$4,$5) as doc", [
    id,
    kind,
    JSON.stringify(data),
    version,
    publish,
  ]);
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);insert into auth.users values('${owner}','owner@example.com',now()),('${editor}','editor@example.com',now()),('${outsider}','outside@example.com',now());`,
  );
  await db.exec(
    await readFile("supabase/migrations/202610280001_cms.sql", "utf8"),
  );
  await db.exec(
    `insert into public.members(user_id,email,role) values('${owner}','owner@example.com','owner'),('${editor}','editor@example.com','editor')`,
  );
}, 30000);
afterAll(async () => {
  await db?.close();
});
describe.sequential("database authorization and publishing", () => {
  it("denies anonymous draft reads and direct published writes", async () => {
    await as(null);
    await expect(db.query("select * from public.documents")).rejects.toThrow(
      "permission denied",
    );
    await expect(
      db.query(
        "insert into public.published_documents(id,kind,data) values('injected','page','{}')",
      ),
    ).rejects.toThrow("permission denied");
    expect(
      (await db.query("select * from public.published_documents")).rows,
    ).toHaveLength(0);
  });
  it("denies authenticated accounts without a membership", async () => {
    await as(outsider);
    expect(
      (await db.query("select * from public.documents")).rows,
    ).toHaveLength(0);
    await expect(save("unauthorized", newProject(), 0)).rejects.toThrow(
      "Not authorized",
    );
    await expect(
      db.query(
        `insert into public.members(user_id,email,role) values('${outsider}','outside@example.com','owner')`,
      ),
    ).rejects.toThrow("permission denied");
  });
  it("publishes a snapshot while later draft edits remain private", async () => {
    await as(owner);
    const data = {
      ...newProject(),
      title: "First public title",
      slug: "public-case",
    };
    await save("published-case", data, 0, true);
    await save(
      "published-case",
      { ...data, title: "Secret unfinished title" },
      1,
      false,
    );
    await as(null);
    const r = await db.query<{ data: { title: string } }>(
      "select data from public.published_documents where id='published-case'",
    );
    expect(r.rows[0].data.title).toBe("First public title");
  });
  it("detects competing edits", async () => {
    await as(owner);
    await expect(save("published-case", newProject(), 1)).rejects.toThrow(
      "another session",
    );
  });
  it("lets editors publish projects but protects owner settings", async () => {
    await as(editor);
    await save(
      "editor-case",
      { ...newProject(), slug: "editor-case" },
      0,
      true,
    );
    await expect(
      save("site-settings", baseSettings, 0, true, "settings"),
    ).rejects.toThrow("Owner access");
  });
  it("rejects missing media references and duplicate slugs", async () => {
    await as(owner);
    await expect(
      save(
        "missing-media",
        {
          ...newProject(),
          slug: "missing-media",
          image: "media:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        },
        0,
        true,
      ),
    ).rejects.toThrow("media asset");
    await expect(
      save("duplicate", { ...newProject(), slug: "public-case" }, 0, true),
    ).rejects.toThrow("duplicate key");
  });
  it("exposes only media referenced by a current published snapshot", async () => {
    await db.exec("reset role");
    await db.exec(
      "insert into public.media(id,name,path,type,size) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Private','delivery/private.webp','image/webp',100),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Public','delivery/public.webp','image/webp',100)",
    );
    await as(owner);
    await save(
      "media-case",
      {
        ...newProject(),
        slug: "media-case",
        image: "media:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      },
      0,
      true,
    );
    await db.exec("reset role");
    const r = await db.query<{ path: string }>(
      "select path from public.public_media_paths(array['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb']::uuid[])",
    );
    expect(r.rows.map((r) => r.path)).toEqual(["delivery/public.webp"]);
  });
  it("prevents last-owner demotion and editor role changes", async () => {
    await as(owner);
    await expect(
      db.query("select public.change_member_role($1,$2)", [owner, "editor"]),
    ).rejects.toThrow("last owner");
    await as(editor);
    await expect(
      db.query("select public.change_member_role($1,$2)", [editor, "owner"]),
    ).rejects.toThrow("Owner access");
  });
  it("unpublishing removes the public snapshot", async () => {
    await as(owner);
    await db.query(
      "select public.document_action('published-case','unpublish')",
    );
    await as(null);
    expect(
      (
        await db.query(
          "select * from public.published_documents where id='published-case'",
        )
      ).rows,
    ).toHaveLength(0);
  });
  it("protects the final owner during revocation", async () => {
    await as(owner);
    await expect(
      db.query("select public.remove_member($1)", [owner]),
    ).rejects.toThrow("last owner");
    await as(editor);
    await expect(
      db.query("select public.remove_member($1)", [owner]),
    ).rejects.toThrow("Owner access");
  });
  it("rate limits requests with one atomic counter", async () => {
    await db.exec("reset role");
    const result = [];
    for (let i = 0; i < 6; i++) {
      const r = await db.query<{ allowed: boolean }>(
        "select public.consume_rate_limit('test-client') as allowed",
      );
      result.push(r.rows[0].allowed);
    }
    expect(result).toEqual([true, true, true, true, true, false]);
  });
});
