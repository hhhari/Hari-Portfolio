import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import {
  block,
  embedUrl,
  inquirySchema,
  mediaIds,
  newProject,
  seeds,
  validateDoc,
} from "./content";
import { initDemo, readAll, saveDemo } from "./db";
import type { ContentDoc } from "./types";
describe("public content boundaries", () => {
  it("rejects arbitrary executable embeds and unapproved hosts", () => {
    expect(embedUrl("javascript:alert(1)")).toBeNull();
    expect(
      embedUrl("https://youtube.com.evil.test/watch?v=abcdefghijk"),
    ).toBeNull();
    expect(embedUrl("https://youtu.be/abcdefghijk")).toBe(
      "https://www.youtube-nocookie.com/embed/abcdefghijk",
    );
    expect(embedUrl("https://vimeo.com/123456")).toBe(
      "https://player.vimeo.com/video/123456",
    );
  });
  it("extracts nested media references, deduplicating shared assets", () =>
    expect(
      mediaIds({
        cover: "media:one",
        blocks: [{ image: "media:one" }, { image: "media:two" }],
      }),
    ).toEqual(["one", "two"]));
  it("rejects malformed backups before saving", () =>
    expect(() =>
      validateDoc({
        ...seeds()[1],
        data: { ...newProject(), slug: "../../bad" },
      }),
    ).toThrow("slug"));
  it("rejects short messages and filled honeypots", () => {
    const data = {
      name: "Test User",
      email: "test@example.com",
      project_type: "Motion",
      budget: "Discuss",
      message: "Please discuss a new brand motion project.",
      website: "",
    };
    expect(inquirySchema.safeParse(data).success).toBe(true);
    expect(inquirySchema.safeParse({ ...data, website: "spam" }).success).toBe(
      false,
    );
    expect(inquirySchema.safeParse({ ...data, message: "Hi" }).success).toBe(
      false,
    );
  });
  it("creates independent block objects", () => {
    const a = block(),
      b = block();
    expect(a.id).not.toBe(b.id);
  });
});
describe.sequential("demo publishing contract", () => {
  beforeEach(async () => {
    await initDemo();
  });
  it("keeps unfinished edits out of public content", async () => {
    const data = newProject();
    const d: ContentDoc = {
      id: crypto.randomUUID(),
      kind: "project",
      data,
      version: 0,
      published: false,
      archived: false,
      updated_at: new Date().toISOString(),
    };
    let saved = await saveDemo(d, false);
    expect(
      (await readAll<ContentDoc>("published")).some((p) => p.id === d.id),
    ).toBe(false);
    saved = await saveDemo(saved, true);
    saved = await saveDemo(
      { ...saved, data: { ...data, title: "Unfinished private title" } },
      false,
    );
    const publicDoc = (await readAll<ContentDoc>("published")).find(
      (p) => p.id === d.id,
    )!;
    expect(publicDoc.data.title).toBe("Untitled project");
    expect(saved.data.title).toBe("Unfinished private title");
  });
  it("rejects stale writes instead of overwriting newer edits", async () => {
    const d: ContentDoc = {
      id: crypto.randomUUID(),
      kind: "project",
      data: newProject(),
      version: 0,
      published: false,
      archived: false,
      updated_at: new Date().toISOString(),
    };
    const first = await saveDemo(d);
    await saveDemo({
      ...first,
      data: { ...newProject(), title: "Newer edit" },
    });
    await expect(
      saveDemo({ ...first, data: { ...newProject(), title: "Stale edit" } }),
    ).rejects.toThrow("another session");
  });
});
