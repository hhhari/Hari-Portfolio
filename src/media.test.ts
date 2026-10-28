import { describe, it, expect } from "vitest";
import { sniff } from "../supabase/functions/_shared/file";
describe("server-side file inspection", () => {
  it("rejects an HTML payload pretending to be a JPEG", async () => {
    await expect(
      sniff(new Blob(["<script>malicious()</script>"], { type: "image/jpeg" })),
    ).rejects.toThrow("invalid file signature");
  });
  it("recognizes container headers without trusting file extensions", async () => {
    expect(
      await sniff(new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])])),
    ).toBe("image/jpeg");
    expect(await sniff(new Blob(["RIFF0000WEBP"]))).toBe("image/webp");
    expect(await sniff(new Blob(["0000ftypisom"]))).toBe("video/mp4");
    expect(
      await sniff(new Blob(["WEBVTT\n\n00:00.000 --> 00:01.000\nHello"])),
    ).toBe("text/vtt");
  });
});
