"use strict";
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const {chromium,expect}=require(process.env.MOP_PLAYWRIGHT_MODULE||"@playwright/test");
const root=path.resolve(__dirname,".."),output=path.join(root,"test-results/release1097");
fs.mkdirSync(output,{recursive:true});
const checks=[],errors=[],external=[];
let browser;
async function check(name,fn){await fn();checks.push({name,status:"passed"});}
(async()=>{
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:"reduce"});
 await context.route("**/*",route=>{
  const u=new URL(route.request().url());
  if(["127.0.0.1","localhost"].includes(u.hostname))return route.continue();
  external.push(u.origin);return route.abort();
 });
 await context.addInitScript(()=>{
  window.__releaseQA={failRead:false,reads:0,routineCalls:0,mutations:0};
  const raw=Array.from({length:28},(_,i)=>({
   id:i+1,protocol:"Q-"+String(i+1).padStart(4,"0"),subject:"Registro de teste "+(i+1),
   description:"Dado ficticio de validacao integrada.",category:i===27?"Rotina":"Seguran\u00e7a",
   status:i%3===0?"Pendente":i%3===1?"Em andamento":"Resolvido",
   created_at:new Date(Date.now()-(i+1)*3600000).toISOString(),created_by:i%2?"Equipe Beta":"Equipe Alpha",
   condo:i%2?"Condom\u00ednio Beta":"Condom\u00ednio Alpha",created_identity:{user_id:"test-author"}
  }));
  const noop=()=>()=>{};
  window.mopDesktop={
   initialize:async()=>({authenticated:true,role:"viewer",userId:"qa-viewer",username:"qa.viewer",display_name:"Valida\u00e7\u00e3o integrada",mode:"offline",condos:["Condom\u00ednio Alpha","Condom\u00ednio Beta"]}),
   onLocked:noop,onSync:noop,onAlert:noop,onResume:noop,
   notifications:async()=>({history:[],notifications:[]}),
   read48:async()=>{window.__releaseQA.reads++;if(window.__releaseQA.failRead)throw Error("Falha simulada de leitura");return {items:raw};},
   home109:async()=>{window.__releaseQA.routineCalls++;throw Error("Viewer must not query routines");},
   auth:async()=>({authenticated:false}),
   recordAction96:async()=>{window.__releaseQA.mutations++;throw Error("Mutation not allowed in QA");},
  };
  window.mopWindow={command:async()=>({maximized:false}),state:async()=>({maximized:false}),status:async()=>({maximized:false}),onState:noop,onCloseRequest:noop};
 });
 const page=await context.newPage();
 page.on("pageerror",e=>errors.push(e.message));
 await page.goto(process.env.MOP_SHADCN_URL||"http://127.0.0.1:5176/");
 const nav=page.getByRole("navigation",{name:"Navega\u00e7\u00e3o principal"});
 await check("Updated bundle boots with authorized viewer snapshot",async()=>{
  await expect(nav).toBeVisible();
  await expect(page.locator(".ref-preview-indicator")).toContainText("109.7");
  await expect(page.getByRole("region",{name:"Panorama operacional"})).toBeVisible();
  await expect(page.locator(".recharts-wrapper").first()).toBeVisible();
  await expect(page.getByText("Indicadores de rotinas indispon\u00edveis para este perfil.",{exact:true})).toHaveCount(2);
  await expect(page.getByText("Consultando rotinas deste per\u00edodo",{exact:true})).toHaveCount(0);
  assert.equal(await page.evaluate(()=>window.__releaseQA.routineCalls),0);
  await page.screenshot({path:path.join(output,"app-home-desktop.png"),fullPage:true});
  const panorama=page.getByRole("region",{name:"Panorama operacional"});
  await panorama.scrollIntoViewIfNeeded();
  await panorama.screenshot({path:path.join(output,"app-panorama.png")});
 });
 await check("Records page uses TanStack and preserves viewer restrictions",async()=>{
  await nav.getByRole("button",{name:"Registros",exact:true}).click();
  await expect(page.locator("[data-record-row]")).toHaveCount(5);
  await expect(page.getByRole("complementary",{name:"Detalhes do registro"})).toContainText("Q-0001");
  for(const name of ["Novo Registro","Editar","Duplicar","Excluir"])await expect(page.getByRole("button",{name,exact:true})).toBeDisabled();
  await page.getByRole("button",{name:"Pr\u00f3xima p\u00e1gina",exact:true}).click();
  await expect(page.getByRole("button",{name:/Abrir registro Q-0006:/})).toBeVisible();
  await page.screenshot({path:path.join(output,"app-records-desktop.png"),fullPage:true});
 });
 await check("Column menu Escape closes only the menu",async()=>{
  await page.getByRole("button",{name:"Escolher colunas"}).click();
  await expect(page.getByRole("menu")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(nav.getByRole("button",{name:"Registros",exact:true})).toHaveAttribute("aria-current","page");
 });
 await check("Read error is explicit and retry preserves valid rows",async()=>{
  await page.evaluate(()=>{window.__releaseQA.failRead=true;});
  await page.locator(".integration-records-banner").getByRole("button",{name:"Atualizar"}).click();
  await expect(page.locator(".records1097").getByRole("alert")).toContainText("Falha simulada");
  await expect(page.locator("[data-record-row]")).toHaveCount(5);
  await page.evaluate(()=>{window.__releaseQA.failRead=false;});
  await page.getByRole("button",{name:"Tentar novamente",exact:true}).click();
  await expect(page.locator(".records1097").getByRole("alert")).toHaveCount(0);
 });
 await check("Home record link reveals the matching row and details",async()=>{
  await page.keyboard.press("Escape");
  await expect(nav.getByRole("button",{name:"In\u00edcio",exact:true})).toHaveAttribute("aria-current","page");
  const entry=page.locator(".mop-home54").getByRole("button").filter({hasText:"Registro de teste 1"}).first();
  await expect(entry).toBeVisible();await entry.click();
  await expect(page.getByRole("complementary",{name:"Detalhes do registro"})).toContainText("Q-0001");
  await expect(page.getByRole("button",{name:/Abrir registro Q-0001:/})).toBeVisible();
 });
 await check("Integrated records retain compact layout",async()=>{
  await page.setViewportSize({width:390,height:844});
  await expect(page.getByLabel("Ordena\u00e7\u00e3o dos registros",{exact:true})).toBeVisible();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  await page.locator(".records1097").scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(output,"app-records-compact.png"),fullPage:true});
 });
 await check("No JavaScript errors, external requests or writes",async()=>{
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  assert.equal(await page.evaluate(()=>window.__releaseQA.mutations),0);
 });
 const report={status:"passed",checks:checks.length,details:checks,bridge:"simulated authorized read-only viewer; synthetic records; no live database"};
 fs.writeFileSync(path.join(output,"integrated-report.json"),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})().catch(error=>{
 fs.writeFileSync(path.join(output,"integrated-report.json"),JSON.stringify({status:"failed",checks:checks.length,details:checks,error:error.stack,errors,external},null,2));
 console.error(error);process.exitCode=1;
}).finally(async()=>{await browser?.close();});
