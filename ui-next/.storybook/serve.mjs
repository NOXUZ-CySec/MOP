import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const root = path.join(project, "storybook-static");
const port = 6006;
const url = "http://127.0.0.1:6006/";
const open = () => { if (process.argv.includes("--open")) execFile("cmd.exe", ["/c", "start", "", url]); };
if (!fs.existsSync(path.join(root, "index.html"))) {
 console.error("Compile o catálogo primeiro: npm run build-storybook");
 process.exit(1);
}
const mime = {".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".mjs":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json; charset=utf-8",".svg":"image/svg+xml",".png":"image/png",".webp":"image/webp",".ico":"image/x-icon",".woff2":"font/woff2"};
const server = http.createServer((req,res) => {
 if (!["GET","HEAD"].includes(req.method)) { res.writeHead(405);res.end();return; }
 try {
  const pathname = decodeURIComponent(new URL(req.url,url).pathname);
  let file = path.resolve(root, "." + pathname);
  if (file === root) file = path.join(root,"index.html");
  if (!file.startsWith(root + path.sep)) {res.writeHead(403);res.end();return;}
  if (fs.statSync(file).isDirectory()) file = path.join(file,"index.html");
  const real = fs.realpathSync(file);
  if (!real.startsWith(fs.realpathSync(root) + path.sep)) {res.writeHead(403);res.end();return;}
  const info=fs.statSync(real);
  res.writeHead(200,{"Content-Type":mime[path.extname(real)] || "application/octet-stream","Content-Length":info.size,"X-Content-Type-Options":"nosniff","Cache-Control":"no-cache"});
  if (req.method === "HEAD")res.end();else fs.createReadStream(real).pipe(res);
 } catch { res.writeHead(404);res.end("Arquivo não encontrado."); }
});
server.on("error", async error => {
 if (error.code === "EADDRINUSE") {
  try {
   const response=await fetch(url+"index.json",{signal:AbortSignal.timeout(2000)});
   const index=await response.json();
   if (Object.keys(index.entries||{}).some(key=>key.startsWith("mop-foundations--"))) { console.log("Catálogo MOP já está disponível em "+url);open();return; }
  } catch {}
 }
 console.error("Não foi possível iniciar o catálogo: "+error.message);
 process.exitCode=1;
});
server.listen(port,"127.0.0.1",()=>{console.log("Catálogo visual do MOP: "+url+" (somente neste computador)");open();});
