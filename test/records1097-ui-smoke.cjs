const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium, expect } = require(process.env.MOP_PLAYWRIGHT_MODULE || '@playwright/test');
const root = path.resolve(__dirname, '..');
const ui = path.join(root, 'ui-next');
const output = path.join(root, 'test-results/records1097');
fs.mkdirSync(output, { recursive: true });
const checks = [];
const errors = [];
const external = [];
let server, browser;
const html = [
  '<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>MOP Records QA</title></head>',
  '<body style="margin:0"><div id="root"></div><script type="module">',
  'import React from "react";import{createRoot}from"react-dom/client";',
  'import RecordsPage,{sampleRecords}from"/src/RecordsPage.tsx";',
  'import"/src/style.css";import"/src/reference27.css";import"/src/records28.css";import"/src/records33.css";',
  'import"/src/mop-theme1081.css";import"/src/mop-theme1092.css";import"/src/mop-theme1094.css";import"/src/mop-theme1095.css";',
  'window.__qa={actions:[]};',
  'function Harness(){',
  'const [role,setRole]=React.useState("admin"),[requested,setRequested]=React.useState(null),[records,setRecords]=React.useState([...sampleRecords].reverse());',
  'window.__qa.setRole=setRole;window.__qa.open=setRequested;window.__qa.setRecords=setRecords;',
  'return React.createElement("div",{className:"ref-app",style:{display:"block",padding:"20px",minWidth:0,minHeight:"100vh"}},React.createElement("main",{className:"mop-page47"},React.createElement(RecordsPage,{records,role,userId:"qa",mode:"operational",onCreate:()=>window.__qa.actions.push("create"),onAction:(...args)=>window.__qa.actions.push(args),openRecordId:requested,onOpenRecordHandled:()=>setRequested(null)})));}',
  'createRoot(document.getElementById("root")).render(React.createElement(Harness));',
  '</script></body></html>',
].join('\n');
async function check(name, fn) { await fn(); checks.push({name, status:'passed'}); }
(async () => {
  const { createServer } = await import(pathToFileURL(path.join(ui, 'node_modules/vite/dist/node/index.js')).href);
  server = await createServer({
    configFile:path.join(ui,'vite.config.js'),root:ui,
    server:{host:'127.0.0.1',port:5178,strictPort:true},
    plugins:[{name:'mop-records-qa',configureServer(vite){
      vite.middlewares.use('/__records1097.html',async(_request,response,next)=>{
        try{response.setHeader('Content-Type','text/html');response.end(await vite.transformIndexHtml('/__records1097.html',html));}catch(error){next(error);}
      });
    }}],
  });
  await server.listen();
  browser = await chromium.launch({headless:true});
  const context = await browser.newContext({viewport:{width:1365,height:900}});
  await context.route('**/*',route=>{
    const url = new URL(route.request().url());
    if(url.hostname==='127.0.0.1'||url.hostname==='localhost')return route.continue();
    external.push(url.origin);return route.abort();
  });
  const page = await context.newPage();
  page.on('pageerror',error=>errors.push(error.message));
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('http://127.0.0.1:5178/__records1097.html');
  const rows=page.locator('[data-record-row]');
  const table=page.locator('.records1097');
  await check('TanStack table renders newest-first with five rows and correct details',async()=>{
    await expect(rows).toHaveCount(5);
    await expect(rows.first()).toHaveAttribute('data-record-row','R-0142');
    await expect(page.getByRole('complementary',{name:'Detalhes do registro'})).toContainText('R-0142');
  });
  await check('Sorting and paging use the real TanStack model',async()=>{
    await page.getByRole('button',{name:'Ordenar por Data / Hora',exact:true}).click();
    await expect(rows.first()).toHaveAttribute('data-record-row','R-0133');
    await page.getByRole('button',{name:'Próxima página',exact:true}).click();
    await expect(table).toContainText('Página 2 de 2');
    await page.getByLabel('Registros por página',{exact:true}).selectOption('10');
    await expect(rows).toHaveCount(10);
    await expect(table).toContainText('Página 1 de 1');
  });
  await check('Column visibility changes only presentation and Escape closes menu',async()=>{
    await page.getByRole('button',{name:'Escolher colunas'}).click();
    await page.getByRole('menuitemcheckbox',{name:'Condomínio',exact:true}).click();
    await expect(page.getByRole('menuitemcheckbox',{name:'Condomínio',exact:true})).toHaveAttribute('aria-checked','true');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(page.getByRole('columnheader',{name:'Ordenar por Condomínio'})).toBeVisible();
    await expect(rows).toHaveCount(10);
  });
  await check('Condominium, responsible person and search filters combine and clear',async()=>{
    await page.getByRole('button',{name:'Condomínio',exact:true}).click();
    await page.getByRole('option',{name:'Condomínio Beta',exact:true}).click();
    await expect(rows).toHaveCount(4);
    await page.getByRole('button',{name:'Responsável',exact:true}).click();
    await page.getByRole('option',{name:'Operador',exact:true}).click();
    await expect(rows).toHaveCount(3);
    await page.getByLabel('Buscar registro',{exact:true}).fill('backup');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toHaveAttribute('data-record-row','R-0141');
    await page.getByRole('button',{name:'Limpar filtros',exact:true}).first().click();
    await expect(rows).toHaveCount(10);
  });
  await check('Selection opens matching details and link requests reveal the target page',async()=>{
    await page.getByRole('button',{name:/Abrir registro R-0135:/}).click();
    await expect(page.getByRole('complementary',{name:'Detalhes do registro'})).toContainText('R-0135');
    await page.getByLabel('Registros por página',{exact:true}).selectOption('5');
    await page.evaluate(()=>window.__qa.open('R-0142'));
    await expect(page.getByRole('button',{name:/Abrir registro R-0142:/})).toBeVisible();
    await expect(page.getByRole('complementary',{name:'Detalhes do registro'})).toContainText('R-0142');
    await expect(table).toContainText('Página 2 de 2');
  });
  await check('Empty filtering state is useful and reversible',async()=>{
    await page.getByLabel('Buscar registro',{exact:true}).fill('record-that-does-not-exist');
    await expect(rows).toHaveCount(0);
    await expect(table).toContainText('Nenhum resultado encontrado');
    await page.getByRole('button',{name:'Limpar filtros',exact:true}).first().click();
    await expect(rows).toHaveCount(5);
  });
  await check('Viewer cannot invoke create, edit, duplicate or delete actions',async()=>{
    await page.evaluate(()=>window.__qa.setRole('viewer'));
    for(const name of ['Novo Registro','Editar','Duplicar','Excluir'])await expect(page.getByRole('button',{name,exact:true})).toBeDisabled();
    assert.deepEqual(await page.evaluate(()=>window.__qa.actions),[]);
  });
  await page.screenshot({path:path.join(output,'records-desktop.png'),fullPage:true});
  await check('Compact cards retain sorting and avoid horizontal page overflow',async()=>{
    await page.setViewportSize({width:390,height:844});
    await expect(page.getByLabel('Ordenação dos registros',{exact:true})).toBeVisible();
    await page.getByLabel('Ordenação dos registros',{exact:true}).selectOption('occurredAt:desc');
    await expect(rows.first()).toHaveAttribute('data-record-row','R-0142');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
    await page.screenshot({path:path.join(output,'records-compact.png'),fullPage:true});
  });
  await check('No JavaScript errors or external requests',async()=>{
    assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  });
  const report={status:'passed',checks:checks.length,details:checks,fixture:'RecordsPage with fictional sampleRecords; no Electron bridge or database',screenshots:['records-desktop.png','records-compact.png']};
  fs.writeFileSync(path.join(output,'ui-report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report));
})().catch(error=>{
  fs.writeFileSync(path.join(output,'ui-report.json'),JSON.stringify({status:'failed',checks:checks.length,details:checks,error:error.stack,errors,external},null,2)+'\n');
  console.error(error);process.exitCode=1;
}).finally(async()=>{if(browser)await browser.close();if(server)await server.close();});
