"use strict";

const errors = new Map([
  ["invalid_input", "Confira o e-mail, o usuário, a senha e os acessos selecionados."],
  ["admin_required", "Apenas administradores desta central podem criar contas."],
  ["session_required", "A sessão expirou. Entre novamente para criar a conta."],
  ["username_taken", "Este usuário já está em uso."],
  ["email_taken", "Já existe uma conta na central com este e-mail."],
  ["weak_password", "A senha não atende à política de segurança da central."],
  ["membership_rejected", "A central recusou o vínculo da conta com o perfil solicitado."],
  ["central_unavailable", "Não foi possível validar o cadastro na central."],
  ["creation_unconfirmed", "A criação não foi confirmada. Atualize a lista antes de tentar novamente."],
]);

async function manage(client, workspace, action, input) {
  const { user_id, username, display_name, role, condos, email, password } = input || {};
  if (action === "create") {
    const { data, error } = await client.functions.invoke("mop-provision-user", {
      body: { workspace, username, display_name, role, condos, email, password },
    });
    if (error) {
      const response = error.context;
      if (response?.status === 404) throw Error("O cadastro de contas ainda não foi ativado nesta central.");
      let code;
      try { code = (await response?.json())?.code; } catch { /* Gateway returned no application code. */ }
      throw Error(errors.get(code) || errors.get("creation_unconfirmed"));
    }
    if (!data?.member?.user_id) throw Error(errors.get("creation_unconfirmed"));
    return data.member;
  }
  const params = action === "list" ? { p_workspace: workspace } : {
    p_workspace: workspace, p_user_id: user_id, p_username: username,
    p_display_name: display_name, p_role: role, p_condos: condos,
  };
  const { data, error } = await client.rpc(action === "list" ? "mop_list_members" : "mop_set_operator_220", params);
  if (error) throw error;
  if (action === "save" && data !== true) throw Error("A central não confirmou a alteração de acesso.");
  return data;
}

module.exports = { manage };
