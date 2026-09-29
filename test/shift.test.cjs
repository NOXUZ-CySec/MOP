const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const shift=require('../src/shift.js');
const {empty}=require('../desktop/store.cjs');
for(const [time,type,date,remaining] of [
 ['2026-09-26T05:59:59.999-03:00','Noturno','2026-09-25',1],
 ['2026-09-26T06:00:00-03:00','Diurno','2026-09-26',43200000],
 ['2026-09-26T17:59:59.999-03:00','Diurno','2026-09-26',1],
 ['2026-09-26T18:00:00-03:00','Noturno','2026-09-26',43200000],
 ['2026-09-26T23:59:59.999-03:00','Noturno','2026-09-26',21600001],
 ['2026-09-27T00:00:00-03:00','Noturno','2026-09-26',21600000],
 ['2027-01-01T00:00:00-03:00','Noturno','2026-12-31',21600000],
 ['2026-03-01T00:00:00-03:00','Noturno','2026-02-28',21600000],
 ['2028-03-01T00:00:00-03:00','Noturno','2028-02-29',21600000]
])test('limite '+time,()=>{const s=shift.at(time);assert.equal(s.type,type);assert.equal(s.date,date);assert.equal(Date.parse(s.end_at)-Date.parse(time),remaining);assert.equal(s.time_zone,'America/Sao_Paulo');});
test('mesmo instante em outro fuso e independencia do fuso do computador',()=>{
 const before=process.env.TZ;
 try{process.env.TZ='Asia/Tokyo';assert.deepEqual(shift.at('2026-09-26T09:00:00Z'),shift.at('2026-09-26T06:00:00-03:00'));assert.equal(shift.at('2026-09-26T09:00:00Z').type,'Diurno');}
 finally{if(before===undefined)delete process.env.TZ;else process.env.TZ=before;}
});
test('recebimento manual vale so para o turno da confirmacao, inclusive legado',()=>{
 const h=[{at:'2026-09-26T18:01:00-03:00'}],before=JSON.stringify(h);
 assert.equal(shift.received([],shift.at(h[0].at)),false);
 assert.equal(shift.received(h,shift.at('2026-09-27T00:00:00-03:00')),true);
 assert.equal(shift.received(h,shift.at('2026-09-27T06:00:00-03:00')),false);
 assert.equal(JSON.stringify(h),before);
});
test('acoes usam o instante de gravacao; backups novos e antigos preservados',async()=>{
 let now='2026-09-26T05:59:59-03:00',state=empty();
 class Clock extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return Date.parse(now);}}
 const app=fs.readFileSync(path.join(__dirname,'../src/app.js'),'utf8');
 const context=vm.createContext({window:{mopAccount:{display_name:'Operador Turno',userId:'user-turno'},mopDesktop:{read:()=>structuredClone(state),write:s=>{state=structuredClone(s);}}},MOPShift:shift,crypto:webcrypto,Intl,Date:Clock});
 let code=app.slice(0,app.indexOf('let toastTimer;'));
 for(const prefix of ['function createProtocol(','function ensureProtocols(','const planningKeys=','const requestCategories=','function validLocalDate(','function planningValues(','const calendarZone=','function calendarDate('])code+='\n'+app.split('\n').find(line=>line.startsWith(prefix));
 code+='\n'+app.slice(app.indexOf('function validateImport('),app.indexOf("$('#importFile').onchange"));
 code+='\nglobalThis.api={request,validateImport};';vm.runInContext(code,context);
 const {request,validateImport}=context.api;
 const {id}=await request('/api/items','POST',{condo:'CEA',category:'Outros',subject:'Teste',description:'Teste',created_by:'A'});assert.equal(state.items[0].created_by,'Operador Turno');
 assert.equal(state.items[0].created_shift.id,'2026-09-25/Noturno');
 now='2026-09-26T06:00:00-03:00';
 await request('/api/items/'+id+'/planning','POST',{actor:'B',assignee:'Equipe'});assert.equal(state.items[0].updated_by,'Operador Turno');assert.equal(state.events.at(-1).actor,'Operador Turno');
 assert.equal(state.items[0].updated_shift.id,'2026-09-26/Diurno');
 assert.equal(state.events.at(-1).shift.id,'2026-09-26/Diurno');
 now='2026-09-26T18:00:00-03:00';
 await request('/api/items/'+id+'/update','POST',{actor:'B',note:'Feito',status:'Resolvido'});assert.equal(state.items[0].updated_by,'Operador Turno');assert.equal(state.events.at(-1).actor,'Operador Turno');
 assert.equal(state.events.at(-1).shift.id,'2026-09-26/Noturno');
 now='2026-09-27T00:00:00-03:00';
 await request('/api/items/'+id+'/resolved-edit','POST',{note:'Nota',action_taken:'Conferido'});
 await request('/api/handovers','POST',{incoming:'Nome forjado',outgoing:'B'});
 assert.equal(state.handovers[0].incoming,'Operador Turno');assert.equal(state.handovers[0].receipt_user_id,'user-turno');assert.equal(state.handovers[0].receipt_slot,'2026-09-26-N');
 assert.equal(state.handovers[0].shift.id,'2026-09-26/Noturno');
 assert.equal(state.events.at(-1).shift.id,'2026-09-26/Noturno');
 assert.equal(state.items[0].created_shift.id,'2026-09-25/Noturno');
 assert.equal(state.items[0].updated_shift.id,'2026-09-26/Noturno');
 assert.equal(state.handovers[0].snapshot.length,0);
 assert.equal(JSON.stringify(validateImport(JSON.parse(JSON.stringify(state)))),JSON.stringify(state));
 const legacy=JSON.parse(JSON.stringify(state));
 for(const row of [...legacy.items,...legacy.events,...legacy.handovers]){delete row.shift;delete row.created_shift;delete row.updated_shift;}
 const preserved=JSON.stringify(legacy);
 assert.equal(JSON.stringify(validateImport(legacy)),preserved);
 assert.equal(JSON.stringify(legacy),preserved);
});
