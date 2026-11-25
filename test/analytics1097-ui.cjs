"use strict";
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const {chromium,expect}=require(process.env.MOP_PLAYWRIGHT_MODULE||"@playwright/test");
const out=path.resolve(__dirname,"../test-results/release1097");
fs.mkdirSync(out,{recursive:true});
const checks=[],errors=[],external=[];
let browser;
async function check(name,fn){await fn();checks.push({name,status:"passed"});}
(async()=>{
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:1365,height:900}});
 await context.route("**/*",route=>{const url=new URL(route.request().url());if(["127.0.0.1","localhost"].includes(url.hostname))return route.continue();external.push(url.origin);return route.abort();});
 const page=await context.newPage();page.on("pageerror",e=>errors.push(e.message));
 await page.emulateMedia({reducedMotion:"reduce"});
 const goto=async(story)=>{await page.goto("http://127.0.0.1:6006/iframe.html?id=mop-overview--"+story+"&viewMode=story");await expect(page.getByRole("heading",{name:"Panorama operacional"})).toBeVisible({timeout:25000});};
 await goto("com-dados");
 await check("Real Recharts canvases render fixture totals and completion denominator",async()=>{
  await expect(page.locator(".mop-chart1097-stat strong")).toHaveText("4");
  await expect(page.locator(".mop-chart1097-summary")).toContainText("2 de 3 rotinas concluídas");
  await expect(page.locator(".mop-chart1097-donut-label strong")).toHaveText("67%");
  await expect(page.locator(".recharts-surface")).toHaveCount(2);
  await page.screenshot({path:path.join(out,"charts-desktop.png"),fullPage:true});
 });
 await check("Calendar table matches totals; period selector changes rows",async()=>{
  const details=page.locator(".mop-chart1097-details");
  await details.locator("summary").click();
  await expect(details.locator("tbody tr")).toHaveCount(7);
  const sum=await details.locator("tbody td").evaluateAll(nodes=>nodes.reduce((s,n)=>s+Number(n.textContent),0));assert.equal(sum,4);
  await page.getByRole("button",{name:"30 dias",exact:true}).click();
  await expect(page.getByRole("button",{name:"30 dias",exact:true})).toHaveAttribute("aria-pressed","true");
  await expect(details.locator("tbody tr")).toHaveCount(30);
  await details.locator("summary").click();
 });
 await check("Compact layout has no horizontal overflow or clipped chart",async()=>{
  await page.setViewportSize({width:390,height:844});
  await expect(page.locator(".recharts-surface")).toHaveCount(2);
  const geometry=await page.evaluate(()=>({viewport:innerWidth,body:document.documentElement.scrollWidth,panels:[...document.querySelectorAll(".mop-chart1097-panel")].map(n=>({left:n.getBoundingClientRect().left,right:n.getBoundingClientRect().right}))}));
  assert.ok(geometry.body<=geometry.viewport+1,JSON.stringify(geometry));
  assert.ok(geometry.panels.every(p=>p.left>=0&&p.right<=geometry.viewport+1),JSON.stringify(geometry));
  await page.screenshot({path:path.join(out,"charts-compact.png"),fullPage:true});
 });
 await check("Empty period is explicit and never shows fake completion percentage",async()=>{
  await goto("vazio");
  await expect(page.getByText("Nenhuma ocorrência neste período",{exact:true})).toBeVisible();
  await expect(page.getByText("Nenhuma rotina prevista",{exact:true})).toBeVisible();
  assert.equal(await page.locator(".mop-chart1097-donut-label").count(),0);
  await page.screenshot({path:path.join(out,"charts-empty.png"),fullPage:true});
 });
 await check("Loading state distinguishes pending data from zero",async()=>{
  await goto("carregando");
  await expect(page.getByText("Atualizando ocorrências…",{exact:true})).toBeVisible();
  await expect(page.getByText("Atualizando rotinas…",{exact:true})).toBeVisible();
  assert.equal(await page.locator(".mop-chart1097-stat").count(),0);
 });
 await check("Error state does not present zero metrics as successful data",async()=>{
  await goto("erro");
  await expect(page.getByText("Não foi possível atualizar os registros.",{exact:false})).toBeVisible();
  await expect(page.getByText("Rotinas indisponíveis nesta consulta.",{exact:false})).toBeVisible();
  assert.equal(await page.locator(".mop-chart1097-stat").count(),0);
 });
 await check("Before operational acknowledgement no chart data is displayed",async()=>{
  await goto("antes-do-aceite");
  await expect(page.getByText("Os indicadores ficam disponíveis após a preparação do acesso operacional.",{exact:true})).toBeVisible();
  assert.equal(await page.locator(".recharts-surface").count(),0);
 });
 await check("Viewer keeps authorized occurrences and gets explicit routine restriction",async()=>{
  await goto("somente-consulta");
  await expect(page.locator(".mop-chart1097-stat strong")).toHaveText("4");
  await expect(page.getByText("Indicadores de rotinas indisponíveis para este perfil.",{exact:true})).toBeVisible();
  assert.equal(await page.locator(".mop-chart1097-summary").count(),0);
  assert.equal(await page.locator(".mop-chart1097-donut").count(),0);
 });
 await check("No JavaScript errors or external requests",async()=>{assert.deepEqual(errors,[]);assert.deepEqual(external,[]);});
 const report={status:"passed",checks:checks.length,details:checks,source:"Storybook fixtures only; no database or real login",viewports:["1365x900","390x844"],screenshots:["charts-desktop.png","charts-compact.png","charts-empty.png"]};
 fs.writeFileSync(path.join(out,"charts-ui-report.json"),JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify(report));
})().catch(e=>{fs.writeFileSync(path.join(out,"charts-ui-report.json"),JSON.stringify({status:"failed",checks:checks.length,details:checks,error:e.stack,errors,external},null,2));console.error(e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();});
