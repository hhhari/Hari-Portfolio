import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.3";
export const service = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
export function cors(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const allowed = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    "Access-Control-Allow-Origin": allowed.includes(origin) ? origin : "null",
    "Access-Control-Allow-Headers":
      "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}
export function response(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...cors(req),
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}
export async function staff(req: Request, owner = false) {
  const token = req.headers.get("authorization")?.replace(/^Bearer /i, "");
  if (!token) throw new Error("Unauthorized");
  const db = service();
  const {
    data: { user },
    error,
  } = await db.auth.getUser(token);
  if (error || !user) throw new Error("Unauthorized");
  const { data: member } = await db
    .from("members")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member || (owner && member.role !== "owner"))
    throw new Error("Forbidden");
  return { db, user, member };
}
export function serve(handler: (req: Request) => Promise<Response>) {
  Deno.serve(async (req) => {
    if (req.method === "OPTIONS")
      return new Response(null, { headers: cors(req) });
    if (req.method !== "POST")
      return response(req, { error: "Method not allowed" }, 405);
    try {
      return await handler(req);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Request failed";
      return response(
        req,
        { error: msg },
        msg === "Unauthorized" ? 401 : msg === "Forbidden" ? 403 : 400,
      );
    }
  });
}
export async function json(req: Request, max = 20000) {
  if (Number(req.headers.get("content-length") || 0) > max)
    throw new Error("Request too large");
  const raw = await req.text();
  if (raw.length > max) throw new Error("Request too large");
  return JSON.parse(raw);
}
export function assertDb(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}
export const uuid = (id: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
