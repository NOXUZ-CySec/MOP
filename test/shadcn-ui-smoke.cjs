const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { chromium, expect } = require(process.env.MOP_PLAYWRIGHT_MODULE || "@playwright/test");

const output = path.resolve(__dirname, "../ui-next/test-results/shadcn");
const baseURL = process.env.MOP_SHADCN_URL || "http://127.0.0.1:5176/";
fs.mkdirSync(output, { recursive: true });
const checks = [];
const pageErrors = [];
const externalRequests = [];
let browser;

async function check(name, run) {
  await run();
  checks.push({ name, status: "passed" });
}

(async () => {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1365, height: 900 } });
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === "127.0.0.1" || url.hostname === "localhost") return route.continue();
    externalRequests.push(url.origin);
    return route.abort();
  });
  await context.addInitScript(() => {
    window.__qa = { authCalls: [], windowCommands: [], loginShouldSucceed: false };
    window.mopDesktop = {
      initialize: async () => ({ authenticated: false }),
      onLocked: () => () => {},
      onSync: () => () => {},
      onAlert: () => () => {},
      auth: async (action, payload) => {
        window.__qa.authCalls.push({ action, login: payload?.login });
        if (action === "login") {
          if (!window.__qa.loginShouldSucceed) throw new Error("Credenciais de teste inválidas");
          return { authenticated: true, demo: true, role: "viewer", username: "qa.local", display_name: "Validação visual", mode: "demo" };
        }
        return { authenticated: false };
      },
    };
    window.mopWindow = {
      command: async (action) => { window.__qa.windowCommands.push(action); return { maximized: false }; },
      state: async () => ({ maximized: false }),
      onState: () => () => {},
      onCloseRequest: () => () => {},
    };
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(baseURL);
  const username = page.getByLabel("Usuário ou e-mail", { exact: true });
  const password = page.getByLabel("Senha", { exact: true });

  await check("Login com campos shadcn e rótulos associados", async () => {
    await expect(page.getByRole("heading", { name: "Bem-vindo ao MOP" })).toBeVisible();
    await expect(username).toHaveAttribute("data-slot", "input");
    await expect(password).toHaveAttribute("data-slot", "input");
    await expect(page.getByRole("button", { name: "Entrar no MOP" })).toHaveAttribute("data-slot", "button");
    await page.screenshot({ path: path.join(output, "login-desktop.png"), fullPage: true });
  });
  await check("Campos obrigatórios impedem envio vazio", async () => {
    await page.getByRole("button", { name: "Entrar no MOP" }).click();
    assert.equal(await page.evaluate(() => window.__qa.authCalls.length), 0);
    assert.equal(await username.evaluate((element) => element.validity.valueMissing), true);
  });
  await username.fill("qa.local");
  await password.fill("qa-password-not-a-real-account");

  await check("Controle de visibilidade alinhado ao campo de senha", async () => {
    const inputBox = await password.boundingBox();
    const buttonBox = await page.getByRole("button", { name: "Mostrar senha" }).boundingBox();
    assert.ok(inputBox && buttonBox);
    assert.ok(Math.abs(inputBox.y + inputBox.height / 2 - buttonBox.y - buttonBox.height / 2) <= 2);
    assert.ok(buttonBox.x >= inputBox.x && buttonBox.x + buttonBox.width <= inputBox.x + inputBox.width);
  });
  await check("Mostrar senha não envia o formulário", async () => {
    await page.getByRole("button", { name: "Mostrar senha" }).click();
    await expect(password).toHaveAttribute("type", "text");
    await expect(page.getByRole("button", { name: "Ocultar senha" })).toHaveAttribute("aria-pressed", "true");
    assert.equal(await page.evaluate(() => window.__qa.authCalls.length), 0);
    await page.getByRole("button", { name: "Ocultar senha" }).click();
    await expect(password).toHaveAttribute("type", "password");
  });
  await check("Tab percorre usuário, senha e controle de visibilidade", async () => {
    await username.focus();
    await page.keyboard.press("Tab");
    await expect(password).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Mostrar senha" })).toBeFocused();
  });
  await check("Enter envia uma vez e falha de autenticação continua visível", async () => {
    await password.focus();
    await password.press("Enter");
    await expect(page.getByRole("alert")).toContainText("Credenciais de teste inválidas");
    await expect(password).toHaveValue("");
    assert.equal(await page.evaluate(() => window.__qa.authCalls.length), 1);
  });
  await check("Contrato de autenticação preservado com ponte simulada", async () => {
    await page.evaluate(() => { window.__qa.loginShouldSucceed = true; });
    await password.fill("qa-password-not-a-real-account");
    await password.press("Enter");
    await expect(page.getByRole("navigation", { name: "Navegação principal" })).toBeVisible();
    assert.equal(await page.evaluate(() => window.__qa.authCalls.length), 2);
  });
  const records = page.getByRole("navigation", { name: "Navegação principal" }).getByRole("button", { name: "Registros", exact: true });
  await records.click();
  await expect(records).toHaveAttribute("aria-current", "page");
  const close = page.getByRole("button", { name: "Fechar janela", exact: true });
  const dialog = page.getByRole("alertdialog", { name: "Encerrar o MOP?" });

  await check("Diálogo abre identificado e prioriza Cancelar", async () => {
    await close.click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Cancelar" })).toBeFocused();
    await page.screenshot({ path: path.join(output, "dialog-desktop.png"), fullPage: true });
  });
  await check("Tab mantém o foco dentro do diálogo", async () => {
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("Tab");
      assert.equal(await dialog.evaluate((element) => element.contains(document.activeElement)), true);
    }
    await page.keyboard.press("Shift+Tab");
    assert.equal(await dialog.evaluate((element) => element.contains(document.activeElement)), true);
  });
  await check("Cancelar devolve foco e não fecha o aplicativo", async () => {
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialog).toBeHidden();
    await expect(close).toBeFocused();
    assert.equal(await page.evaluate(() => window.__qa.windowCommands.filter((action) => action === "close").length), 0);
  });
  await check("Esc fecha o diálogo e preserva a aba atual", async () => {
    await close.click();
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(records).toHaveAttribute("aria-current", "page");
    await expect(close).toBeFocused();
    assert.equal(await page.evaluate(() => window.__qa.windowCommands.filter((action) => action === "close").length), 0);
  });
  await check("Confirmar chama o fechamento exatamente uma vez", async () => {
    await close.click();
    await dialog.getByRole("button", { name: "Confirmar", exact: true }).click();
    await expect(dialog).toBeHidden();
    assert.equal(await page.evaluate(() => window.__qa.windowCommands.filter((action) => action === "close").length), 1);
  });
  await check("Esc fora do diálogo continua retornando ao Início", async () => {
    await page.keyboard.press("Escape");
    await expect(page.getByRole("navigation", { name: "Navegação principal" }).getByRole("button", { name: "Início", exact: true })).toHaveAttribute("aria-current", "page");
  });
  await check("Login e diálogo cabem em tela compacta", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(username).toBeVisible();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    await page.screenshot({ path: path.join(output, "login-compact.png"), fullPage: true });
    await page.getByRole("button", { name: "Fechar janela", exact: true }).click();
    await expect(dialog).toBeVisible();
    const rect = await dialog.boundingBox();
    assert.ok(rect && rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= 391 && rect.y + rect.height <= 845);
    await page.screenshot({ path: path.join(output, "dialog-compact.png"), fullPage: true });
    await page.keyboard.press("Escape");
  });
  await check("Nenhum erro de JavaScript ou acesso externo", async () => {
    assert.deepEqual(pageErrors, []);
    assert.deepEqual(externalRequests, []);
  });
  const report = { status: "passed", checks: checks.length, details: checks, baseURL, bridge: "simulated; no database or real authentication", screenshots: ["login-desktop.png", "dialog-desktop.png", "login-compact.png", "dialog-compact.png"] };
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
})().catch((error) => {
  const report = { status: "failed", checksPassed: checks.length, details: checks, error: error.message, pageErrors, externalRequests };
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  console.error(JSON.stringify(report));
  process.exitCode = 1;
}).finally(async () => { if (browser) await browser.close(); });
