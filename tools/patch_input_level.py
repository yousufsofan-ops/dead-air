"""Input-systems + level-design pass.
Input: named actions with rebinding UI (conflict swap, reset, persisted), device-aware prompts, radial gamepad deadzone + sensitivity,
jump buffer + coyote time, sprint toggle, touch buttons follow rebinds.
Level: per-floor critical path with glowing wayfinding stripes, breather (safe) rooms near the up-stairs, early spawn exclusion near the van,
red key never inside a vault, map shows both."""
import os, re, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'src')
def rd(f): return open(os.path.join(SRC, f), encoding='utf-8').read()
def wr(f, s): open(os.path.join(SRC, f), 'w', encoding='utf-8').write(s)
def rep(fn, a, b, all=False):
    s = rd(fn)
    if b in s: print('already', fn, a[:40]); return
    if a not in s: raise SystemExit('MISSING in ' + fn + ': ' + a[:90])
    wr(fn, s.replace(a, b) if all else s.replace(a, b, 1))

# ============================ INPUT ============================
rep('p2.js', "if(S.set.hitstop===undefined)S.set.hitstop=true;",
            "if(S.set.hitstop===undefined)S.set.hitstop=true;if(!S.set.binds||typeof S.set.binds!=='object')S.set.binds={};if(S.set.sprintToggle===undefined)S.set.sprintToggle=false;if(S.set.padSens===undefined)S.set.padSens=1;")
rep('p7.js', "function toast(s,cls){",
r"""/* ===== input layer: gameplay reads named actions; bindings are data (rebindable, per device) ===== */
const ACTIONS=[['forward','Move forward','KeyW'],['back','Move back','KeyS'],['left','Strafe left','KeyA'],['right','Strafe right','KeyD'],['sprint','Sprint','ShiftLeft'],['crouch','Crouch','KeyC'],['jump','Jump','Space'],['interact','Interact / pick up','KeyE'],['drop','Drop','KeyG'],['flashlight','Flashlight','KeyF'],['radio','Radio (hold)','KeyR'],['ptt','Push-to-talk (hold)','KeyV'],['ping','Ping (hold, then 1-7)','KeyQ'],['map','Map','KeyM'],['medkit','Medkit','KeyH'],['flare','Flare','KeyX'],['battery','Swap battery','KeyB'],['chat','Text chat','KeyT'],['chanDown','Radio channel down','BracketLeft'],['chanUp','Radio channel up','BracketRight'],['mute','Mute microphone','KeyN'],['wave','Wave','KeyY'],['unstick','Unstick','KeyJ'],['objective','Objective marker','KeyO'],['controls','Controls card (hold)','KeyI'],['camera','Camera view','KeyP']];
const PAD_GLYPH={interact:'X',jump:'A',crouch:'B',radio:'Y',flashlight:'LB',drop:'RB',sprint:'RT',ping:'LT',map:'Back',ptt:'V',flare:'X'};
const RESERVED_CODES=['Escape','Enter','NumpadEnter','Tab','Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8','Digit9','Digit0','MetaLeft','MetaRight','F5','F11','F12'];
function bindOf(a){const b=S.set.binds||{};if(b[a])return b[a];const d=ACTIONS.find(x=>x[0]===a);return d?d[2]:'';}
function actionOf(code){const b=S.set.binds||{};for(const a of ACTIONS){if((b[a[0]]||a[2])===code)return a[0];}return null;}
function held(a){return !!K[bindOf(a)];}
function reboundCode(code){const d=ACTIONS.find(x=>x[2]===code);return d?bindOf(d[0]):code;}
function keyLabel(code){if(!code)return '—';return code.replace(/^Key/,'').replace(/^Digit/,'').replace('ShiftLeft','Shift').replace('ShiftRight','RShift').replace('ControlLeft','Ctrl').replace('ControlRight','RCtrl').replace('AltLeft','Alt').replace('AltRight','RAlt').replace('BracketLeft','[').replace('BracketRight',']').replace('ArrowUp','↑').replace('ArrowDown','↓').replace('ArrowLeft','←').replace('ArrowRight','→').replace('Semicolon',';').replace('Quote',"'").replace('Comma',',').replace('Period','.').replace('Slash','/').replace('Backslash','\\').replace('Minus','-').replace('Equal','=').replace('Backquote','`').replace('CapsLock','Caps');}
function kn(a){if(G.lastDevice==='pad'&&PAD_GLYPH[a])return PAD_GLYPH[a];return keyLabel(bindOf(a));}
function bindsHtml(){let h='<h3>Key bindings</h3><div class="dim" style="font-size:12px;margin-bottom:6px">Click a key to change it. Choosing a key another action uses swaps the two. Arrow keys always move; Esc always pauses.</div>';for(const a of ACTIONS){h+='<div class="setrow"><span>'+a[1]+'</span><span class="ctl"><button class="btn sm kbtn" data-act="'+a[0]+'">'+esc(keyLabel(bindOf(a[0])))+'</button></span></div>';}h+='<div class="row" style="margin-top:8px"><button class="btn sm" id="bBindReset">Reset to defaults</button><span class="dim" id="bindMsg" style="font-size:12px"></span></div>';return h;}
function bindBinds(root){for(const b of root.querySelectorAll('.kbtn')){b.onclick=()=>{for(const o of root.querySelectorAll('.kbtn'))if(o!==b)o.textContent=keyLabel(bindOf(o.dataset.act));G.rebinding={act:b.dataset.act,btn:b,root};b.textContent='press a key… (Esc cancels)';};}
  const r=root.querySelector('#bBindReset');if(r)r.onclick=()=>{S.set.binds={};save();for(const b of root.querySelectorAll('.kbtn'))b.textContent=keyLabel(bindOf(b.dataset.act));const m=root.querySelector('#bindMsg');if(m)m.textContent='Controls reset.';Aud.ui('click');};}
function rebindCapture(e){const rb=G.rebinding;if(!rb)return;e.preventDefault();e.stopImmediatePropagation();const msg=rb.root.querySelector('#bindMsg');
  if(e.code==='Escape'){rb.btn.textContent=keyLabel(bindOf(rb.act));G.rebinding=null;return;}
  if(RESERVED_CODES.indexOf(e.code)>=0||!e.code){if(msg)msg.textContent='That key is reserved.';rb.btn.textContent=keyLabel(bindOf(rb.act));G.rebinding=null;Aud.ui('bad');return;}
  const other=actionOf(e.code);const old=bindOf(rb.act);S.set.binds[rb.act]=e.code;if(other&&other!==rb.act){S.set.binds[other]=old;if(msg)msg.textContent='Swapped with '+ACTIONS.find(a=>a[0]===other)[1]+'.';}else if(msg)msg.textContent='Bound '+keyLabel(e.code)+'.';
  save();for(const b of rb.root.querySelectorAll('.kbtn'))b.textContent=keyLabel(bindOf(b.dataset.act));G.rebinding=null;Aud.ui('ok');}
function toast(s,cls){""")
# settings rows + UI hookup
rep('p7.js', "['Crouch toggle (instead of hold)','crouchToggle','toggle']", "['Crouch toggle (instead of hold)','crouchToggle','toggle'],['Sprint toggle (instead of hold)','sprintToggle','toggle'],['Controller stick sensitivity','padSens','range',0.4,2,0.1]")
rep('p7.js', "Controller: left stick move, right stick look, A jump, X interact, B crouch, Y radio, LB flashlight, RB throw/drop, RT sprint, LT ping, Start pause, Back map.</div>';return h;}",
            "Controller: left stick move, right stick look, A jump, X interact, B crouch, Y radio, LB flashlight, RB throw/drop, RT sprint, LT ping, Start pause, Back map.</div>';return h+bindsHtml();}")
rep('p7.js', "if(s.dataset.sel==='gfx')toast('Graphics preset applies to lighting now; reload for full effect.');};}",
            "if(s.dataset.sel==='gfx')toast('Graphics preset applies to lighting now; reload for full effect.');};bindBinds(root);}")
rep('p7.js', "function boot(){initRenderer();applySettings();", "function boot(){initRenderer();applySettings();window.addEventListener('keydown',rebindCapture,true);")
# keydown switch → actions (region between "switch(e.code){" and the Digit cases)
s = rd('p7.js')
i = s.find("  switch(e.code){\n    case 'KeyE':if(!e.repeat)interact();break;")
assert i > 0, 'keydown switch anchor'
j = s.find("    case 'Digit1':", i)
assert j > i
region = s[i:j]
region = region.replace("switch(e.code){", "switch(actionOf(e.code)||e.code){")
MAP = {'KeyE':'interact','KeyG':'drop','KeyF':'flashlight','KeyR':'radio','KeyV':'ptt','KeyM':'map','KeyQ':'ping','KeyH':'medkit','KeyX':'flare','KeyB':'battery','KeyT':'chat','BracketLeft':'chanDown','BracketRight':'chanUp','KeyN':'mute','KeyY':'wave','KeyJ':'unstick','KeyO':'objective','KeyI':'controls','KeyP':'camera'}
for code, act in MAP.items():
    region = region.replace("case '%s':" % code, "case '%s':" % act)
s = s[:i] + region + s[j:]
wr('p7.js', s); print('keydown switch mapped')
rep('p7.js', "if(K.KeyQ){qWheel=true;doPing(", "if(held('ping')){qWheel=true;doPing(")
rep('p7.js', "addEventListener('keyup',e=>{K[e.code]=false;if(e.code==='KeyI')$('ctrlCard').style.display='none';if(e.code==='KeyV')VOICE.pttHeld=false;if(G.state!=='play')return;if(e.code==='KeyR')radioSet(false);if(e.code==='KeyV')VOICE.pttHeld=false;if(e.code==='KeyQ'){",
            "addEventListener('keyup',e=>{K[e.code]=false;const ka=actionOf(e.code);if(ka==='controls')$('ctrlCard').style.display='none';if(ka==='ptt')VOICE.pttHeld=false;if(G.state!=='play')return;if(ka==='radio')radioSet(false);if(ka==='ping'){")
rep('p7.js', "if(G.state!=='play'){if(e.code==='KeyV'&&VOICE.on)VOICE.pttHeld=true;else if(e.code==='KeyN'&&!e.repeat&&MP.on&&G.state==='hub'){Aud.init();voiceMute();}return;}",
            "G.lastDevice='kb';if(G.state!=='play'){const ka=actionOf(e.code);if(ka==='ptt'&&VOICE.on)VOICE.pttHeld=true;else if(ka==='mute'&&!e.repeat&&MP.on&&G.state==='hub'){Aud.init();voiceMute();}return;}")
# prompts follow the binding / device
rep('p7.js', "if(t&&!(K.KeyE&&P.useT>0)){pr.style.display='block';pr.textContent='[E] '+t.label;", "if(t&&!(held('interact')&&P.useT>0)){pr.style.display='block';pr.textContent='['+kn('interact')+'] '+t.label;")
rep('p7.js', "}else if(!(K.KeyE&&P.useT>0)){pr.style.display='none';", "}else if(!(held('interact')&&P.useT>0)){pr.style.display='none';")
rep('p7.js', "if(P.phoneRinging)$('prompt').textContent='[F] Answer the phone?';", "if(P.phoneRinging)$('prompt').textContent='['+kn('flashlight')+'] Answer the phone?';")
rep('p7.js', "const t=lookTarget();const pr=$('prompt');", "if(!G._kbT||G.t-G._kbT>1){G._kbT=G.t;const kb=$('keyBar');if(kb){const ks=kn('flashlight')+' light · '+kn('ptt')+' talk · '+kn('radio')+' radio · '+kn('ping')+' ping · '+kn('map')+' map · TAB inventory';if(kb.textContent!==ks)kb.textContent=ks;}}const t=lookTarget();const pr=$('prompt');")
rep('p1.html', '<div id="noise2" class="dim" style="font-size:10px;margin-top:6px;letter-spacing:.1em">F light', '<div id="keyBar" class="dim" style="font-size:10px;margin-top:6px;letter-spacing:.1em">F light')
# touch buttons follow rebinds
rep('p7.js', "const key=(code,down)=>document.dispatchEvent(new KeyboardEvent(down?'keydown':'keyup',{code,key:code,bubbles:true,cancelable:true}));",
            "const key=(code,down)=>{code=reboundCode(code);document.dispatchEvent(new KeyboardEvent(down?'keydown':'keyup',{code,key:code,bubbles:true,cancelable:true}));};")
rep('p7.js', "else if(mode==='toggle'){const on=!b.classList.contains('on');b.classList.toggle('on',on);K[code]=on;}", "else if(mode==='toggle'){const on=!b.classList.contains('on');b.classList.toggle('on',on);K[reboundCode(code)]=on;}")
# gamepad: radial deadzone, sensitivity, device tracking
rep('p7.js', "const dz=v=>Math.abs(v)<0.15?0:v;if(!GP.active){", "const dz=v=>Math.abs(v)<0.15?0:v;const radial=(x,y,dead)=>{const m=Math.hypot(x,y);if(m<dead)return [0,0];const s=(m-dead)/(1-dead);return [x/m*s,y/m*s];};if(!GP.active){")
rep('p7.js', "GP.mx=dz(g.axes[0]);GP.my=dz(g.axes[1]);mouseDX+=dz(g.axes[2])*14;mouseDY+=dz(g.axes[3])*14;",
            "{const mv=radial(g.axes[0]||0,g.axes[1]||0,0.18);GP.mx=mv[0];GP.my=mv[1];const lk=radial(g.axes[2]||0,g.axes[3]||0,0.15);const ps=(S.set.padSens||1)*14;mouseDX+=lk[0]*Math.abs(lk[0])*ps*1.4;mouseDY+=lk[1]*Math.abs(lk[1])*ps*1.4;if(mv[0]||mv[1]||lk[0]||lk[1])G.lastDevice='pad';}")
# gameplay reads actions
rep('p4.js', "if(K.KeyW||K.ArrowUp)iz-=1;if(K.KeyS||K.ArrowDown)iz+=1;if(K.KeyA||K.ArrowLeft)ix-=1;if(K.KeyD||K.ArrowRight)ix+=1;",
            "if(held('forward')||K.ArrowUp)iz-=1;if(held('back')||K.ArrowDown)iz+=1;if(held('left')||K.ArrowLeft)ix-=1;if(held('right')||K.ArrowRight)ix+=1;")
rep('p4.js', "P.sprint=!!(K.ShiftLeft||K.ShiftRight||GP.sprint)&&iz<0&&!P.downed;",
            "{const sIn=!!(held('sprint')||K.ShiftRight||GP.sprint);if(S.set.sprintToggle){if(sIn&&!P._sHeld)P.sprintT=!P.sprintT;P._sHeld=sIn;if(iz>=0||P.stamina<=0.02)P.sprintT=false;P.sprint=!!P.sprintT&&iz<0&&!P.downed;}else P.sprint=sIn&&iz<0&&!P.downed;}")
rep('p4.js', "const wantCrouch=!!(K.ControlLeft||K.KeyC||GP.crouch);", "const wantCrouch=!!(held('crouch')||K.ControlLeft||GP.crouch);")
rep('p4.js', "/* jump */if((K.Space||GP.jump)&&P.onGround&&!P.downed&&P.stamina>0.05&&!P._jHeld){P.vel.y=Math.sqrt(2*G.gravity*(G.gravity<12?1.6:1.1));P.onGround=false;P.stamina-=0.06;}P._jHeld=!!(K.Space||GP.jump);",
            "/* jump: buffered press + coyote time */{const jp=!!(held('jump')||GP.jump);if(jp&&!P._jHeld)P.jumpBuf=0.12;else P.jumpBuf=Math.max(0,(P.jumpBuf||0)-dt);P.coyote=P.onGround?0.1:Math.max(0,(P.coyote||0)-dt);if(P.jumpBuf>0&&P.coyote>0&&!P.downed&&P.stamina>0.05){P.vel.y=Math.sqrt(2*G.gravity*(G.gravity<12?1.6:1.1));P.onGround=false;P.coyote=0;P.jumpBuf=0;P.stamina-=0.06;}P._jHeld=jp;}")
for fn in ('p4.js', 'p7.js'):
    t = rd(fn)
    if 'K.KeyE' in t:
        wr(fn, t.replace('K.KeyE', "held('interact')")); print(fn, 'K.KeyE → held(interact)')
# mouse marks the keyboard/mouse device
rep('p7.js', "mousemove',e=>{if((document.pointerLockElement===$('gl')||G.fallbackLook)", "mousemove',e=>{if(e.movementX||e.movementY)G.lastDevice='kb';if((document.pointerLockElement===$('gl')||G.fallbackLook)")

# ============================ LEVEL DESIGN ============================
rep('p3.js', "  return map;",
r"""  levelDesignPass(map);
  return map;""")
rep('p3.js', "function randomWalkCell(map,k,rng){",
r"""/* ---- level design pass: critical path per floor, breather rooms, key placement validation ---- */
function levelDesignPass(map){try{const keyTpl=(typeof ITEMS!=='undefined')?ITEMS.findIndex(i=>i.key):-1;map.safeRooms=[];
  for(let k=0;k<map.L;k++){const lay=map.layers[k];
    /* the way in: the van on the surface, the stairs you arrive by below */let from=null;if(k===0)from={x:map.van.x,z:map.van.z-2};else{const st=map.stairs.find(s=>s.k===k-1);if(st)from={x:(st.x+st.dx*3+0.5)*CELL,z:(st.z+st.dz*3+0.5)*CELL};}
    /* the way on: the stairs down, or the deepest room on the last floor */let to=null;const dn=map.stairs.find(s=>s.k===k);if(dn)to={x:(dn.x-dn.dx+0.5)*CELL,z:(dn.z-dn.dz+0.5)*CELL};else if(map.deepRoom&&map.deepRoom.k===k)to={x:map.deepRoom.cx,z:map.deepRoom.cz};
    if(from&&to){const p=findPath(map,k,from.x,from.z,k,to.x,to.z);if(p&&p.length>1)lay.guide=[{x:from.x,z:from.z}].concat(p.map(w=>({x:w.x,z:w.z})));}
    /* breather room: the closest real room to where you arrive (not the vault, not a corridor stub) */if(from){let best=null,bd=1e9;for(const r of lay.rooms){if(r.type==='vault'||r.type==='hall'||r.w<2||r.h<2)continue;const d=dist2(r.cx,r.cz,from.x,from.z);if(d<bd){bd=d;best=r;}}if(best&&bd<26){best.safe=true;map.safeRooms.push({k,id:best.id,cx:best.cx,cz:best.cz});}}
    /* the red key must never sit behind the red door */if(keyTpl>=0)for(const it of map.items){if(it.k!==k||it.tpl!==keyTpl)continue;const rid=roomAt(map,k,it.x,it.z);const r=lay.rooms.find(q=>q.id===rid);if(r&&r.type==='vault'){const alt=lay.rooms.filter(q=>q.type!=='vault'&&q.type!=='hall');if(alt.length){const q=alt[Math.floor(alt.length/2)];it.x=q.cx+0.6;it.z=q.cz-0.4;it.room=q.id;}}}}
  /* breather rooms keep their lights: never dead, never flickering, immune to blackouts */for(const l of map.lights){const rid=roomAt(map,l.k,l.x,l.z);const r=map.layers[l.k].rooms.find(q=>q.id===rid);if(r&&r.safe){l.safe=true;l.dead=false;l.on=true;l.flicker=false;}}
  }catch(e){console.warn('levelDesignPass',e);}}
function randomWalkCell(map,k,rng){""")
# world: wayfinding stripes along the critical path + a REST sign over the breather room
rep('p4.js', "fm.setMatrixAt(i,m4);});grp.add(fm);",
            "fm.setMatrixAt(i,m4);});grp.add(fm);\n    if(lay.guide&&lay.guide.length>1){const gcol=[0x7ddc7d,0xffd27a,0x8fb6ff,0xff8fb0,0xc8ff8f][k%5];const gmat=new THREE.MeshBasicMaterial({color:gcol,transparent:true,opacity:0.3,depthWrite:false});const gg=lay.guide;for(let i=0;i<gg.length-1;i++){const a=gg[i],b=gg[i+1];const dx=b.x-a.x,dz=b.z-a.z;const len=Math.hypot(dx,dz);if(len<0.05)continue;const sm=new THREE.Mesh(new THREE.BoxGeometry(0.2,0.012,len+0.2),gmat);sm.position.set((a.x+b.x)/2,y+0.006,(a.z+b.z)/2);sm.rotation.y=Math.atan2(dx,dz);sm.renderOrder=2;sm.userData.own=true;grp.add(sm);}}\n    for(const r of lay.rooms){if(r.safe)grp.add(stairSign('REST · SAFE ROOM','#7ddc7d',r.cx,y+2.55,r.cz));}")
# lights in breather rooms ignore blackouts
rep('p5.js', "if(G.fx.lightsOut>0)it=0;", "if(G.fx.lightsOut>0&&!l.safe)it=0;")
# spawn placement: never inside a breather room, never near the van in the first 90 s
rep('p5.js', "function spawnEco(kind,k,rp,rng){",
"""function spawnCell(k,rng){for(let i=0;i<30;i++){const c=randomWalkCell(G.map,k,rng);if(k===0&&G.mission&&(G.mission.time||0)<90&&dist2(c.x,c.z,G.map.van.x,G.map.van.z)<18)continue;const rid=roomAt(G.map,k,c.x,c.z);const r=G.map.layers[k].rooms.find(q=>q.id===rid);if(r&&r.safe)continue;return c;}return randomWalkCell(G.map,k,rng);}
function spawnEco(kind,k,rp,rng){""")
rep('p5.js', "const rp=randomWalkCell(G.map,ri(Math.random,0,G.map.L-1));spawnCreature(kind,rp.x,rp.z,rp.k);", "const rp=spawnCell(ri(Math.random,0,G.map.L-1));spawnCreature(kind,rp.x,rp.z,rp.k);")
rep('p5.js', "const rp=randomWalkCell(G.map,pl.k);spawnCreature(kind,rp.x,rp.z,pl.k,{state:kind==='hound'?'chase':'hunt'});", "const rp=spawnCell(pl.k);spawnCreature(kind,rp.x,rp.z,pl.k,{state:kind==='hound'?'chase':'hunt'});")
rep('p5.js', "const rp=randomWalkCell(G.map,hasMajor?ri(Math.random,0,G.map.L-1):0);spawnCreature(hasMajor?'hound':'warden',rp.x,rp.z,rp.k);", "const rp=spawnCell(hasMajor?ri(Math.random,0,G.map.L-1):0);spawnCreature(hasMajor?'hound':'warden',rp.x,rp.z,rp.k);")
rep('p7.js', "const rp=randomWalkCell(G.map,k,rng);spawnEco(kind,k,rp,rng);", "const rp=spawnCell(k,rng);spawnEco(kind,k,rp,rng);")
rep('p7.js', "const rp=randomWalkCell(G.map,G.map.L-1);spawnCreature('hound',rp.x,rp.z,G.map.L-1);", "const rp=spawnCell(G.map.L-1);spawnCreature('hound',rp.x,rp.z,G.map.L-1);")
# standing in a breather room: faster stamina, slow healing to 60, one-time explanation
rep('p5.js', "function updateLights(dt){updateFloorCulling();", "function updateLights(dt){updateFloorCulling();{const rid=roomAt(G.map,P.k,P.pos.x,P.pos.z);const r=G.map.layers[P.k]&&G.map.layers[P.k].rooms.find(q=>q.id===rid);const was=P.inSafe;P.inSafe=!!(r&&r.safe);if(P.inSafe&&!was&&G.state==='play')hintOnce('safe','This is a breather room: the lights here never fail, nothing spawns inside, and you heal slowly (up to 60). Creatures can still follow you in.');}")
rep('p4.js', "P.stamina=Math.min(1,P.stamina+dt*(P.crouch?0.18:0.12)*(G.map.loc.cold?0.6:1)*(perk(1)?1.15:1));",
            "P.stamina=Math.min(1,P.stamina+dt*(P.crouch?0.18:0.12)*(G.map.loc.cold?0.6:1)*(perk(1)?1.15:1)*(P.inSafe?1.8:1));if(P.inSafe&&P.hp<60&&!P.dead&&!P.downed){P.hp=Math.min(60,P.hp+dt*1.2);}")
# map: breather rooms tinted, guide line drawn
rep('p7.js', "x.fillStyle=t===T_ROOM?(lay.rooms[lay.room[z*m.W+xx]]&&lay.rooms[lay.room[z*m.W+xx]].type==='vault'?'#3a2020':'#26323a')",
            "x.fillStyle=t===T_ROOM?(lay.rooms[lay.room[z*m.W+xx]]&&lay.rooms[lay.room[z*m.W+xx]].type==='vault'?'#3a2020':(lay.rooms[lay.room[z*m.W+xx]]&&lay.rooms[lay.room[z*m.W+xx]].safe?'#1e3a2a':'#26323a'))")
rep('p7.js', "  for(const d of lay.doors){const cx=Math.floor(d.x/CELL),cz=Math.floor(d.z/CELL);",
            "  if(lay.guide&&lay.guide.length>1){x.strokeStyle='rgba(125,220,125,0.35)';x.lineWidth=3;x.setLineDash([6,6]);x.beginPath();lay.guide.forEach((g,i)=>{if(i===0)x.moveTo(g.x*sc+jx,g.z*sc+jy);else x.lineTo(g.x*sc+jx,g.z*sc+jy);});x.stroke();x.setLineDash([]);}\n  for(const r of lay.rooms){if(r.safe){x.fillStyle='#7ddc7d';x.font='bold 10px sans-serif';x.fillText('REST',r.cx*sc-12+jx,r.cz*sc+4+jy);}}\n  for(const d of lay.doors){const cx=Math.floor(d.x/CELL),cz=Math.floor(d.z/CELL);")

r = subprocess.run([sys.executable, os.path.join(ROOT, 'build.py')], capture_output=True, text=True)
print(r.stdout.strip() or r.stderr.strip())
if r.returncode: sys.exit(1)
