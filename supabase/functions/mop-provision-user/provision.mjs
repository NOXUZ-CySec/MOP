const roles = ["admin", "supervisor", "operator", "viewer"];
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const json = (status, body) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const fail = (status, code) => json(status, { code });

function validate(input) {
  if (!input || typeof input !== "object") return null;
  const { workspace, role, password } = input;
  const username = typeof input.username === "string" ? input.username.trim().toLowerCase() : "";
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const displayName = typeof input.display_name === "string" ? input.display_name.trim() : "";
  const condos = input.condos;
  if (typeof workspace !== "string" || !uuid.test(workspace) || !roles.includes(role) ||
      !/^[a-z0-9][a-z0-9._-]{2,39}$/.test(username) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 ||
      !displayName || displayName.length > 100 || displayName.includes("@") ||
      typeof password !== "string" || password.trim().length < 12 || new TextEncoder().encode(password).length > 72 ||
      (role === "admin" && condos !== null) || (condos !== null &&
       (!Array.isArray(condos) || condos.length > 100 || condos.some(value => typeof value !== "string" || !value.trim() || value.length > 120)))) return null;
  return { workspace, role, username, email, displayName, password, condos: condos && [...new Set(condos.map(value => value.trim()))] };
}

export async function provision(request, userClient, makeAdmin) {
  if (request.method !== "POST") return fail(405, "method_not_allowed");
  const token = request.headers.get("authorization")?.match(/^Bearer ([^\s]+)$/i)?.[1];
  if (!token) return fail(401, "session_required");
  const user = userClient(token);
  try {
    const auth = await user.auth.getUser(token);
    if (auth.error || !auth.data?.user?.id || auth.data.user.is_anonymous) return fail(401, "session_required");

    const length = Number(request.headers.get("content-length"));
    if (length > 16000) return fail(413, "invalid_input");
    const body = await request.text();
    if (body.length > 16000) return fail(413, "invalid_input");
    let input;
    try { input = validate(JSON.parse(body)); } catch { return fail(400, "invalid_input"); }
    if (!input) return fail(400, "invalid_input");

    const members = await user.rpc("mop_list_members", { p_workspace: input.workspace });
    if (members.error?.code === "42501") return fail(403, "admin_required");
    if (members.error || !Array.isArray(members.data)) return fail(503, "central_unavailable");
    if (members.data.some(member => member.username?.toLowerCase() === input.username)) return fail(409, "username_taken");

    const admin = makeAdmin();
    const created = await admin.createUser({ email: input.email, password: input.password, email_confirm: true });
    if (created.error) {
      if (["email_exists", "user_already_exists"].includes(created.error.code)) return fail(409, "email_taken");
      if (created.error.code === "weak_password") return fail(400, "weak_password");
      if (created.error.code === "email_address_invalid") return fail(400, "invalid_input");
      return fail(503, "creation_unconfirmed");
    }
    const id = created.data?.user?.id;
    if (!id) return fail(503, "creation_unconfirmed");

    const linked = await user.rpc("mop_set_operator_220", {
      p_workspace: input.workspace, p_user_id: id, p_username: input.username,
      p_display_name: input.displayName, p_role: input.role, p_condos: input.condos,
    });
    if (linked.data === true && !linked.error) {
      return json(201, { member: { user_id: id, username: input.username, display_name: input.displayName, role: input.role, condos: input.condos } });
    }
    // A definite SQL rejection rolls back the membership write. Ambiguous transport failures may have committed it.
    if (!["P0001", "42501", "23505", "23514", "23503"].includes(linked.error?.code)) {
      return fail(503, "creation_unconfirmed");
    }
    const cleanup = await admin.deleteUser(id);
    if (cleanup.error) return fail(503, "creation_unconfirmed");
    if (linked.error.code === "42501") return fail(403, "admin_required");
    if (linked.error.code === "23505") return fail(409, "username_taken");
    return fail(400, "membership_rejected");
  } catch {
    return fail(503, "creation_unconfirmed");
  }
}
