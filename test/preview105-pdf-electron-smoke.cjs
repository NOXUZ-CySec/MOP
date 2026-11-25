'use strict';
const {app}=require('electron');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
(async()=>{
 await app.whenReady();
 const exporter=require('../desktop/report-export105.cjs');
 const tmp=path.join(os.tmpdir(),'mop-preview105-smoke-'+process.pid+'.pdf');
 try{
  const data={section:'records',sectionTitle:'Registros',period:'Hoje',condo:'CEA',category:'Segurança',status:'Todos os status',operator:'Supervisor de Testes',role:'supervisor',generated:'21/11/2026 15:00',headings:['Protocolo','Título','Condomínio','Status','Data'],rows:[['MOP-TESTE-001','Câmera sem comunicação','CEA','Pendente','21/11/2026 14:00']],stats:[['Registros',1]]};
  await exporter.generate(data,'pdf',tmp);
  const bytes=await fs.readFile(tmp);
  if(bytes.subarray(0,4).toString()!=='%PDF'||bytes.length<1000)throw Error('PDF inválido: '+bytes.length);
  process.stdout.write('PDF validado; bytes='+bytes.length+'\n');
  await fs.unlink(tmp);app.exit(0);
 }catch(e){process.stderr.write(String(e.stack||e)+'\n');await fs.rm(tmp,{force:true});app.exit(1)}
})();
