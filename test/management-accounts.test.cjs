"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { manage } = require("../desktop/management-accounts.cjs");
const workspace = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const id = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const member = {
  workspace, username: "QA.Operator", display_name: "QA Operator",
  email: "operator@example.test", password: "fixture-pass-only", role: "operator", condos: ["CEA", "CEA"],
};

async function call(options = {}) {
  const { provision } = await import("../supabase/functions/mop-provision-user/provision.mjs");
  const calls = [];
  const req = new Request("https://example.test/provision", {
    method: "POST", headers: options.noToken ? {} : { Authorization: "Bearer fixture-token" },
    body: JSON.stringify(options.input ?? member),
  });
  const response = await provision(req, () => ({
    auth: { getUser: async () => options.invalidToken ? { error: {} } : { data: { user: { id: "caller" } } } },
    rpc: async (name, args) => {
      calls.push([name, args]);
      return name === "mop_list_members" ? options.members ?? { data: [] } : options.link ?? { data: true };
    },
  }), () => ({
    createUser: async attrs => {
      assert.equal(attrs.password, member.password);
      assert.equal(attrs.email, member.email);
      calls.push(["create"]);
      return { data: { user: { id } } };
    },
    deleteUser: async userId => { calls.push(["cleanup", userId]);return {}; },
  }));
  return { status: response.status, body: await response.json(), calls };
}

test("Central provisioning uses verified bearer and workspace administration before creating a password", async () => {
  for (const options of [{ noToken: true }, { invalidToken: true }, { members: { error: { code: "42501" } } }]) {
    const result = await call(options);
    assert.ok([401, 403].includes(result.status));
    assert.equal(result.calls.some(([operation]) => operation === "create"), false);
  }
  const invalid = await call({ input: { ...member, role: "admin" } });
  assert.equal(invalid.status, 400);
  assert.deepEqual(invalid.calls, []);
});

test("Provisioning scopes the created account and omits credentials from the response", async () => {
  const result = await call();
  assert.equal(result.status, 201);
  const [authorization, create, link] = result.calls;
  assert.deepEqual(authorization, ["mop_list_members", { p_workspace: workspace }]);
  assert.deepEqual(create, ["create"]);
  assert.deepEqual(link, ["mop_set_operator_220", {
    p_workspace: workspace, p_user_id: id, p_username: "qa.operator",
    p_display_name: member.display_name, p_role: "operator", p_condos: ["CEA"],
  }]);
  assert.deepEqual(result.body.member, { user_id: id, username: "qa.operator", display_name: member.display_name, role: "operator", condos: ["CEA"] });
});

test("Duplicate usernames and failed links never grant access to a different account", async () => {
  const duplicate = await call({ members: { data: [{ username: "qa.operator" }] } });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.calls.length, 1);
  const conflict = await call({ link: { error: { code: "23505" } } });
  assert.deepEqual(conflict.calls.at(-1), ["cleanup", id]);
  assert.equal(conflict.status, 409);
  const unknown = await call({ link: { error: { code: "network" } } });
  assert.equal(unknown.status, 503);
  assert.equal(unknown.calls.some(([operation]) => operation === "cleanup"), false);
});

test("Desktop uses its bound workspace and translates provision failures", async () => {
  const client = { functions: { invoke: async (name, { body }) => {
    assert.equal(name, "mop-provision-user");
    assert.equal(body.workspace, workspace);
    return { data: { member: { user_id: id } } };
  } } };
  assert.deepEqual(await manage(client, workspace, "create", { ...member, workspace: id }), { user_id: id });
  client.functions.invoke = async () => ({ error: { context: Response.json({ code: "email_taken" }, { status: 409 }) } });
  await assert.rejects(manage(client, workspace, "create", member), /e-mail/);
});
