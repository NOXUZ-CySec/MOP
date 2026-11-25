import { useEffect, useRef, useState } from 'react';
import { ArchiveRestore, FolderOpen, HardDriveDownload, LoaderCircle, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import RecordFilterDropdown from './RecordFilterDropdown';
import './backup1098.css';

export type BackupAction1098 = 'status'|'create'|'verify'|'restore'|'open-folder';
export type BackupInput1098 = {id?:string;protection?:'windows-user'|'passphrase';password?:string};
type Snapshot = {id:string;bytes:number;modifiedAt:string;protection:'windows-user'|'passphrase'};
type Status = {snapshots:Snapshot[];busy:boolean;windowsAvailable:boolean;portableAvailable:boolean;backupDirectory:string};
type Result = {id?:string;integrity?:string;verified?:boolean;tableCount?:number;pendingOperations?:number;conflicts?:number;destinationDirectory?:string;sha256?:string};
const size = (bytes:number) => bytes < 1024*1024 ? (bytes/1024).toFixed(1)+' KB' : (bytes/1024/1024).toFixed(1)+' MB';
const date = (value:string) => new Date(value).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'});
async function request<T>(action:BackupAction1098,input?:BackupInput1098):Promise<T> {
  if (!window.mopDesktop?.backup1098) throw Error('Backup disponível no aplicativo MOP atualizado.');
  return await window.mopDesktop.backup1098(action,input) as T;
}

export default function Backup1098() {
  const [status,setStatus]=useState<Status|null>(null);
  const [busy,setBusy]=useState<BackupAction1098|null>('status');
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const [protection,setProtection]=useState<'windows-user'|'passphrase'>('windows-user');
  const [password,setPassword]=useState(''),[confirmation,setConfirmation]=useState('');
  const [unlockPassword,setUnlockPassword]=useState('');
  const [selected,setSelected]=useState('');
  const [result,setResult]=useState<Result|null>(null);
  const alive=useRef(false),inFlight=useRef(false);
  const snapshot=status?.snapshots.find(item=>item.id===selected);
  const protectionLabels:Record<string,string>={'windows-user':'Meu usuário do Windows',passphrase:'Portátil, com senha'};
  const snapshotLabels=new Map((status?.snapshots||[]).map(item=>[item.id,date(item.modifiedAt)+' · '+size(item.bytes)+' · '+(item.protection==='passphrase'?'Portátil':'Windows')]));
  useEffect(()=>{
    alive.current=true;
    void request<Status>('status').then(value=>{
      if(!alive.current)return;setStatus(value);setSelected(value.snapshots[0]?.id||'');
      if(!value.windowsAvailable)setProtection('passphrase');
    }).catch(e=>{if(alive.current)setError(e instanceof Error?e.message:'Não foi possível listar os backups.');})
      .finally(()=>{if(alive.current)setBusy(null)});
    const off=window.mopDesktop?.onLocked(()=>{alive.current=false;setPassword('');setConfirmation('');setUnlockPassword('');setStatus(null);setResult(null)});
    return()=>{alive.current=false;off?.()};
  },[]);
  const run=async(action:BackupAction1098)=>{
    if(inFlight.current||!alive.current)return;
    setError('');setMessage('');setResult(null);
    if(action==='create'&&protection==='passphrase'&&(password.length<12||password!==confirmation)) {
      setError('Use uma senha com pelo menos 12 caracteres e confirme a mesma senha.');return;
    }
    if((action==='verify'||action==='restore')&&!selected){setError('Selecione um backup.');return}
    if((action==='verify'||action==='restore')&&snapshot?.protection==='passphrase'&&unlockPassword.length<12){
      setError('Informe a senha usada para criar este backup portátil.');return;
    }
    inFlight.current=true;setBusy(action);
    try {
      const input:BackupInput1098|undefined=action==='create'
        ?{protection,...(protection==='passphrase'?{password}:{})}
        :(action==='verify'||action==='restore')?{id:selected,...(snapshot?.protection==='passphrase'?{password:unlockPassword}:{})}:undefined;
      const value=await request<Result>(action,input);
      if(!alive.current)return;
      if(action==='status')setStatus(value as unknown as Status);
      else if(action!=='open-folder')setResult(value);
      setMessage(({create:'Backup criado e verificado.',verify:'Integridade e proteção verificadas.',restore:'Recuperação testada em uma nova pasta. O banco em uso permanece ativo.','open-folder':'Pasta de backups aberta.',status:'Lista atualizada.'})[action]);
      if(action==='create'||action==='status'){
        const fresh=action==='status'?value as unknown as Status:await request<Status>('status');
        if(!alive.current)return;
        setStatus(fresh);setSelected(value.id||fresh.snapshots.find(item=>item.id===selected)?.id||fresh.snapshots[0]?.id||'');
      }
    } catch(e) {if(alive.current)setError(e instanceof Error?e.message:'Não foi possível concluir a operação.');}
    finally{
      inFlight.current=false;
      if(alive.current){setBusy(null);setPassword('');setConfirmation('');setUnlockPassword('')}
    }
  };
  const disabled=!!busy||!!status?.busy;
  return <section className="mop-backup1098" aria-labelledby="backup1098-title">
    <header><span className="mop-backup1098-icon"><ShieldCheck size={24}/></span><div>
      <span className="mop-backup1098-eyebrow">CONFIABILIDADE · ACESSO ADMINISTRATIVO</span>
      <h2 id="backup1098-title">Backup e recuperação</h2>
      <p>Uma cópia protegida de todo o banco local, incluindo a fila de sincronização.</p>
    </div></header>
    <div className="mop-backup1098-grid">
      <div className="mop-backup1098-card">
        <h3><HardDriveDownload size={18}/> Criar uma cópia</h3>
        <label htmlFor="backup1098-protection">Proteção do backup</label>
        <RecordFilterDropdown id="backup1098-protection" label="Proteção do backup" value={protection}
          options={status?.windowsAvailable?['windows-user','passphrase']:['passphrase']}
          display={value=>protectionLabels[value]||value} icon={ShieldCheck} hideSelectedOption disabled={disabled||!status}
          onChange={value=>{setProtection(value as typeof protection);setPassword('');setConfirmation('')}}/>
        {protection==='windows-user'?<p className="mop-backup1098-help">Pode ser aberto por este perfil do Windows. Para recuperar após trocar de computador ou reinstalar o sistema, escolha a opção portátil.</p>:<>
          <p className="mop-backup1098-help">Pode ser recuperado em outro computador com a senha. Guarde-a em local seguro: o MOP não consegue recuperá-la.</p>
          <label htmlFor="backup1098-password">Senha do backup · mínimo de 12 caracteres</label>
          <input id="backup1098-password" type="password" autoComplete="new-password" maxLength={256} value={password} disabled={disabled} onChange={e=>setPassword(e.target.value)}/>
          <label htmlFor="backup1098-confirm">Confirmar senha do backup</label>
          <input id="backup1098-confirm" type="password" autoComplete="new-password" maxLength={256} value={confirmation} disabled={disabled} onChange={e=>setConfirmation(e.target.value)}/>
        </>}
        <Button className="mop-backup1098-primary" disabled={disabled||!status} onClick={()=>void run('create')}>
          {busy==='create'?<LoaderCircle className="mop-backup1098-spin" size={17}/>:<HardDriveDownload size={17}/>} Criar backup integral protegido
        </Button>
      </div>
      <div className="mop-backup1098-card">
        <h3><ArchiveRestore size={18}/> Verificar e recuperar</h3>
        <label htmlFor="backup1098-selected">Backups disponíveis</label>
        <RecordFilterDropdown id="backup1098-selected" label="Backups disponíveis" value={selected}
          options={(status?.snapshots||[]).map(item=>item.id)} display={value=>snapshotLabels.get(value)||value}
          placeholder="Nenhum backup integral disponível" icon={ArchiveRestore} hideSelectedOption disabled={disabled||!status?.snapshots.length}
          onChange={value=>{setSelected(value);setUnlockPassword('');setResult(null);setMessage('');setError('')}}/>
        <p className="mop-backup1098-help">A verificação confere o arquivo e o banco SQLite. O teste de recuperação cria uma pasta separada e não substitui os dados em uso.</p>
        {snapshot?.protection==='passphrase'&&<>
          <label htmlFor="backup1098-unlock">Senha deste backup portátil</label>
          <input id="backup1098-unlock" type="password" autoComplete="off" maxLength={256} value={unlockPassword} disabled={disabled} onChange={e=>setUnlockPassword(e.target.value)}/>
        </>}
        <div className="mop-backup1098-actions">
          <Button variant="outline" disabled={disabled||!selected} onClick={()=>void run('verify')}>Verificar backup</Button>
          <Button variant="outline" disabled={disabled||!selected} onClick={()=>void run('restore')}>Testar recuperação em nova pasta</Button>
        </div>
      </div>
    </div>
    <div className="mop-backup1098-toolbar">
      <Button variant="ghost" disabled={!!busy} onClick={()=>void run('status')}>Atualizar lista</Button>
      <Button variant="ghost" disabled={disabled||!status} onClick={()=>void run('open-folder')}><FolderOpen size={16}/> Abrir pasta de backups</Button>
      {busy&&<span role="status"><LoaderCircle size={15} className="mop-backup1098-spin"/> {busy==='status'?'Carregando backups…':'Operação em andamento…'}</span>}
    </div>
    {error&&<p className="mop-backup1098-error" role="alert">{error}</p>}
    {message&&<div className="mop-backup1098-result" role="status"><strong>{message}</strong>
      {result?.verified&&<p>{result.tableCount} tabelas verificadas · {result.pendingOperations} operações pendentes · {result.conflicts} conflitos preservados.</p>}
      {result?.destinationDirectory&&<p><b>Pasta da recuperação:</b> <code>{result.destinationDirectory}</code></p>}
      {result?.sha256&&<details><summary>Identificador de integridade SHA-256</summary><code>{result.sha256}</code></details>}
    </div>}
    <p className="mop-backup1098-scope">Inclui todas as tabelas do SQLite local. O banco central, arquivos externos e credenciais do perfil Windows não fazem parte desta cópia. Para proteger contra falha do disco, guarde uma cópia portátil também em outro dispositivo.</p>
  </section>;
}
