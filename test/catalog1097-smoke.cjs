"use strict";
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const {chromium,expect}=require(process.env.MOP_PLAYWRIGHT_MODULE || "@playwright/test");
const root=path.resolve(__dirname,".."),output=path.join(root,"test-results/release1097");
fs.mkdirSync(output,{recursive:true});
const base=process.env.MOP_STORYBOOK_URL||"http://127.0.0.1:6006";
const checks=[],errors=[],external=[];
let browser;
async function check(name,fn){await fn();checks.push({name,status:"passed"});}
(async()=>{
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:1365,height:900},reducedMotion:"reduce"});
 await context.route("**/*",route=>{
  const u=new URL(route.request().url());
  if(["127.0.0.1","localhost"].includes(u.hostname))return route.continue();
  external.push(u.origin);return route.abort();
 });
 const page=await context.newPage();
 page.on("pageerror",e=>errors.push(e.message));
 const goto=async id=>{await page.goto(base+"/iframe.html?id="+id+"&viewMode=story");};
 await check("Catalog index contains all requested areas",async()=>{
  const response=await context.request.get(base+"/index.json");
  assert.equal(response.status(),200);
  const j=await response.json();
  const titles=Object.values(j.entries).filter(x=>x.type==="story").map(x=>x.id);
  for(const prefix of ["mop-foundations","mop-fields","mop-overlays","mop-records","mop-overview"])assert.ok(titles.some(x=>x.startsWith(prefix)));
  assert.ok(titles.length>=20);console.log("STORIES",titles.length);
 });
 await check("Shared visual tokens render in desktop catalog",async()=>{
  await goto("mop-foundations--superficies");
  await expect(page.getByRole("heading",{name:"Uma identidade, em todas as telas"})).toBeVisible();
  assert.equal(await page.evaluate(()=>document.documentElement.lang),"pt-BR");
  await page.screenshot({path:path.join(output,"catalog-foundations.png"),fullPage:true});
 });
 await check("Login story uses real shadcn fields and password reveal",async()=>{
  await goto("mop-fields--login");
  const login=page.getByLabel("Usu\u00e1rio ou e-mail",{exact:true}),password=page.getByLabel("Senha",{exact:true});
  await expect(login).toBeVisible();
  await expect(login).toHaveAttribute("data-slot","input");
  await login.fill("catalogo.local");await password.fill("fixture-only");
  await page.getByRole("button",{name:"Mostrar senha"}).click();
  await expect(password).toHaveAttribute("type","text");
  await page.getByRole("button",{name:"Entrar no MOP"}).click();
  await expect(page.getByRole("status")).toContainText("demonstra\u00e7\u00e3o validado");
  await page.screenshot({path:path.join(output,"catalog-login.png"),fullPage:true});
 });
 await check("Close dialog traps focus, cancels and returns to trigger",async()=>{
  await goto("mop-overlays--confirmacao");
  const trigger=page.getByRole("button",{name:"Abrir confirma\u00e7\u00e3o"});
  await trigger.click();
  const dialog=page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button",{name:"Cancelar"})).toBeFocused();
  for(let i=0;i<4;i++){await page.keyboard.press("Tab");assert.equal(await dialog.evaluate(el=>el.contains(document.activeElement)),true);}
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();await expect(trigger).toBeFocused();
 });
 await check("Dropdown can be selected above panel content",async()=>{
  await goto("mop-overlays--dropdown");
  await page.getByRole("button",{name:"Filtrar status"}).click();
  const option=page.getByRole("option",{name:"Em andamento"});
  await expect(option).toBeVisible();
  await option.click();
  await expect(page.getByRole("status")).toContainText("Em andamento");
 });
 await check("Calendar keeps blocked dates and selection semantics",async()=>{
  await goto("mop-overlays--calendario-escala");
  await expect(page.getByRole("button",{name:"24/11/2026 indispon\u00edvel",exact:true})).toBeDisabled();
  await page.getByRole("button",{name:"26/11/2026",exact:true}).click();
  await expect(page.getByRole("button",{name:"26/11/2026",exact:true})).toHaveAttribute("aria-pressed","true");
  await page.screenshot({path:path.join(output,"catalog-calendar.png"),fullPage:true});
 });
 await check("Catalog works at 390px without page overflow",async()=>{
  await page.setViewportSize({width:390,height:844});
  for(const id of ["mop-foundations--superficies","mop-fields--login","mop-overlays--confirmacao"]){
   await goto(id);await expect(page.locator(".mop-catalog-stage")).toBeVisible();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,id);
  }
  await page.getByRole("button",{name:"Abrir confirma\u00e7\u00e3o"}).click();
  const box=await page.getByRole("alertdialog").boundingBox();
  assert.ok(box&&box.x>=0&&box.x+box.width<=391);
  await page.screenshot({path:path.join(output,"catalog-dialog-compact.png"),fullPage:true});
 });
 await check("No JavaScript errors or external data requests",async()=>{
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 });
 const report={status:"passed",checks:checks.length,details:checks,scope:"Storybook with synthetic fixtures; local-only network"};
 fs.writeFileSync(path.join(output,"catalog-report.json"),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
})().catch(error=>{
 fs.writeFileSync(path.join(output,"catalog-report.json"),JSON.stringify({status:"failed",checks:checks.length,details:checks,error:error.stack,errors,external},null,2));
 console.error(error);process.exitCode=1;
}).finally(async()=>{await browser?.close();});
