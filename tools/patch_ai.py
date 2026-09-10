"""Game-AI pass: BT + utility runtime, utility director with a tension curve and never-repeat scares,
peripheral apparitions, doors that open behind you, whispers, fake-outs, Weeping-Angel echo, utility target picking."""
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

# ======================= 1. AI runtime: blackboard, behavior tree, utility curves =======================
rep('p5.js', "function canSee(c,pl,range){",
r"""/* ===== AI runtime: blackboard, behavior tree, utility curves (shared by the director and creatures) ===== */
const BT={S:1,F:0,R:2};
class Blackboard{constructor(){this.d={};}get(k,def){const v=this.d[k];return v===undefined?def:v;}set(k,v){this.d[k]=v;return v;}}
function btSeq(...ch){return {ch,i:0,tick(bb,dt){for(;this.i<this.ch.length;this.i++){const s=this.ch[this.i].tick(bb,dt);if(s===BT.R)return BT.R;if(s===BT.F){this.i=0;return BT.F;}}this.i=0;return BT.S;},reset(){this.i=0;for(const c of this.ch)if(c.reset)c.reset();}};}
function btSel(...ch){return {ch,i:0,tick(bb,dt){for(;this.i<this.ch.length;this.i++){const s=this.ch[this.i].tick(bb,dt);if(s===BT.R)return BT.R;if(s===BT.S){this.i=0;return BT.S;}}this.i=0;return BT.F;},reset(){this.i=0;for(const c of this.ch)if(c.reset)c.reset();}};}
function btCond(fn){return {tick(bb,dt){return fn(bb,dt)?BT.S:BT.F;}};}
function btAct(fn){return {tick(bb,dt){const r=fn(bb,dt);return r===undefined?BT.S:r;}};}
function btCooldown(sec,n){let last=-1e9;return {tick(bb,dt){if(G.t-last<sec)return BT.F;const s=n.tick(bb,dt);if(s===BT.S)last=G.t;return s;},reset(){if(n.reset)n.reset();}};}
const U={lin:(v,a,b)=>clamp((v-a)/(b-a),0,1),sig:(x,k,mid)=>1/(1+Math.exp(-k*(x-mid))),quad:x=>x*x,inv:x=>1-x,
  /* product with compensation: one weak consideration dampens, never vetoes */
  cprod(arr){let p=1;const n=arr.length;for(const v of arr){const c=clamp(v,0,1);const m=(1-c)*(1-1/n);p*=c+m*c;}return p;},
  pick(actions,bb,current){let best=null,bs=-1,scores={};for(const a of actions){let s=a.score(bb);if(!(s>0))s=0;if(current&&a.id===current)s*=1.12;scores[a.id]=s;if(s>bs){bs=s;best=a;}}return {a:best,s:bs,scores};}};
/* does a player have this creature in the middle of their view (no flashlight needed)? */
function lookingAt(c,pl,range,cone){if(pl.k!==c.k||pl.dead)return false;const d=c.pos.distanceTo(pl.pos);if(d>(range||20)||d<0.2)return false;let yaw,pitch;if(pl.local){yaw=P.yaw;pitch=P.pitch;}else{const a=G.avatars[pl.id];if(!a)return false;yaw=a.yaw;pitch=(a.net&&a.net.pitch)||0;}
  const fx=-Math.sin(yaw)*Math.cos(pitch),fy=Math.sin(pitch),fz=-Math.cos(yaw)*Math.cos(pitch);const tx=c.pos.x-pl.pos.x,ty=(c.pos.y+0.8)-(pl.pos.y+1.5),tz=c.pos.z-pl.pos.z;const dot=(fx*tx+fy*ty+fz*tz)/d;if(dot<(cone||0.86))return false;return losClear(G.map,c.k,pl.pos.x,pl.pos.z,c.pos.x,c.pos.z);}
function observed(c,range){for(const p of alivePlayers()){if(lookingAt(c,p,range||22,0.84))return p;}return null;}
/* utility target choice for hunters: near, isolated, loud, lit, hurt, carrying */
function isolation(pl){const ps=alivePlayers();if(ps.length<2)return 0.5;let nd=1e9;for(const q of ps){if(q.id===pl.id)continue;const d=q.k===pl.k?q.pos.distanceTo(pl.pos):40;if(d<nd)nd=d;}return U.lin(nd,4,26);}
function pickTarget(c,cands){if(!cands.length)return null;let best=null,bs=-1;for(const p of cands){const d=c.pos.distanceTo(p.pos);const lit=(p.flash||roomLit(p.k,p.pos.x,p.pos.z))?1:0.45;const hp=p.local?U.inv(U.lin(P.hp,10,100))*0.5+0.5:0.7;const carrying=(p.local?(P.hands?1:0):(G.avatars[p.id]&&G.avatars[p.id].hold?1:0))*0.3+0.7;
    const s=U.cprod([U.inv(U.lin(d,2,30)),0.45+0.55*isolation(p),0.5+0.5*clamp(p.loud||0,0,1),lit,hp,carrying]);if(s>bs){bs=s;best=p;}}return best;}
function canSee(c,pl,range){""")

# ======================= 2. creatures: utility targeting, Weeping-Angel echo =======================
rep('p5.js', "if(c.state!=='chase'&&c.state!=='recoil'&&c.state!=='circle'&&c.state!=='cower'&&c.state!=='fetch'){for(const p of alivePlayers()){if(canSee(c,p)){c.state='chase';c.target=p.id;c.lastSeen=G.t;if(MP.on)bcast({t:'ev',k:'sfx',kind:'hound_bark',p:[c.pos.x,c.pos.y,c.pos.z]});Aud.creature('hound_bark',c.pos,1.4);break;}}}",
            "if(c.state!=='chase'&&c.state!=='recoil'&&c.state!=='circle'&&c.state!=='cower'&&c.state!=='fetch'){const seen=alivePlayers().filter(p=>canSee(c,p));const tp=pickTarget(c,seen);if(tp){c.state='chase';c.target=tp.id;c.lastSeen=G.t;if(MP.on)bcast({t:'ev',k:'sfx',kind:'hound_bark',p:[c.pos.x,c.pos.y,c.pos.z]});Aud.creature('hound_bark',c.pos,1.4);}}")
rep('p5.js', "if(c.state!=='attack'&&c.state!=='retreat'){for(const p of alivePlayers()){if(p.loud>0.3&&canSee(c,p)){c.state='hunt';c.target=p.id;c.lastSeen=G.t;G.mission.echoHunted=true;break;}}}",
            "if(c.state!=='attack'&&c.state!=='retreat'){const seen=alivePlayers().filter(p=>p.loud>0.3&&canSee(c,p));const tp=pickTarget(c,seen);if(tp){c.state='hunt';c.target=tp.id;c.lastSeen=G.t;G.mission.echoHunted=true;}}")
# the echo only moves when nobody is looking at it (stalk + wander within 14 m)
rep('p5.js', "else if(c.state==='stalk'){const h=c.lastHeard;if(!h||moveTo(c,h.x,h.z,h.k,spd*1.9,dt)){c.state='wander';c.wp=null;}c.anim='walk';}",
            "else if(c.state==='stalk'){const h=c.lastHeard;const ob=observed(c,22);if(ob){c.anim='idle';c.frozenT=(c.frozenT||0)+dt;if(c.frozenT>0.6&&!G.mission.angelHint&&ob.local){G.mission.angelHint=true;hostEvent(ob.id,{k:'toast',s:'👁 It stopped when you looked. It will not stay stopped when you look away.'});}if(Math.random()<dt*0.4){if(MP.on)bcast({t:'ev',k:'sfx',kind:'echo',p:[c.pos.x,c.pos.y+1,c.pos.z]});Aud.creature('echo',c.pos,0.5);}}else{c.frozenT=0;if(!h||moveTo(c,h.x,h.z,h.k,spd*2.6,dt)){c.state='wander';c.wp=null;}c.anim='walk';}}")
rep('p2.js', "echo:{n:'The Echo',ic:'🗣',major:true,threat:3,d:'Listens. Learns voices. Uses them.'}",
            "echo:{n:'The Echo',ic:'🗣',major:true,threat:3,d:'Listens. Learns voices. Uses them. It only moves when nobody is looking at it.'}")

# ======================= 3. director v2: utility scoring on a tension curve, never the same scare twice =======================
rep('p5.js', "G.director={aggro:0,calmUntil:0,nextEvent:25+Math.random()*20,seen:{}",
            "G.director={aggro:0,calmUntil:0,nextEvent:25+Math.random()*20,seen:{},tension:0,used:{},closed:[],pending:[],decideT:0,lastEventT:0,lastBigT:0,bb:new Blackboard()")
s = rd('p5.js')
i = s.find("function directorTick(dt){"); j = s.find("function runEvent(id,quiet){")
assert i > 0 and j > i
NEWDIR = r"""/* the director scores every scare it could run right now (utility AI) on a calm → dread → spike → relief curve */
const SCARE_MENU=[
  {id:'distant',   min:1,big:0,cd:14, fit:bb=>U.cprod([0.6+0.4*U.inv(bb.get('tension')),0.5+0.5*U.inv(bb.get('danger'))])},
  {id:'doorslam',  min:1,big:0,cd:40, fit:bb=>U.cprod([bb.get('dread'),0.4+0.6*bb.get('dark'),U.inv(bb.get('danger'))])},
  {id:'flicker',   min:1,big:0,cd:45, fit:bb=>U.cprod([bb.get('dread'),bb.get('flash')])},
  {id:'objmove',   min:1,big:0,cd:50, fit:bb=>U.cprod([bb.get('dread'),0.5+0.5*bb.get('dark'),U.inv(bb.get('danger'))])},
  {id:'peripheral',min:1,big:0,cd:70, fit:bb=>U.cprod([bb.get('dread'),bb.get('dark'),U.inv(bb.get('danger')),0.5+0.5*bb.get('iso')])},
  {id:'doorbehind',min:1,big:0,cd:60, fit:bb=>U.cprod([bb.get('dread'),bb.get('closedDoor'),U.inv(bb.get('danger'))])},
  {id:'whisper',   min:1,big:0,cd:200,fit:bb=>U.cprod([bb.get('dread'),bb.get('dark'),bb.get('iso'),U.inv(bb.get('danger'))])},
  {id:'radio',     min:1,big:0,cd:60, fit:bb=>U.cprod([0.5+0.5*bb.get('dread'),bb.get('radio')])},
  {id:'ownvoice',  min:2,big:0,cd:120,fit:bb=>U.cprod([bb.get('dread'),bb.get('iso'),bb.get('voice')])},
  {id:'goldroom',  min:1,big:0,cd:150,fit:bb=>U.cprod([bb.get('relief'),0.6])},
  {id:'mapglitch', min:2,big:0,cd:90, fit:bb=>U.cprod([bb.get('dread'),0.5])},
  {id:'fakeout',   min:1,big:1,cd:999,fit:bb=>U.cprod([bb.get('spike'),bb.get('dark'),U.inv(bb.get('danger')),0.5+0.5*bb.get('iso')])},
  {id:'lightsout', min:2,big:1,cd:150,fit:bb=>U.cprod([Math.max(bb.get('spike'),bb.get('hunt')),bb.get('flash')*0.5+0.5])},
  {id:'creature',  min:2,big:1,cd:120,fit:bb=>U.cprod([bb.get('spike'),U.inv(bb.get('danger')),0.5+0.5*bb.get('deep')])},
  {id:'lockdown',  min:2,big:1,cd:200,fit:bb=>U.cprod([bb.get('spike'),bb.get('deep')])},
  {id:'alarm',     min:3,big:1,cd:200,fit:bb=>U.cprod([bb.get('spike'),0.5])},
  {id:'lowg',      min:2,big:1,cd:300,fit:bb=>U.cprod([bb.get('relief'),0.4])},
  {id:'fakeexit',  min:3,big:1,cd:999,fit:bb=>U.cprod([bb.get('spike'),bb.get('deep')])},
  {id:'elevator',  min:2,big:1,cd:200,fit:bb=>U.cprod([bb.get('spike'),bb.get('elev')])},
  {id:'intern',    min:1,big:0,cd:999,fit:bb=>U.cprod([bb.get('relief'),0.5])},
];
function directorFacts(D){const bb=D.bb;const M=G.mission;const pls=alivePlayers().filter(p=>!p.inVan);if(!pls.length)return null;
  /* the most vulnerable player is the one the site works on */let tp=null,bs=-1;for(const p of pls){const dark=(!p.flash&&!roomLit(p.k,p.pos.x,p.pos.z))?1:0.3;const s=U.cprod([0.4+0.6*isolation(p),dark,0.5+0.5*(p.k/Math.max(1,G.map.L-1)),p.local?0.6+0.4*U.inv(U.lin(P.hp,10,100)):0.7]);if(s>bs){bs=s;tp=p;}}
  const sinceBig=G.t-(D.lastBigT||M.startT||0);const sinceAny=G.t-(D.lastEventT||0);
  bb.set('tp',tp);bb.set('danger',G.fx.danger||0);bb.set('tension',D.tension);
  bb.set('dark',(!tp.flash&&!roomLit(tp.k,tp.pos.x,tp.pos.z))?1:0.35);bb.set('iso',isolation(tp));bb.set('deep',U.lin(tp.k,0,Math.max(1,G.map.L-1)));
  bb.set('flash',tp.flash?1:0.2);bb.set('radio',tp.local?(P.radio.on?1:0.4):0.6);bb.set('voice',(VOICE.clips&&VOICE.clips.length)?1:0.2);bb.set('elev',G.map.elev?1:0);
  /* pacing curve: relief right after a spike, dread as the gap grows, spike once the gap is long and the player has relaxed */
  bb.set('relief',U.inv(U.lin(sinceBig,0,25)));bb.set('dread',U.cprod([U.lin(sinceBig,15,50),U.inv(U.lin(sinceBig,60,140))*0.5+0.5]));bb.set('spike',U.cprod([U.lin(sinceBig,60,120),U.inv(U.lin(D.tension,0.2,0.7))*0.4+0.6]));
  bb.set('hunt',G.fx.danger>0.55?1:0);
  const cds=D.closed.filter(c=>c.pid===tp.id&&G.t-c.t<75&&G.doors[c.id]&&G.doors[c.id].open<0.5&&G.doors[c.id].k===tp.k);let cd=0;for(const c of cds){const d=G.doors[c.id];const dist=dist2(d.x,d.z,tp.pos.x,tp.pos.z);if(dist>4&&dist<16&&!lookingAtPoint(tp,d.x,d.z,0.3))cd=1;}bb.set('closedDoor',cd);
  return bb;}
function lookingAtPoint(pl,x,z,cone){let yaw;if(pl.local)yaw=P.yaw;else{const a=G.avatars[pl.id];if(!a)return false;yaw=a.yaw;}const fx=-Math.sin(yaw),fz=-Math.cos(yaw);const tx=x-pl.pos.x,tz=z-pl.pos.z;const d=Math.hypot(tx,tz)||1;return (fx*tx+fz*tz)/d>(cone===undefined?0.5:cone);}
function noteDoorClosed(pid,d){const D=G.director;if(!D||!d)return;D.closed.push({pid,id:d.id,t:G.t});if(D.closed.length>30)D.closed.shift();}
function directorTick(dt){const D=G.director;D.aggro=Math.max(0,D.aggro-dt*0.02);D.tick+=dt;
  /* tension: creature proximity and noise push it up, quiet lets it bleed off */const want=Math.max(G.fx.danger||0,Math.min(1,(P.lastNoise||0)*1.5));D.tension=lerp(D.tension,want,1-Math.exp(-(want>D.tension?1.5:0.12)*dt));
  for(const p of D.pending.slice()){if(G.t>=p.t){D.pending=D.pending.filter(x=>x!==p);try{p.fn();}catch(e){}}}
  D.decideT-=dt;if(D.decideT<=0){D.decideT=3+Math.random()*3;const bb=directorFacts(D);if(bb){const calm=G.t<D.calmUntil;const cands=SCARE_MENU.filter(m=>m.min<=G.stage&&!(G.mission.sandbox&&m.big)&&!(m.big&&calm)&&G.t-(D.used[m.id]||-1e9)>=m.cd&&!(m.cd>=999&&D.used[m.id]!==undefined));
      const scored=cands.map(m=>({id:m.id,m,score:bb=>m.fit(bb)*Math.pow(0.45,D.seen[m.id]||0)*(S.seenEvents[m.id]?0.85:1.25)}));const r=U.pick(scored,bb,null);
      /* fire when the best scare is good enough; the gap since the last event raises the bar it must clear */const gap=G.t-D.lastEventT;const bar=Math.max(0.12,0.55-gap*0.006)*(G.mission.sandbox?1.6:1)/(1+G.stage*0.1);
      if(r.a&&r.s>bar){const m=r.a.m;D.used[m.id]=G.t;D.seen[m.id]=(D.seen[m.id]||0)+1;S.seenEvents[m.id]=(S.seenEvents[m.id]||0)+1;D.lastEventT=G.t;if(m.big)D.lastBigT=G.t;runEvent(m.id,false,bb.get('tp'));}}}
  D.distantT-=dt;if(D.distantT<=0){D.distantT=14+Math.random()*25;runEvent('distant',true);}
}
"""
s = s[:i] + NEWDIR + s[j:]
wr('p5.js', s); print('director replaced')
# runEvent gets an optional chosen target and the new scare kinds
rep('p5.js', "function runEvent(id,quiet){const data={};const pls=alivePlayers();const tp=pls.length?pick(pls):null;",
            "function runEvent(id,quiet,chosen){const data={};const pls=alivePlayers();const tp=chosen||(pls.length?pick(pls):null);")
rep('p5.js', "    case 'radio':case 'alarm':case 'fakeexit':case 'mapglitch':break;\n  }",
"""    case 'radio':case 'alarm':case 'fakeexit':case 'mapglitch':break;
    case 'peripheral':{if(!tp)return;const eco=(G.mission.eco&&G.mission.eco.length)?G.mission.eco:['echo'];const kind=pick(eco.filter(k=>k!=='window'&&k!=='hanger'&&k!=='mimic'))||'echo';let yaw;if(tp.local)yaw=P.yaw;else{const a=G.avatars[tp.id];yaw=a?a.yaw:0;}
      let spot=null;for(let i=0;i<24&&!spot;i++){const side=Math.random()<0.5?-1:1;const ang=yaw+side*(0.95+Math.random()*0.5);const d=8+Math.random()*6;const x=tp.pos.x-Math.sin(ang)*d,z=tp.pos.z-Math.cos(ang)*d;if(cellAt(G.map,tp.k,x,z)===T_VOID)continue;if(!losClear(G.map,tp.k,tp.pos.x,tp.pos.z,x,z))continue;spot={x,z};}
      if(!spot)return;data.kind=kind;data.p=[spot.x,layerY(tp.k),spot.z];data.k=tp.k;data.yaw=Math.atan2(tp.pos.x-spot.x,tp.pos.z-spot.z);data.pid=tp.id;break;}
    case 'doorbehind':{if(!tp)return;const D=G.director;const cds=D.closed.filter(c=>c.pid===tp.id&&G.t-c.t<75&&G.doors[c.id]&&G.doors[c.id].open<0.5&&G.doors[c.id].k===tp.k);let best=null;for(const c of cds){const d=G.doors[c.id];const dist=dist2(d.x,d.z,tp.pos.x,tp.pos.z);if(dist>4&&dist<16&&!lookingAtPoint(tp,d.x,d.z,0.3))best=d;}if(!best)return;best.locked=false;setDoorHost(best,1,false);hostEvent(tp.id,{k:'doorbehind'});return;}
    case 'whisper':{if(!tp)return;hostEvent(tp.id,{k:'whisper',i:1+Math.floor(Math.random()*3)});return;}
    case 'fakeout':{if(!tp)return;const a=Math.random()*TAU,d=2.5+Math.random()*2;data.p=[tp.pos.x+Math.sin(a)*d,layerY(tp.k)+1,tp.pos.z+Math.cos(a)*d];data.pid=tp.id;
      /* the real one: six to ten seconds after everyone relaxes */const D=G.director;D.pending.push({t:G.t+6+Math.random()*4,fn:()=>{const pl=alivePlayers().find(p=>p.id===tp.id);if(!pl||pl.inVan)return;const eco=(G.mission.eco&&G.mission.eco.length)?G.mission.eco.filter(k=>['hound','echo','stack','crawler','collector','sleeper'].indexOf(k)>=0):[];const kind=eco.length?pick(eco):'hound';const b=Math.random()*TAU;const rp=randomWalkCell(G.map,pl.k);spawnCreature(kind,rp.x,rp.z,pl.k,{state:kind==='hound'?'chase':'hunt'});const c=G.creatures[G.creatures.length-1];if(c){c.target=pl.id;c.lastSeen=G.t;c.lastHeard={x:pl.pos.x,z:pl.pos.z,k:pl.k,t:G.t,loud:1};}runEvent('lightsout');}});break;}
  }""")
# clients and host both play the local part of a scare
rep('p5.js', "function applyEvent(id,d,quiet){switch(id){",
"""function applyEvent(id,d,quiet){switch(id){
    case 'peripheral':spawnGhost(d.kind,d.p,d.k,d.yaw,d.pid);break;
    case 'fakeout':{const p=new THREE.Vector3(d.p[0],d.p[1],d.p[2]);if(!Aud.play('fake_drop',p,0.9))Aud.impact(0.8,p);if(S.set.subs)subtitle('[something fell]');if(d.pid===P.id)G.fx.shake+=0.25;break;}""")
rep('p5.js', "function applyLocalEvent(ev){if(ev.k==='blind'){",
"""function applyLocalEvent(ev){if(ev.k==='whisper'){const fx=-Math.sin(P.yaw),fz=-Math.cos(P.yaw);const p=new THREE.Vector3(P.pos.x-fx*0.5,P.pos.y+1.5,P.pos.z-fz*0.5);if(!Aud.play('whisper_'+(ev.i||1),p,1.0,{noVar:true}))Aud.creature('echo',p,1);setTimeout(()=>Aud.play('breath_close',p,0.5),900);G.fx.shake+=0.25;G.fx.glitch=Math.max(G.fx.glitch,0.35);if(S.set.subs)subtitle('[...right behind you]');Aud.duck(0.7,2.5);return;}
  if(ev.k==='doorbehind'){if(S.set.subs)subtitle('[the door you closed just opened]');G.fx.shake+=0.15;return;}
  if(ev.k==='blind'){""")
# ---- apparitions: a creature stands at the edge of your view, gone the moment you look ----
rep('p5.js', "function updateLightsFx(dt){updateVanLock(dt);updateDissolve(dt);",
"""function spawnGhost(kind,p,k,yaw,pid){const rig=Assets.rig(kind);if(!rig)return;enhanceRig(rig.root,kind);rig.root.position.set(p[0],p[1],p[2]);rig.root.rotation.y=yaw+Math.PI;rig.root.traverse(o=>{if(o.isSprite)o.visible=false;});G.scene.add(rig.root);try{rig.play('idle',0);}catch(e){}
  G.ghosts=G.ghosts||[];G.ghosts.push({rig,k,t:0,seen:0,pid,pos:new THREE.Vector3(p[0],p[1],p[2])});if(pid===P.id){Aud.creature(kind,new THREE.Vector3(p[0],p[1]+1,p[2]),0.35);}}
function updateGhosts(dt){if(!G.ghosts)return;for(const g of G.ghosts.slice()){g.t+=dt;if(g.rig.mixer)g.rig.mixer.update(dt);const fake={pos:g.pos,k:g.k,dead:false,id:P.id,local:true};const look=P.k===g.k&&lookingAt(fake,{pos:P.pos,k:P.k,dead:false,id:P.id,local:true},24,0.9);if(look)g.seen+=dt;
    if(g.seen>0.22||g.t>3.2){G.ghosts=G.ghosts.filter(x=>x!==g);if(g.rig.root.userData.dissolve){G.dissolving=G.dissolving||[];G.dissolving.push({root:g.rig.root,t:0,mixer:g.rig.mixer});}else G.scene.remove(g.rig.root);if(g.seen>0.22&&g.pid===P.id){G.fx.shake+=0.3;G.fx.glitch=Math.max(G.fx.glitch,0.5);Aud.sting('scare');if(S.set.subs)subtitle('[it was there]');if(!G.mission.ghostHint){G.mission.ghostHint=true;setTimeout(()=>toast('👁 Something was standing at the edge of your vision. It never stays where you look.','big'),600);}}}}}
function updateLightsFx(dt){updateVanLock(dt);updateDissolve(dt);updateGhosts(dt);""")
# ---- host learns which doors each player closed (local host + remote acts) ----
rep('p4.js', "function setDoor(d,target,slam){d.target=target;", "function setDoor(d,target,slam){d.target=target;if(target===0&&mpHost())noteDoorClosed(P.id,d);")
rep('p6.js', "case 'door':{const d=G.doors[a.id];if(!d||d.locked&&!a.force)return;d.target=a.o;", "case 'door':{const d=G.doors[a.id];if(!d||d.locked&&!a.force)return;d.target=a.o;if(a.o===0)noteDoorClosed(id,d);")
# ---- ghosts must be cleared with the scene ----
rep('p4.js', "function clearScene(){if(G.scene){", "function clearScene(){G.ghosts=[];if(G.scene){")
# ---- danger widens the eye: FOV creeps up while hunted ----
rep('p4.js', "const wantFov=S.set.fov+((P.sprint&&il>0&&P.stamina>0.02)?7:0)+(P.grabbedT&&G.t<P.grabbedT?-6:0);",
            "const wantFov=S.set.fov+((P.sprint&&il>0&&P.stamina>0.02)?7:0)+(P.grabbedT&&G.t<P.grabbedT?-6:0)+(G.fx.danger||0)*7;")
# ---- mission start time for the pacing curve ----
rep('p7.js', "M.eco=eco;", "M.eco=eco;M.startT=G.t;")

r = subprocess.run([sys.executable, os.path.join(ROOT, 'build.py')], capture_output=True, text=True)
print(r.stdout.strip() or r.stderr.strip())
if r.returncode: sys.exit(1)
