/** Inspect bytes, not the browser-provided filename or MIME type. */
export async function sniff(blob: Blob) {
  const bytes = new Uint8Array(await blob.slice(0, 64).arrayBuffer());
  const ascii = (start: number, end: number) =>
    String.fromCharCode(...bytes.slice(start, end));
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return "image/jpeg";
  if (bytes[0] === 0x89 && ascii(1, 4) === "PNG") return "image/png";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (ascii(4, 8) === "ftyp" && ["avif", "avis"].includes(ascii(8, 12)))
    return "image/avif";
  if (ascii(4, 8) === "ftyp") return "video/mp4";
  if (
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3
  )
    return "video/webm";
  if (ascii(0, 5) === "%PDF-") return "application/pdf";
  if (ascii(0, 6) === "WEBVTT") return "text/vtt";
  throw new Error("Unsupported or invalid file signature");
}
