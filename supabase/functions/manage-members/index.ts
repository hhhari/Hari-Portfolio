import {
  serve,
  response,
  staff,
  json,
  assertDb,
  uuid,
} from "../_shared/http.ts";
serve(async (req) => {
  const { db, user } = await staff(req, true);
  const body = await json(req, 2000);
  if (!["owner", "editor"].includes(body.role)) throw new Error("Invalid role");
  if (body.action === "role" || body.action === "remove") {
    if (!uuid(body.id)) throw new Error("Invalid member");
    const token = req.headers.get("authorization")!;
    const { createClient } =
      await import("https://esm.sh/@supabase/supabase-js@2.95.3");
    const client = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: { headers: { Authorization: token } },
        auth: { persistSession: false },
      },
    );
    assertDb(
      (
        await client.rpc(
          body.action === "remove" ? "remove_member" : "change_member_role",
          body.action === "remove"
            ? { p_id: body.id }
            : {
                p_id: body.id,
                p_role: body.role,
              },
        )
      ).error,
    );
    return response(req, { ok: true });
  }
  if (
    body.action !== "invite" ||
    typeof body.email !== "string" ||
    !/^\S+@\S+\.\S+$/.test(body.email) ||
    body.email.length > 254
  )
    throw new Error("Valid email required");
  const email = body.email.trim().toLowerCase();
  for (let page = 1; page <= 20; page++) {
    const listed = await db.auth.admin.listUsers({ page, perPage: 1000 });
    assertDb(listed.error);
    const existing = listed.data.users.find(
      (u) => u.email?.toLowerCase() === email && u.email_confirmed_at,
    );
    if (existing) {
      const membership = await db
        .from("members")
        .select("user_id")
        .eq("user_id", existing.id)
        .maybeSingle();
      assertDb(membership.error);
      if (membership.data)
        throw new Error(
          "This account is already a member. Change its role in the member list.",
        );
      assertDb(
        (
          await db
            .from("members")
            .insert({ user_id: existing.id, email, role: body.role })
        ).error,
      );
      return response(req, {
        message:
          "Access granted to the existing verified account. They can now sign in.",
      });
    }
    if (listed.data.users.length < 1000) break;
  }
  assertDb(
    (
      await db
        .from("invitations")
        .upsert({ email, role: body.role, invited_by: user.id })
    ).error,
  );
  const result = await db.auth.admin.inviteUserByEmail(email, {
    redirectTo: Deno.env.get("SITE_URL"),
  });
  if (result.error) {
    await db.from("invitations").delete().eq("email", email);
    throw new Error("Invitation could not be sent: " + result.error.message);
  }
  return response(req, {
    message:
      "Invitation sent. Access activates when the verified account signs in.",
  });
});
