'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
test('94 homologation: isolated Supabase project and public key only',()=>{
 const settings=require('../desktop/supabase-config.cjs');
 assert.equal(settings.url,'https://aviolcwjaxpfwhmrapoe.supabase.co');
 assert.match(settings.key,/^sb_publishable_/);
 assert.ok(!('service_role' in settings));
 const main=fs.readFileSync(path.join(root,'desktop/main-next43.cjs'),'utf8');
 assert.match(main,/MOP-UI-Next-Homologacao/);
 assert.ok(!main.includes("'MOP-UI-Next-Preview41'"));
 assert.match(main,/isPackaged:false \/\* isolated homologation/);
});
test('94 homologation: unique application identity, installer and corporate UI',()=>{
 const config=JSON.parse(fs.readFileSync(path.join(root,'electron-builder-ui-next94-homolog.json'),'utf8'));
 assert.equal(config.appId,'br.com.mop.preview94.homologacao');
 assert.equal(config.directories.output,'dist-ui-next-94-homolog');
 assert.equal(config.extraMetadata.version,'2.3.0-preview.94-homolog.1');
 assert.match(config.nsis.shortcutName,/Homologacao/);
 const source=fs.readFileSync(path.join(root,'ui-next/src/main.tsx'),'utf8');
 assert.match(source,/Preview\.94 HOMOLOGAÇÃO/);
 const notes=JSON.parse(fs.readFileSync(path.join(root,'desktop/release-notes.json'),'utf8'));
 assert.equal(notes[0].version,'2.3.0-preview.94-homolog.1');
});
