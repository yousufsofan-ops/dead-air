"""Round 2: TURN relay, full controller support (in-game mapping + menu navigation), sharpened Stack/Collector/Sleeper,
the house remembers, what-killed-you card on results."""
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

# ============ 2. TURN relay so strict NATs can connect ============
rep('p6.js', "const PEER_OPT={debug:0,config:{iceServers:[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:global.stun.twilio.com:3478'}]}};",
            "const PEER_OPT={debug:0,config:{iceServers:[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:global.stun.twilio.com:3478'},{urls:['turn:openrelay.metered.ca:80','turn:openrelay.metered.ca:443','turn:openrelay.metered.ca:443?transport=tcp'],username:'openrelayproject',credential:'openrelayproject'}],iceCandidatePoolSize:4}};")

# ============ controllers: poll every frame, full in-game mapping, menu navigation ============
rep('p7.js', "function gamepadPoll(){const gps=navigator.getGamepads?navigator.getGamepads():[];const g=gps&&gps[0];if(!g){GP.mx=GP.my=0;return;}",
            "function gamepadPoll(){if(GP.frame===frame)return;GP.frame=frame;const gps=navigator.getGamepads?navigator.getGamepads():[];const g=gps&&gps[0];if(!g){GP.mx=GP.my=0;return;}")
rep('p7.js', "GP.active=true;toast('Controller active');", "GP.active=true;G.fallbackLook=true;G.lastDevice='pad';toast('🎮 Controller active · A jump · X use · B crouch · Y radio · LB light · RB throw · LT ping · RT sprint · D-pad: marker / medkit / flare / unstick · Back map · Start pause','big');")
rep('p7.js', "  if(edge('flash',b(4))){P.flash=!P.flash;}if(edge('rb',b(5))){if(P.hands)throwHands(0.6);}if(edge('lt',b(6)))doPing();if(edge('y',b(3)))radioSet(!P.radio.on);if(edge('start',b(9)))togglePause();if(edge('back',b(8))){if($('mapScr').classList.contains('on'))closeMap();else openMap();}if(edge('x',b(2)))interact();",
"""  const inGame=G.state==='play'&&!G.paused;const homeFps=G.state==='home'&&G.home&&G.home.phase==='explore';
  if(inGame){if(edge('flash',b(4))){P.flash=!P.flash;Aud.ui('click');}if(edge('rb',b(5))){if(P.hands)throwHands(0.6);}if(edge('lt',b(6)))doPing();if(edge('y',b(3)))radioSet(!P.radio.on);if(edge('start',b(9)))togglePause();if(edge('back',b(8))){if($('mapScr').classList.contains('on'))closeMap();else openMap();}if(edge('x',b(2)))interact();
    if(edge('dup',b(12)))objCycle();if(edge('ddown',b(13)))unstick();if(edge('dleft',b(14)))useMedkit();if(edge('dright',b(15)))useFlare();if(edge('l3',b(10))){if(P.hands)pocketHeld();}if(edge('r3',b(11))){S.set.tp=!S.set.tp;save();Aud.ui('click');}
    if(b(0)&&P.dead&&edge('aDead',true)){const ids=Object.keys(G.avatars).filter(id=>!G.avatars[id].dead);if(ids.length){const i=ids.indexOf(P.spectate);P.spectate=ids[(i+1)%ids.length];}}else if(!b(0))GP.prev.aDead=false;}
  else if(homeFps){if(edge('a',b(0)))homeConfirm();if(edge('start',b(9))||edge('bb',b(1)))homeSkip();}
  else if(G.state==='home'){if(edge('a',b(0)))homeConfirm();if(edge('start',b(9))||edge('bb',b(1)))homeSkip();}
  else{/* menus: D-pad / left stick move focus, A activates, B backs out, Start resumes */const dx=(b(15)?1:0)-(b(14)?1:0)+(Math.abs(g.axes[0]||0)>0.6?Math.sign(g.axes[0]):0),dy=(b(13)?1:0)-(b(12)?1:0)+(Math.abs(g.axes[1]||0)>0.6?Math.sign(g.axes[1]):0);
    const now=performance.now();if(dx||dy){if(!GP.navHeld||now-GP.navT>(GP.navRep?170:380)){padMove(dx,dy);GP.navT=now;GP.navRep=!!GP.navHeld;}GP.navHeld=true;}else{GP.navHeld=false;GP.navRep=false;}
    if(edge('a',b(0)))padActivate();if(edge('bb',b(1)))padBack();if(edge('start',b(9))){if(G.paused===true)togglePause();else padActivate();}}""")
rep('p7.js', "function toast(s,cls){",
r"""/* ---- controller menu navigation: spatial focus over whatever screen is up ---- */
function padCandidates(){const root=G.paused?$('pauseP'):(document.querySelector('.scr.on')||document.body);const els=[...root.querySelectorAll('button,.tab,.tog,select,input[type=range],input[type=text],.card,.kbtn,.plr,[data-nav]')];return els.filter(e=>{if(e.disabled)return false;if(e.classList.contains('card')&&!e.onclick&&!e.getAttribute('onclick'))return false;const r=e.getBoundingClientRect();return r.width>4&&r.height>4&&r.bottom>0&&r.top<innerHeight;});}
function padSetFocus(el){if(G.padFocus&&G.padFocus!==el)G.padFocus.classList.remove('padfocus');G.padFocus=el;if(el){el.classList.add('padfocus');try{el.scrollIntoView({block:'nearest',inline:'nearest'});}catch(e){}}}
function padMove(dx,dy){const c=padCandidates();if(!c.length){padSetFocus(null);return;}let cur=G.padFocus;if(!cur||c.indexOf(cur)<0||!document.contains(cur)){padSetFocus(c[0]);return;}
  if(cur.tagName==='INPUT'&&cur.type==='range'&&dx&&!dy){const step=+cur.step||0.05;cur.value=Math.min(+cur.max,Math.max(+cur.min,+cur.value+dx*step));cur.dispatchEvent(new Event('input',{bubbles:true}));return;}
  if(cur.tagName==='SELECT'&&dx&&!dy){cur.selectedIndex=(cur.selectedIndex+dx+cur.options.length)%cur.options.length;cur.dispatchEvent(new Event('change',{bubbles:true}));return;}
  const r0=cur.getBoundingClientRect();const cx=r0.left+r0.width/2,cy=r0.top+r0.height/2;let best=null,bs=1e18;
  for(const e of c){if(e===cur)continue;const r=e.getBoundingClientRect();const ex=r.left+r.width/2,ey=r.top+r.height/2;const vx=ex-cx,vy=ey-cy;const along=dx*vx+dy*vy;if(along<6)continue;const off=Math.abs(dx?vy:vx);const s=along+off*2.4;if(s<bs){bs=s;best=e;}}
  if(best)padSetFocus(best);}
function padActivate(){const el=G.padFocus;if(!el||!document.contains(el)){padMove(1,0);return;}if(el.tagName==='SELECT'){el.selectedIndex=(el.selectedIndex+1)%el.options.length;el.dispatchEvent(new Event('change',{bubbles:true}));return;}if(el.tagName==='INPUT'){if(el.type==='text')el.focus();return;}el.click();Aud.ui('click');setTimeout(()=>{if(G.padFocus&&!document.contains(G.padFocus))padMove(1,0);},50);}
function padBack(){if(G.paused===true){togglePause();return;}if($('mapScr')&&$('mapScr').classList.contains('on')){closeMap();return;}document.dispatchEvent(new KeyboardEvent('keydown',{code:'Escape',key:'Escape',bubbles:true,cancelable:true}));}
function toast(s,cls){""")
rep('p7.js', "try{if(G.state!=='play')voiceLobbyTick(dt);", "try{if(G.state!=='play'||G.paused)gamepadPoll();if(G.state!=='play')voiceLobbyTick(dt);")
rep('p1.html', "#fade{", ".padfocus{outline:2px solid var(--amber)!important;outline-offset:2px;box-shadow:0 0 12px rgba(217,164,65,.45)!important}\n#fade{")

# ============ 4. the trio gets a rule, a telegraph and a counter each ============
rep('p5.js', "if(c.state==='hidden'){c.anim='idle';}",
            "if(c.state==='hidden'){c.tellAnimT=Math.max(0,(c.tellAnimT||0)-dt);c.anim=c.tellAnimT>0?'reveal':'idle';let lit=null;for(const p of alivePlayers()){if(beamOnCreature(c,p,7)){lit=p;break;}}c.litT=lit?(c.litT||0)+dt:0;if(c.litT>1.0&&!(c.tellT>G.t-6)){c.tellT=G.t;c.tellAnimT=0.45;if(MP.on)bcast({t:'ev',k:'sfx',kind:'stack',p:[c.pos.x,c.pos.y+0.5,c.pos.z]});Aud.creature('stack',c.pos,0.6);if(lit&&!G.mission.stackHint){G.mission.stackHint=true;hostEvent(lit.id,{k:'toast',s:'📦 That pile just twitched under your light. Loot does not twitch. Leave it.'});}}}")
rep('p5.js', "else if(c.state==='carry'){c.anim='run';if(!carried){c.state='wander';break;}",
            "else if(c.state==='carry'){c.anim='run';if(!carried){c.state='wander';break;}if(Math.random()<dt*0.8){if(MP.on)bcast({t:'ev',k:'sfx',kind:'collector',p:[c.pos.x,c.pos.y+1,c.pos.z]});Aud.creature('collector',c.pos,0.45);}")
rep('p5.js', "if(d<6)c.awake+=dt*0.12*(6-d)/6;", "if(d<6)c.awake+=dt*0.12*(6-d)/6*(p.crouch?0.35:1)*(p.flash?1.3:1);")
rep('p5.js', "c.awake=Math.max(0,c.awake-dt*0.012);", "c.awake=Math.max(0,c.awake-dt*0.012);if(c.awake>0.6&&!c.stirWarned){c.stirWarned=true;const np=nearestPlayer(c);if(np)hostEvent(np.p.id,{k:'toast',s:'😴 It is stirring. Back away crouched, light off, and it settles.'});}")
rep('p2.js', "stack:{n:'The Stack',ic:'📦',major:false,threat:1,d:'Looks like loot. Is not loot.'}", "stack:{n:'The Stack',ic:'📦',major:false,threat:1,d:'Looks like loot. Is not loot. Hold your light on a pile for a second: real loot does not twitch.'}")
rep('p2.js', "collector:{n:'The Collector',ic:'🎒',major:false,threat:1,d:'Steals loose loot and drags it to a nest. It will rob the van if nobody is watching.'}", "collector:{n:'The Collector',ic:'🎒',major:false,threat:1,d:'Steals loose loot and drags it to a nest. It jingles while it carries. Throw anything at it or light a flare and it drops the loot and runs.'}")
rep('p2.js', "sleeper:{n:'The Sleeper',ic:'😴',major:true,threat:4,d:'Sleeps on a pile of treasure on the deepest floor. Noise and light wake it. Do not wake it.'}", "sleeper:{n:'The Sleeper',ic:'😴',major:true,threat:4,d:'Sleeps on a pile of treasure on the deepest floor. Noise and light wake it; crouching near it barely does. When it stirs, back away crouched with the light off and it settles.'}")

# ============ 6. what killed you ============
rep('p4.js', "amt*=arm;P.hp-=amt;P.hurtT=1;P.kick=1;", "amt*=arm;P.hp-=amt;P.lastHurtSrc=src;if(P.hp>0&&P.hp<(P.minHp===undefined?101:P.minHp)){P.minHp=P.hp;P.minHpSrc=src;}P.hurtT=1;P.kick=1;")
rep('p4.js', "function goDown(){if(P.downed)return;P.downed=true;", "function goDown(){if(P.downed)return;P.downed=true;P.deathSrc=P.lastHurtSrc||'unknown';")
rep('p4.js', "P.alone=0;", "P.alone=0;P.minHp=101;P.minHpSrc=null;P.deathSrc=null;P.lastHurtSrc=null;")
rep('p7.js', "function showResultsNow(r){G.state='results';rollCosDrop(r);", "function showResultsNow(r){G.state='results';S.lastDied=((r.dead||[]).indexOf(P.id)>=0)||!!P.dead;S.lastSite=(G.mission&&G.mission.loc)?G.mission.loc.name:'';rollCosDrop(r);")
rep('p7.js', "function showResultsNow(r){",
r"""const COUNTERS={hound:'Hold your light in its eyes and it runs. Throw anything and it chases that. After every bite it backs off: that pause is when you move.',echo:'It only moves when nobody is looking at it. Face it and back away. It hunts by sound, so whisper.',crawler:'It drops from ceilings onto players who are alone. Stay in pairs and look up in long corridors.',lighteater:'It eats light. Flashlight off and it loses you. Flares draw it away.',window:'Do not stare at what is in the window. Look away and keep moving.',stack:'Hold your light on a suspicious pile: loot does not twitch.',drifter:'A spore cloud. Throw something through it and it bursts. Never walk into it.',warden:'It cannot be stopped, only outrun. Doors slow it. Do not fight for a room; leave it.',mourner:'Do not approach a kneeling figure. It screams when you get close and the scream hurts everyone nearby.',hanger:'It hangs from the ceiling and grabs whoever passes below. Look up.',collector:'Harmless to you, deadly to your loot. Throw something and it drops what it stole.',sleeper:'Crouch, light off, and it stays asleep. When it stirs, back away crouched. Never fight it awake.',mimic:'It looks like a strongbox. Real boxes do not breathe. Throw something at a box before you open it.',swarm:'They go for the light. Flashlight off and walk away.',burrower:'It comes up under noise. Stop moving when the floor rumbles, then step sideways.',twin:'It wears a friend. Ask your friend to say something only they know.',fall:'Falls hurt from more than one floor. Take the stairs; the marker (O) points to them.',bleed:'You bled out while down. A teammate holding E on you revives you. Yell.',unknown:'Something got you. Check the codex in the Archive.'};
function deathCardHtml(r){const died=((r.dead||[]).indexOf(P.id)>=0)||P.dead;const src=P.deathSrc||P.lastHurtSrc;if(died&&src){const cr=CREATURES[src];const name=cr?cr.ic+' '+cr.n:(src==='fall'?'A fall':src==='bleed'?'Bleeding out':'The site');return '<div class="card" style="border-color:var(--red)"><div class="red" style="font-size:11px;letter-spacing:.3em">WHAT GOT YOU</div><div style="font-size:16px;margin:4px 0">'+esc(name)+'</div><div class="dim" style="font-size:12px;line-height:1.5">'+esc((cr&&cr.d)||'')+'</div><div style="font-size:12px;margin-top:6px;color:var(--amber)">Next time: '+esc(COUNTERS[src]||COUNTERS.unknown)+'</div></div>';}
  if(!died&&P.minHpSrc&&P.minHp<45){const cr=CREATURES[P.minHpSrc];return '<div class="card"><div class="amb" style="font-size:11px;letter-spacing:.3em">CLOSEST CALL</div><div style="font-size:13px;margin:4px 0">'+Math.round(P.minHp)+' hp left after '+esc(cr?cr.n:P.minHpSrc)+'</div><div class="dim" style="font-size:12px;line-height:1.5">'+esc(COUNTERS[P.minHpSrc]||'')+'</div></div>';}
  return '';}
function showResultsNow(r){""")
rep('p7.js', "<div class=\"grid g2\"><div>';", "<div class=\"grid g2\"><div>'+deathCardHtml(r)+'")

# ============ 5. the house remembers ============
rep('p2.js', "if(S.set.padSens===undefined)S.set.padSens=1;", "if(S.set.padSens===undefined)S.set.padSens=1;if(S.lastDied===undefined)S.lastDied=false;if(S.lastSite===undefined)S.lastSite='';")
s = rd('p7.js')
note_old = "mkText('TAKE YOUR\\nMEDICATION\\n- H.R.',128,112,'#f4eecb','#222','bold 15px monospace')"
note_new = "mkText(homeNoteText(),128,112,S.prestige>=3?'#e8dcc0':'#f4eecb',S.prestige>=2?'#5a1010':'#222',(S.prestige>=1?'italic ':'')+'bold 15px '+(S.prestige>=3?'cursive':'monospace'))"
if note_new not in s:
    assert note_old in s, 'note anchor'
    s = s.replace(note_old, note_new)
s = s.replace("mkText('03:12',128,128,'#f0ece0','#202020','bold 40px monospace')", "mkText(S.ending?'03:13':'03:12',128,128,'#f0ece0','#202020','bold 40px monospace')")
s = s.replace("mkText('03:12',128,56,'#100808','#ff3020','bold 34px monospace')", "mkText(S.ending?'03:13':'03:12',128,56,'#100808','#ff3020','bold 34px monospace')")
wr('p7.js', s)
rep('p7.js', "function buildHomeScene(){",
r"""function homeNoteText(){const p=S.prestige||0;if(S.ending)return 'TAKE YOUR\nMEDICATION\nWE ARE INSIDE';if(p>=3)return 'take your\nmedication\nyou are part\nof this now';if(p>=2)return 'TAKE YOUR\nMEDICATION\nWE SAW YOU';if(p>=1)return 'TAKE YOUR\nMEDICATION\nYOU ARE DOING\nWELL - H.R.';return 'TAKE YOUR\nMEDICATION\n- H.R.';}
function buildHomeScene(){""")
rep('p7.js', "box(0.09,0.1,0.09,M(0xe8e0d0),-3.5,0.5,-5.4);box(0.16,0.03,0.05,dark,-3.25,0.47,-5.8);/* table, mug, remote */",
            "box(0.09,0.1,0.09,M(0xe8e0d0),-3.5,0.5,-5.4);box(0.16,0.03,0.05,dark,-3.25,0.47,-5.8);/* table, mug, remote */\n  if(S.ending)box(0.09,0.1,0.09,M(0xe8e0d0),-3.3,0.5,-5.35);/* a second cup you did not pour */\n  /* the crew photo: on the wall, or face-down on the table after a run where you died */if(S.lastDied){box(0.3,0.018,0.24,M(0x2a2622),-3.55,0.455,-5.95);}else{plane(0.3,0.24,new THREE.MeshBasicMaterial({map:mkText('CREW  ·  1979\n'+(S.lastSite?S.lastSite.slice(0,14):'DEAD AIR'),128,96,'#3b3a36','#cfc8b8','bold 11px monospace')}),-5.34,1.45,-6.4,Math.PI/2);box(0.36,0.3,0.03,trimM,-5.36,1.45,-6.4);}\n  /* someone moved a chair to face the TV after Site Zero */if(S.ending){box(0.45,0.05,0.45,wood,-3.6,0.45,-4.35,true);box(0.05,0.5,0.45,wood,-3.38,0.7,-4.35);for(const [dx,dz] of [[-0.2,-0.2],[0.2,-0.2],[-0.2,0.2],[0.2,0.2]])box(0.04,0.45,0.04,wood,-3.6+dx,0.22,-4.35+dz);}")
rep('p7.js', "box(0.3,0.02,0.3,M(0xe8e0d0),0.9,0.79,-5.4);", "box(0.3,0.02,0.3,M(0xe8e0d0),0.9,0.79,-5.4);for(let i=0;i<Math.min(3,S.deaths||0);i++)box(0.26,0.02,0.26,M(0xe8e0d0),0.9+(i%2?0.36:-0.36),0.79,-5.4+(i<2?-0.32:0.32));/* a place set for every time you did not come back */")
rep('p7.js', "x.putImageData(id,0,0);sc.tvTex.needsUpdate=true;", "x.putImageData(id,0,0);if(S.ending&&(H.t%6)<0.5){x.fillStyle='#e0202a';x.save();x.translate(32,32);x.rotate(Math.PI/4);x.fillRect(-5,-5,10,10);x.restore();}else if(S.lastSite&&(H.t%5)<0.35){x.fillStyle='#ffffff';x.font='bold 8px monospace';x.textAlign='center';x.fillText(S.lastSite.slice(0,13).toUpperCase(),32,35);}sc.tvTex.needsUpdate=true;")

r = subprocess.run([sys.executable, os.path.join(ROOT, 'build.py')], capture_output=True, text=True)
print(r.stdout.strip() or r.stderr.strip())
if r.returncode: sys.exit(1)
