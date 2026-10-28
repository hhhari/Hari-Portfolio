import { serve, response, service, json, assertDb } from "../_shared/http.ts";
serve(async (req) => {
  const body = await json(req, 10000);
  const strings = [
    "name",
    "email",
    "project_type",
    "budget",
    "message",
    "website",
  ];
  if (strings.some((k) => typeof body[k] !== "string"))
    throw new Error("Missing form fields");
  if (body.website) return response(req, { ok: true });
  const name = body.name.trim(),
    email = body.email.trim(),
    message = body.message.trim();
  if (
    name.length < 2 ||
    name.length > 100 ||
    !/^\S+@\S+\.\S+$/.test(email) ||
    email.length > 254 ||
    message.length < 20 ||
    message.length > 5000 ||
    !body.project_type ||
    body.project_type.length > 100 ||
    body.budget.length > 100
  )
    throw new Error("Please check the form fields");
  // Require the platform proxy's real client address. Never trust a form-supplied address.
  const ip = (
    req.headers.get("x-forwarded-for") ?? req.headers.get("cf-connecting-ip")
  )
    ?.split(",")[0]
    .trim();
  if (!ip)
    throw new Error(
      "Spam protection could not identify the request. Please email directly.",
    );
  const secret = Deno.env.get("RATE_LIMIT_SALT");
  if (!secret) throw new Error("Contact form setup is incomplete");
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(secret + ip),
  );
  const hash = Array.from(new Uint8Array(bytes))
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
  const db = service();
  const limit = await db.rpc("consume_rate_limit", { p_key: hash });
  assertDb(limit.error);
  if (!limit.data)
    return response(
      req,
      { error: "Too many messages. Please try later or email directly." },
      429,
    );
  const result = await db
    .from("inquiries")
    .insert({
      name,
      email,
      project_type: body.project_type,
      budget: body.budget,
      message,
    });
  assertDb(result.error);
  return response(req, { ok: true });
});
