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
 assert.match(main,/isPackaged:\s*app\.isPackaged\s*&&\s*!process\.env\.PORTABLE_EXECUTABLE_FILE/);
});
test('Homologation uses the canonical preview identity, installer and current UI version',()=>{
 const config=require('../electron-builder-preview.cjs');
 const pkg=require('../package.json');
 const preview=pkg.version.split('-preview.')[1];
 assert.match(preview,/^\d+(?:\.\d+)*$/);
 assert.equal(config.appId,'br.com.mop.preview94.homologacao');
 assert.equal(config.directories.output,'dist-ui-next-'+preview.replaceAll('.','-'));
 assert.equal(config.extraMetadata.version,pkg.version);
 assert.equal(config.win.artifactName,'MOP-Preview'+preview+'-Instalador.exe');
 assert.equal(config.publish[0].releaseType,'prerelease');
 assert.match(config.nsis.shortcutName,/Homologacao/);
 const source=fs.readFileSync(path.join(root,'ui-next/src/main.tsx'),'utf8');
 assert.match(source,/\{previewLabel1098\} HOMOLOGA\u00c7\u00c3O/);
 const notes=JSON.parse(fs.readFileSync(path.join(root,'desktop/release-notes.json'),'utf8'));
 assert.equal(notes[0].version,pkg.version);
});
