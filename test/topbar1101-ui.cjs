"use strict";
// Full viewport regression: operational shortcuts must never scroll the window chrome.
const fs=require("node:fs"),path=require("node:path"),http=require("node:http"),crypto=require("node:crypto"),assert=require("node:assert/strict");
const {chromium,expect}=require(process.env.MOP_PLAYWRIGHT_MODULE||"@playwright/test");
const root=path.resolve(__dirname,"..");
const build=path.resolve(process.env.MOP_TOPBAR1101_BUILD_DIR||path.join(root,"ui-next/dist"));
const output=path.resolve(process.env.MOP_TOPBAR1101_OUTPUT_DIR||path.join(root,"test-results/release1101"));
const shots=path.join(output,"screenshots"),checks=[],states=[],screenshots=[];
const version=JSON.parse(fs.readFileSync(path.join(root,"package.json"),"utf8").replace(/^\uFEFF/,"")).version;
fs.mkdirSync(shots,{recursive:true});
let browser,fixtureAPI,lastPage,server;
const flush=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
const hash=file=>crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
async function geometry(page,label){
 const state=await page.evaluate(label=>{
  const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}};
  const nodes=Object.fromEntries([".ref-app",".ref-page",".ref-sidebar",".ref-brand",".ref-header",".ref-main"].map(selector=>{
   const e=document.querySelector(selector);return[selector,e?{...rect(e),scrollTop:e.scrollTop,scrollLeft:e.scrollLeft,scrollHeight:e.scrollHeight,overflow:getComputedStyle(e).overflow}:null];
  }));
  const buttons=[...document.querySelectorAll(".ref-window-actions button")].map(e=>{
   const r=rect(e),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
   return{label:e.getAttribute("aria-label"),...r,receivesPointer:hit===e||e.contains(hit)};
  });
  return{label,width:innerWidth,height:innerHeight,scrollX,scrollY,nodes,buttons};
 },label);
 states.push(state);return state;
}
async function chromeVisible(page,label,baseline){
 const g=await geometry(page,label),header=g.nodes[".ref-header"],main=g.nodes[".ref-main"],brand=g.nodes[".ref-brand"];
 assert.ok(header&&header.height>=35,label+": header has a visible height");
 assert.ok(header.y>=0&&header.bottom<=g.height,label+": header stays inside viewport");
 assert.ok(brand&&brand.y>=0&&brand.bottom<=g.height,label+": sidebar brand stays inside viewport");
 assert.ok(main.y>=header.bottom-1,label+": content does not cover header");
 assert.equal(g.scrollY,0,label+": document must not scroll");
 for(const selector of [".ref-app",".ref-page"]){
  assert.equal(g.nodes[selector].scrollTop,0,label+": "+selector+" must not scroll vertically");
  assert.equal(g.nodes[selector].scrollLeft,0,label+": "+selector+" must not scroll horizontally");
 }
 assert.equal(g.buttons.length,3,label+": all window controls exist");
 for(const b of g.buttons){
  assert.ok(b.width>0&&b.height>0&&b.x>=0&&b.y>=0&&b.right<=g.width&&b.bottom<=g.height,label+": "+b.label+" stays inside viewport");
  assert.ok(b.receivesPointer,label+": "+b.label+" receives pointer input");
 }
 if(baseline){
  assert.ok(Math.abs(header.y-baseline.nodes[".ref-header"].y)<1,label+": header did not move");
  assert.ok(Math.abs(brand.y-baseline.nodes[".ref-brand"].y)<1,label+": logo did not move");
 }
 return g;
}
async function check(name,fn){await fn();checks.push({name,status:"passed"});console.log("PASS "+name);}
async function capture(page,name){await page.screenshot({path:path.join(shots,name),animations:"disabled"});screenshots.push(name);}
async function fixture(options={}){
 const f=await fixtureAPI.fixture(options);lastPage=f.page;f.page.setDefaultTimeout(10000);
 await f.page.locator(".ref-brand img").evaluate(async image=>{await image.decode();if(!image.complete||!image.naturalWidth)throw Error("Sidebar logo did not load")});
 await f.page.evaluate(()=>{
  const q=window.__handoverQA;q.windowCommands=[];q.windowMaximized=false;
  window.mopWindow.command=async action=>{q.windowCommands.push(action);if(action==="maximize")q.windowMaximized=!q.windowMaximized;return{maximized:q.windowMaximized}};
 });
 return f;
}
async function metricShortcuts(f,size){
 const{page,panel}=f;await page.setViewportSize(size);await flush(page);
 const baseline=await chromeVisible(page,"initial "+size.width+"x"+size.height);
 for(const label of ["Pend\u00eancias abertas","Exigem leitura","Prazos vencidos","Orienta\u00e7\u00e3o incompleta"]){
  await page.locator(".ref-main").evaluate(e=>{e.scrollTop=0});await flush(page);
  await panel.locator(".handover110-metric").filter({hasText:label}).click();await flush(page);
  await chromeVisible(page,"metric "+label+" "+size.width,baseline);
  assert.ok(await page.locator(".ref-main").evaluate(e=>e.scrollTop>0),label+": queue shortcut scrolled content");
  const queue=await panel.locator("#handover110-queue").boundingBox(),main=await page.locator(".ref-main").boundingBox();
  assert.ok(queue&&main&&queue.y>=main.y-1&&queue.y<main.y+main.height,label+": queue starts within content viewport");
 }
 await capture(page,"topbar-metrics-"+size.width+".png");
 return baseline;
}
async function run(){
 assert.ok(fs.existsSync(path.join(build,"index.html")),"Built UI is required");
 server=http.createServer((req,res)=>{
  let relative;try{relative=decodeURIComponent(new URL(req.url,"http://127.0.0.1").pathname)}catch{res.writeHead(400);res.end();return}
  if(relative==="/")relative="/index.html";
  const file=path.resolve(build,"."+relative);
  if(!file.startsWith(build+path.sep)){res.writeHead(403);res.end();return}
  fs.readFile(file,(error,data)=>{if(error){res.writeHead(404);res.end();return}
   const types={".html":"text/html",".js":"application/javascript",".css":"text/css",".svg":"image/svg+xml",".webp":"image/webp",".png":"image/png"};
   res.setHeader("Content-Type",types[path.extname(file)]||"application/octet-stream");res.end(data);
  });
 });
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 process.env.MOP_HANDOVER110_URL="http://127.0.0.1:"+server.address().port+"/";
 // Reuse the existing synthetic account/records/session fixture without running its suite.
 const source=fs.readFileSync(path.join(__dirname,"handover110-ui.cjs"),"utf8");
 const boundary=source.indexOf("async function runTests(){");assert.ok(boundary>0,"Shared fixture boundary exists");
 const fixtureSource=source.slice(0,boundary).replace("fs.mkdirSync(shots,{recursive:true});","");
 fixtureAPI=new Function("require","__dirname",fixtureSource+"\nreturn {fixture,errors,external,setBrowser:value=>{browser=value}};")(require,__dirname);
 browser=await chromium.launch({headless:true});fixtureAPI.setBrowser(browser);
 const f=await fixture({role:"admin"}),{page,nav,panel}=f;
 await check("Desktop window chrome remains visible after all handover metric shortcuts",async()=>{await metricShortcuts(f,{width:1440,height:900})});
 await check("Review-orientation shortcut scrolls only the operational content",async()=>{
  const baseline=await chromeVisible(page,"before review orientations");
  await panel.getByRole("button",{name:/^Revisar orienta/}).click();await flush(page);
  await chromeVisible(page,"after review orientations",baseline);
 });
 await check("Home navigation and content scrolling preserve header, brand and controls",async()=>{
  await nav.getByRole("button",{name:"In\u00edcio",exact:true}).click();await flush(page);
  const baseline=await chromeVisible(page,"home after shortcuts");
  await page.locator(".ref-main").evaluate(e=>{e.scrollTop=e.scrollHeight});await flush(page);
  await chromeVisible(page,"home scrolled bottom",baseline);
  await page.locator(".ref-main").evaluate(e=>{e.scrollTop=0});await flush(page);
  await capture(page,"topbar-home-1440.png");
 });
 await check("Minimize, maximize, restore and close confirmation remain reachable",async()=>{
  await page.getByRole("button",{name:"Minimizar janela",exact:true}).click();
  await page.getByRole("button",{name:"Maximizar janela",exact:true}).click();
  await page.getByRole("button",{name:"Restaurar janela",exact:true}).click();
  const close=page.getByRole("button",{name:"Fechar janela",exact:true}),dialog=page.getByRole("alertdialog",{name:"Encerrar o MOP?"});
  await close.click();await expect(dialog).toBeVisible();await expect(dialog.getByRole("button",{name:"Cancelar",exact:true})).toBeFocused();
  await capture(page,"topbar-close-confirmation.png");
  await dialog.getByRole("button",{name:"Cancelar",exact:true}).click();await expect(dialog).toBeHidden();await expect(close).toBeFocused();
  await close.click();await page.keyboard.press("Escape");await expect(dialog).toBeHidden();
  assert.deepEqual(await page.evaluate(()=>window.__handoverQA.windowCommands),["minimize","maximize","maximize"]);
  await chromeVisible(page,"after window controls");
 });
 await nav.getByRole("button",{name:"Passagem de Turno",exact:true}).click();await expect(panel).toBeVisible();
 await check("Compact desktop keeps chrome visible after metric shortcuts and resize",async()=>{await metricShortcuts(f,{width:1024,height:640})});
 await check("Narrow layout keeps chrome visible after metric shortcuts and resize",async()=>{await metricShortcuts(f,{width:390,height:844})});
 await check("Returning from a narrow layout retains all desktop window controls",async()=>{
  await page.setViewportSize({width:1440,height:900});await flush(page);
  await chromeVisible(page,"restored desktop viewport");
  await nav.getByRole("button",{name:"In\u00edcio",exact:true}).click();await flush(page);
  await chromeVisible(page,"home after responsive resize");await capture(page,"topbar-home-after-resize.png");
 });
 const receipt=await fixture({role:"admin",snapshot:{stage:"receipt",deliveryId:410,outgoing:"Operador anterior",incoming:"Operador alpha",deliverySummary:"Conferir os dois registros priorit\u00e1rios.",deliveredAt:"2026-11-25T10:55:00.000Z"}});
 await receipt.page.setViewportSize({width:1440,height:900});await flush(receipt.page);
 await check("Unread critical item shortcuts preserve chrome and reveal the selected record",async()=>{
  const baseline=await chromeVisible(receipt.page,"receipt before shortcut");
  const unread=receipt.panel.locator(".handover110-unread button");
  await expect(unread.first()).toBeVisible();
  for(let i=0;i<await unread.count();i++){
   const protocol=(await unread.nth(i).textContent()).match(/MOP-QA-\d+/)?.[0];assert.ok(protocol,"Unread shortcut identifies its record");
   await unread.nth(i).click();await flush(receipt.page);
   const row=receipt.panel.locator(".handover110-item").filter({has:receipt.page.locator(".handover110-item-meta b",{hasText:protocol})});
   await expect(row.locator(".handover110-item-toggle")).toHaveAttribute("aria-expanded","true");
   await chromeVisible(receipt.page,"receipt unread item "+i,baseline);
  }
  await capture(receipt.page,"topbar-receipt-shortcuts.png");
  await receipt.nav.getByRole("button",{name:"In\u00edcio",exact:true}).click();await flush(receipt.page);
  await chromeVisible(receipt.page,"home after receipt shortcuts");await capture(receipt.page,"topbar-home-after-receipt.png");
 });
 await check("Full shell tests perform no operational writes or external network requests",async()=>{
  for(const current of [f,receipt])assert.deepEqual(await current.page.evaluate(()=>{const c=window.__handoverQA.calls;return[c.deliver,c.receive,c.assignPending,c.unexpected]}),[0,0,0,0]);
  assert.deepEqual(fixtureAPI.errors,[]);assert.deepEqual(fixtureAPI.external,[]);
 });
 await f.context.close();await receipt.context.close();
 const report={status:"passed",version,checks:checks.length,details:checks,
  uiBuild:build,uiIndexSHA256:hash(path.join(build,"index.html")),uiAssets:fs.readdirSync(path.join(build,"assets")).filter(name=>/\.(?:js|css)$/.test(name)).sort().map(name=>({file:"assets/"+name,sha256:hash(path.join(build,"assets",name))})),testSHA256:hash(__filename),screenshots,states,
  externalRequests:fixtureAPI.external.length,pageErrors:fixtureAPI.errors,
  runtime:"Playwright Chromium; full viewport geometry, pointer hit tests and UI actions",
  isolation:"Synthetic Electron bridge and accounts; loopback-only requests; no operational profiles or databases",
  limitation:"Native maximize/minimize and OS drag regions require separate Electron verification"};
 fs.writeFileSync(path.join(output,"topbar-ui-report.json"),JSON.stringify(report,null,2)+"\n");
 console.log(JSON.stringify({status:report.status,checks:report.checks,output}));
}
run().catch(async error=>{
 if(lastPage&&!lastPage.isClosed()){await capture(lastPage,"topbar-failure.png").catch(()=>{});await geometry(lastPage,"failure").catch(()=>{})}
 fs.writeFileSync(path.join(output,"topbar-ui-report.json"),JSON.stringify({status:"failed",version,checks:checks.length,details:checks,error:error.stack,states,screenshots,external:fixtureAPI?.external,pageErrors:fixtureAPI?.errors},null,2)+"\n");
 console.error(error);process.exitCode=1;
}).finally(async()=>{await browser?.close().catch(()=>{});if(server)await new Promise(resolve=>server.close(resolve))});
