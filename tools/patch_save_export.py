"""Save export / import in Settings (copy code, paste code, download file, load file). Run from anywhere; edits src/ then builds."""
import os, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'src')
def rd(f): return open(os.path.join(SRC, f), encoding='utf-8').read()
def wr(f, s): open(os.path.join(SRC, f), 'w', encoding='utf-8').write(s)
def rep(fn, a, b):
    s = rd(fn)
    if b in s: print('already', fn, a[:40]); return
    if a not in s: raise SystemExit('MISSING in ' + fn + ': ' + a[:90])
    wr(fn, s.replace(a, b, 1))

rep('p2.js', "function sigOf(s){",
"""/* ---- save export / import: a text code you can paste into another browser (or the Steam build) ---- */
function saveExportCode(){save();const json=JSON.stringify(S);const b64=btoa(unescape(encodeURIComponent(json)));return 'DEADAIR1.'+b64+'.'+hashStr(b64+'|da-export');}
function saveParseCode(code){code=String(code||'').trim().replace(/\\s+/g,'');if(!code.startsWith('DEADAIR1.'))throw new Error('That is not a DEAD AIR save code.');const parts=code.split('.');if(parts.length!==3)throw new Error('The code is incomplete. Copy the whole thing.');const b64=parts[1];if(String(hashStr(b64+'|da-export'))!==parts[2])throw new Error('The code is damaged (checksum mismatch). Copy it again.');const d=JSON.parse(decodeURIComponent(escape(atob(b64))));if(!d||typeof d!=='object'||d.credits===undefined||!d.set)throw new Error('The code does not contain a save.');return d;}
function saveImport(d){localStorage.setItem(SAVE_KEY,JSON.stringify(d));localStorage.setItem(SAVE_KEY+'_imported',String(Date.now()));location.reload();}
function sigOf(s){""")

rep('p7.js', "hubPane==='settings'){p.innerHTML='<div class=\"panel\">'+settingsHtml()+'</div>';bindSettings(p);}}",
"""hubPane==='settings'){p.innerHTML='<div class="panel">'+settingsHtml()+saveDataHtml()+'</div>';bindSettings(p);bindSaveData(p);}}
function saveDataHtml(){return '<h3>Save data</h3><div class="card"><div class="dim" style="font-size:12px;line-height:1.6">Your progress lives in this browser only. Export it to move to another PC or browser, to keep a backup, or to carry it into the Steam version later. Importing replaces everything here.</div>'+
  '<div class="row" style="margin-top:10px;flex-wrap:wrap"><button class="btn sm pri" id="bSaveCopy">📋 Copy save code</button><button class="btn sm" id="bSaveDl">💾 Download save file</button><button class="btn sm" id="bSaveLoad">📂 Load save file</button><input type="file" id="saveFile" accept=".txt,.deadair,.json" style="display:none"></div>'+
  '<textarea id="saveCode" spellcheck="false" placeholder="Paste a save code here, then press Import." style="width:100%;height:64px;margin-top:10px;background:#0d1114;color:#cfd6dc;border:1px solid var(--line);border-radius:6px;padding:6px;font-family:monospace;font-size:11px;resize:vertical"></textarea>'+
  '<div class="row" style="margin-top:8px"><button class="btn sm" id="bSaveImport">📥 Import save code</button><span class="dim" id="saveMsg" style="font-size:12px"></span></div>'+
  '<div class="dim" style="font-size:11px;margin-top:8px">'+fmt(S.credits)+' cr · base level '+S.baseLv+' · '+(S.missions||0)+' runs · '+Object.keys(S.ach||{}).length+' achievements'+(S.prestige?' · prestige '+S.prestige:'')+'</div></div>';}
function bindSaveData(root){const b=id=>root.querySelector('#'+id);const msg=(t,bad)=>{const m=b('saveMsg');if(m){m.textContent=t;m.className=bad?'red':'grn';}};
  if(b('bSaveCopy'))b('bSaveCopy').onclick=async()=>{const code=saveExportCode();b('saveCode').value=code;let ok=false;try{await navigator.clipboard.writeText(code);ok=true;}catch(e){}if(!ok){b('saveCode').focus();b('saveCode').select();try{ok=document.execCommand('copy');}catch(e){}}msg(ok?'Copied. Paste it into Settings on the other browser.':'Select the code and copy it (Ctrl+C).',!ok);Aud.ui(ok?'ok':'click');};
  if(b('bSaveDl'))b('bSaveDl').onclick=()=>{const code=saveExportCode();const blob=new Blob([code],{type:'text/plain'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);const d=new Date();a.download='deadair-save-'+d.getFullYear()+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0')+'.txt';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1000);msg('Downloading. Keep that file somewhere safe.');Aud.ui('ok');};
  if(b('bSaveLoad'))b('bSaveLoad').onclick=()=>b('saveFile').click();
  if(b('saveFile'))b('saveFile').onchange=e=>{const f=e.target.files&&e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{b('saveCode').value=String(r.result||'').trim();doImport();};r.readAsText(f);};
  const doImport=()=>{let d;try{d=saveParseCode(b('saveCode').value);}catch(err){msg(err.message,true);Aud.ui('bad');return;}
    const sum=fmt(d.credits||0)+' cr, base level '+(d.baseLv||1)+', '+(d.missions||0)+' runs'+(d.prestige?', prestige '+d.prestige:'');if(!confirm('Import this save?\\n\\n'+sum+'\\n\\nThis REPLACES your current progress ('+fmt(S.credits)+' cr, base level '+S.baseLv+'). The game will reload.'))return;saveImport(d);};
  if(b('bSaveImport'))b('bSaveImport').onclick=doImport;}""")

# a one-time toast after a successful import
rep('p7.js', "function boot(){initRenderer();applySettings();",
            "function boot(){initRenderer();applySettings();try{if(localStorage.getItem(SAVE_KEY+'_imported')){localStorage.removeItem(SAVE_KEY+'_imported');setTimeout(()=>toast('📥 Save imported: '+fmt(S.credits)+' cr · base level '+S.baseLv,'big'),1200);}}catch(e){}")

r = subprocess.run([sys.executable, os.path.join(ROOT, 'build.py')], capture_output=True, text=True)
print(r.stdout.strip() or r.stderr.strip())
if r.returncode: sys.exit(1)
