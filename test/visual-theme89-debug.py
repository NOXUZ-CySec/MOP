from pathlib import Path
import subprocess,tempfile,re,json,html
root=Path(__file__).resolve().parents[1]
css=next((root/'ui-next/dist/assets').glob('*.css'))
chrome=Path(r'C:\Program Files\Google\Chrome\Application\chrome.exe')
palettes={'mop':('#071e35','15,55,80','7,28,47','#56c8f6','58,136,178'),
'graphite':('#121b26','48,63,79','23,33,47','#9cbdcf','115,149,169'),
'contrast':('#030b13','15,43,65','4,20,33','#a4e8ff','116,202,238')}
selectors={
'.handover66-overview':['backgroundImage','borderTopColor'],
'.handover66-metrics>div.metric':['backgroundColor','borderTopColor'],
'.handover66-metrics>div.attention':['backgroundColor','borderTopColor'],
'.handover66-metrics>div.attention strong':['color'],
'.handover66-next button':['backgroundColor','borderTopColor'],
'.mop-home64-hero .mop-home55-top-actions button.primary':['backgroundColor','borderTopColor'],
'.mop-home64-hero .mop-home55-top-actions button.secondary':['backgroundColor','borderTopColor'],
'.mop-home64-hero .mop-home55-top-actions button.mop-home57-refresh':['backgroundColor','borderTopColor'],
'.mop-home59-panel':['backgroundImage','borderTopColor'],
'.mop-home59-timeline-item':['backgroundColor','borderBottomColor'],
'.mop-home59-pending-item':['backgroundColor','borderBottomColor'],
'.mop-home59-panel header>button':['backgroundColor'],
'.mop-home60-filterbar button.active':['backgroundColor','borderTopColor'],
'.handover-records':['backgroundColor'],
'.handover-tabs button.inactive':['backgroundColor','borderBottomColor'],
'.handover-tabs button.active':['backgroundColor','borderBottomColor'],
'.handover-item-summary':['backgroundColor'],
'.handover-item-details':['backgroundColor'],
'.handover-item-status.Pendente':['color','backgroundColor'],
'.mop-home59-status-label.pending':['color','backgroundColor'],
'.handover-item-icon.Pendente':['color','backgroundColor']}
body='''<section class="handover66-overview"><div class="handover66-overview-head"><div><strong>Conferência para entrega</strong></div></div><div class="handover66-metrics"><div class="metric"><strong>10</strong><span>Registros</span></div><div class="attention"><strong>1</strong><span>Urgentes</span></div></div><div class="handover66-next"><button>Revisar pendências</button></div></section>
<div class="mop-home64-hero"><div class="mop-home64-hero-side"><div class="mop-home55-top-actions"><button class="primary">Novo registro</button><button class="secondary">Passagem</button><button class="mop-home57-refresh">Atualizar</button></div></div></div>
<section class="mop-home54-panel mop-home59-panel"><header><div><h3>Principais acontecimentos</h3></div><button>Ver registros</button></header><div class="mop-home60-filterbar"><div><button class="active">Todos</button></div></div><div class="mop-home59-timeline"><button class="mop-home59-timeline-item">Evento</button></div><div class="mop-home59-pending-list"><button class="mop-home59-pending-item"><span class="mop-home59-status-label pending">Pendente</span></button></div></section>
<div class="handover-panel handover-records"><div class="handover-tabs"><button class="inactive">Pendências</button><button class="active">Registros do turno</button></div><div class="handover-items"><div class="handover-item"><button class="handover-item-summary">Registro <span class="handover-item-icon Pendente">!</span><span class="handover-item-status Pendente">Pendente</span></button><div class="handover-item-details">Detalhes</div></div></div></div>'''
with tempfile.TemporaryDirectory(prefix='mop89-theme-') as folder:
 folder=Path(folder);samples={}
 for name,(base,panel,deep,accent,border) in palettes.items():
  tokens=f'--mop86-base:{base};--mop86-panel:{panel};--mop86-deep:{deep};--mop86-accent:{accent};--mop86-border:{border};--mop86-opacity:.8;--mop86-blur:12px;--mop86-motion:260ms;'
  markup=f'''<!DOCTYPE html><html data-mop-theme="{name}" style="{tokens}"><head><meta charset="UTF-8"><link rel="stylesheet" href="{css.as_uri()}"></head><body><div class="ref-app mop-premium47 mop-pref85 mop-appearance86-root mop-palette-{name}" style="{tokens}">{body}</div><pre id="result"></pre><script>window.onload=()=>{{const checks={json.dumps(selectors)};const result={{}};for(const [selector,fields] of Object.entries(checks)){{const el=document.querySelector(selector);if(!el)throw Error('Missing '+selector);const st=getComputedStyle(el);result[selector]=Object.fromEntries(fields.map(field=>[field,st[field]]));}}result._debug={{matching:document.querySelector('.handover66-metrics>div.metric').matches('.ref-app.mop-appearance86-root .handover66-overview .handover66-metrics>div:not(.attention)'),background:getComputedStyle(document.querySelector('.handover66-metrics>div.metric')).background,inner:getComputedStyle(document.querySelector('.handover66-metrics>div.metric')).getPropertyValue('--mop89-inner')}};document.getElementById('result').textContent=JSON.stringify(result);}};</script></body></html>'''
  file=folder/(name+'.html');file.write_text(markup,encoding='utf-8')
  args=[str(chrome),'--headless=new','--no-first-run','--disable-gpu','--disable-extensions','--disable-background-networking','--disable-default-apps','--allow-file-access-from-files','--dump-dom','--virtual-time-budget=2500','--user-data-dir='+str(folder/(name+'-profile')),file.as_uri()]
  proc=subprocess.run(args,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,timeout=35,creationflags=subprocess.CREATE_NO_WINDOW)
  m=re.search(r'<pre id="result">([^<]*)</pre>',proc.stdout.decode('utf-8',errors='replace'))
  if not m:raise RuntimeError('Missing Chrome computed styles '+name)
  samples[name]=json.loads(html.unescape(m.group(1)))
  s=samples[name]
  def value(selector,prop='backgroundColor'):return s[selector][prop]
  print('DEBUG',name,'metric',s['.handover66-metrics>div.metric'],'attention',s['.handover66-metrics>div.attention'],'selector',s['_debug'])
  assert value('.handover66-metrics>div.metric')==value('.handover66-metrics>div.attention'),name+' mismatched metric backgrounds'
  assert value('.mop-home64-hero .mop-home55-top-actions button.primary')==value('.mop-home64-hero .mop-home55-top-actions button.secondary')==value('.mop-home64-hero .mop-home55-top-actions button.mop-home57-refresh'),name+' quick action backgrounds not uniform'
  assert value('.mop-home59-timeline-item')==value('.mop-home59-pending-item'),name+' timeline and pending have different fills'
  assert value('.handover-tabs button.active')==value('.handover-tabs button.inactive'),name+' active tab uses mismatched fill'
  assert value('.handover-item-summary')==value('.mop-home59-timeline-item'),name+' handover row mismatched'
  assert s['.handover-tabs button.active']['borderBottomColor']!=s['.handover-tabs button.inactive']['borderBottomColor'],name+' active underline missing'
  print('CHROME',name,'inner=',value('.handover66-metrics>div.metric'),'quick=',value('.mop-home64-hero .mop-home55-top-actions button.primary'),'timeline=',value('.mop-home59-timeline-item'))
 # Backgrounds and accents must change across selected themes.
 for sel in ['.handover66-overview','.handover66-metrics>div.metric','.mop-home64-hero .mop-home55-top-actions button.primary','.mop-home59-panel']:
  fields=samples['mop'][sel].keys();styles=[tuple(samples[n][sel][x] for x in fields) for n in palettes]
  assert len(set(styles))==3,'Palettes not distinct: '+sel
 # Semantic badge colors must not be recolored by palette change.
 for sel in ['.handover-item-status.Pendente','.mop-home59-status-label.pending','.handover-item-icon.Pendente','.handover66-metrics>div.attention strong']:
  styles=[tuple(samples[n][sel].values()) for n in palettes]
  assert len(set(styles))==1,'Semantic color changed: '+sel
 print('PASS: three palettes, uniform metrics, four action types, rows/tabs, semantic status protection')
