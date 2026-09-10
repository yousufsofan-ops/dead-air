/* ================= AVATARS (remote players) ================= */
function applyCosmetics(root,cos){cos=cos||S.cos;const want=new Set();for(const cat in COS_MESH){const n=COS_MESH[cat][cos[cat]||0];if(n)want.add(n);}
  root.traverse(m=>{const n=(m.name||'').replace(/_\d+$/,'');const isCos=/^(Hair|Face|Outfit|Helmet|Pack|Acc)_/.test(n);if(isCos)m.visible=want.has(n);if(!m.isMesh&&!m.isSkinnedMesh)return;
    if(m.material&&m.material.name==='player_outfit'){m.material=m.material.clone();m.material.color.setHex(COS.color[cos.color||0]);}});}
function mkLabel(text,color){const c=document.createElement('canvas');c.width=256;c.height=64;const x=c.getContext('2d');x.font='bold 30px Segoe UI, sans-serif';x.textAlign='center';x.fillStyle='rgba(0,0,0,0.5)';x.fillRect(0,8,256,48);x.fillStyle=color||'#fff';x.fillText(text,128,42);const t=new THREE.CanvasTexture(c);const s=new THREE.Sprite(new THREE.SpriteMaterial({map:t,transparent:true,depthTest:false}));s.scale.set(1.6,0.4,1);return s;}
function createAvatar(id,info){if(G.avatars[id])return G.avatars[id];const r=Assets.rig('player');applyCosmetics(r.root,info.cos);enhanceRig(r.root,'player');G.scene.add(r.root);
  const fl=new THREE.SpotLight(0xfff0d0,0,20,0.45,0.5,1.4);r.root.add(fl);fl.position.set(-0.29,1.3,-0.2);const tg=new THREE.Object3D();tg.position.set(-0.2,1.1,-6);r.root.add(tg);fl.target=tg;
  const lab=mkLabel((info.bd?'◆ ':'')+(info.pr?PRESTIGE_TITLES[info.pr]+' ':'')+(info.name||('P'+id)));lab.position.y=2.25;r.root.add(lab);const mic=mkLabel('🎙','#7ddc7d');mic.position.y=2.6;mic.visible=false;r.root.add(mic);
  const a={id,name:info.name||('P'+id),cos:info.cos,pos:new THREE.Vector3(G.map?G.map.spawn.x:0,0,G.map?G.map.spawn.z:0),net:null,yaw:0,pitch:0,k:0,hp:100,downed:false,dead:false,rig:r,fl,lab,mic,anim:'idle',talk:false,radio:false,flash:false,crouch:false,speed:0,hold:null,loud:0,lookW:false,anchor:null,inVan:false,last:G.t,hasBody:true};G.avatars[id]=a;return a;}
function removeAvatar(id){const a=G.avatars[id];if(!a)return;G.scene.remove(a.rig.root);delete G.avatars[id];}
function applyAvatarPacket(id,d){const a=G.avatars[id]||createAvatar(id,MP.players[id]||{name:'P'+id});a.net={p:new THREE.Vector3(d.p[0],d.p[1],d.p[2]),yaw:d.y,pitch:d.pt};a.k=d.l;a.crouch=!!d.cr;a.flash=!!d.fl;a.talk=!!d.tk;a.radio=!!d.rd;a.hold=d.h||null;a.loud=d.n||0;a.lookW=!!d.lw;a.speed=d.sp||0;a.inVan=!!d.iv;a.last=G.t;if(d.an)a.anchor=new THREE.Vector3(d.an[0],d.an[1],d.an[2]);if(d.hp!==undefined)a.hp=d.hp;if(d.dn!==undefined)a.downed=!!d.dn;if(d.dd!==undefined)a.dead=!!d.dd;}
const _hp1=new THREE.Vector3(),_hp2=new THREE.Vector3();
function updateAvatars(dt){for(const id in G.avatars){const a=G.avatars[id];if(a.net){a.pos.lerp(a.net.p,Math.min(1,dt*12));const dy=((a.net.yaw-a.yaw+Math.PI*3)%(Math.PI*2))-Math.PI;a.yaw+=dy*Math.min(1,dt*12);a.pitch=lerp(a.pitch,a.net.pitch,dt*10);}
  const r=a.rig;r.root.position.copy(a.pos);r.root.rotation.y=a.yaw+Math.PI;r.root.visible=!a.dead;if(a.gone){if(!a.goneLab){a.goneLab=true;if(a.lab&&a.lab.material&&a.lab.material.map){a.lab.material.opacity=0.45;}}}else if(a.goneLab){a.goneLab=false;if(a.lab&&a.lab.material)a.lab.material.opacity=1;}
  const held=a.hold&&G.objById[a.hold];let an='idle';if(a.dead)an='dead';else if(a.downed)an='crawl';else if(held&&held.sz>=1)an=a.speed>0.4?'carry':'carry';else if(a.crouch)an='crouch';else if(a.speed>5)an='run';else if(a.speed>0.4)an='walk';
  if(a.emoteT>G.t){}else if(an!==a.anim){a.anim=an;r.play(an,0.2,an==='dead');}
  if(an==='crouch'&&a.speed<0.3)r.mixer.timeScale=0;else r.mixer.timeScale=1;
  r.mixer.update(dt);
  a.stepT=(a.stepT||0)+dt*a.speed;if(a.speed>0.5&&!a.dead&&a.stepT>(a.crouch?1.4:a.speed>5?2.4:1.9)){a.stepT=0;if(a.k===P.k&&a.pos.distanceTo(P.pos)<30)Aud.step(a.crouch?0.12:a.speed>5?0.5:0.3,a.pos,a.crouch,surfaceAt(a.k,a.pos.x,a.pos.z));}
  a.fl.intensity=a.flash?1.8:0;a.mic.visible=a.talk||a.radio;a.mic.material.color.setHex(a.radio?0xffb347:0xffffff);
  /* held item follows their hand */if(held&&held.held===a.id&&!held.holders.length){const fwd=new THREE.Vector3(-Math.sin(a.yaw),0,-Math.cos(a.yaw));if(a.handL===undefined){a.handL=null;a.handR=null;r.root.traverse(o=>{if(o.isBone){if(o.name==='hand.L')a.handL=o;if(o.name==='hand.R')a.handR=o;}});}
    if(a.handL&&a.handR&&held.sz<=1){a.handL.getWorldPosition(_hp1);a.handR.getWorldPosition(_hp2);held.p.copy(_hp1).add(_hp2).multiplyScalar(0.5).addScaledVector(fwd,0.12);held.p.y-=held.h*0.35;}else{const d=held.sz>=2?0.9:0.6;held.p.copy(a.pos).addScaledVector(fwd,d);held.p.y=a.pos.y+(held.sz>=2?0.65:0.95);}held.k=a.k;held.yaw=a.yaw;held.mesh.visible=held.sz!==0;}
  if(held&&held.holders.length>=2&&a.anchor&&!mpHost()){/* client sees host positions */}
  /* fade out label with distance */const d=a.pos.distanceTo(P.pos);a.lab.visible=d<25&&!a.dead;
}}
function nameOf(pid){if(pid===P.id)return MP.name||'You';const p=MP.players[pid];return p?p.name:'P'+pid;}
function allPlayers(){const arr=[{id:P.id,pos:P.pos,k:P.k,flash:P.flash&&P.batt>0,crouch:P.crouch,speed:Math.hypot(P.vel.x,P.vel.z),loud:P.lastNoise,downed:P.downed,dead:P.dead,lookW:P.lookW,inVan:P.inVan,local:true}];for(const id in G.avatars){const a=G.avatars[id];if(G.t-a.last>8)continue;arr.push({id:a.id,pos:a.pos,k:a.k,flash:a.flash,crouch:a.crouch,speed:a.speed,loud:a.loud,downed:a.downed,dead:a.dead,lookW:a.lookW,inVan:a.inVan,local:false});}return arr;}
function alivePlayers(){return allPlayers().filter(p=>!p.dead&&!p.inVan);}
/* ================= CREATURES ================= */
/* pace per creature (player: walk 4.1, sprint 6.4). speed = wander/patrol, hunt = burst chase speed, burst = seconds it can hold the chase speed, rest = seconds of exhaustion afterwards (capped at tired speed 2.8) */
const CR_CFG={echo:{hear:40,sight:16,speed:1.2,hunt:4.6,burst:4,rest:5,hover:0,r:0.45,h:2.9},crawler:{hear:25,sight:20,speed:2.0,hunt:6.0,burst:2.5,rest:6,hover:0,r:0.7,h:1.0},lighteater:{hear:8,sight:30,speed:1.4,hunt:2.4,burst:99,rest:0,hover:1.0,r:0.9,h:1.6},window:{hear:0,sight:0,speed:0,hunt:0,burst:99,rest:0,hover:0,r:0.4,h:2.1},hound:{hear:55,sight:11,speed:2.2,hunt:5.9,burst:2.0,rest:5.5,hover:0,r:0.5,h:1.0},stack:{hear:0,sight:0,speed:0,hunt:4.2,burst:3,rest:6,hover:0,r:0.5,h:1.2},drifter:{hear:0,sight:0,speed:0.5,hunt:0.5,burst:99,rest:0,hover:1.4,r:0.5,h:1.2},warden:{hear:30,sight:40,speed:2.0,hunt:3.0,burst:99,rest:0,hover:0,r:0.85,h:3.5},mourner:{hear:0,sight:0,speed:0,hunt:0,burst:99,rest:0,hover:0,r:0.5,h:1.8},hanger:{hear:0,sight:0,speed:0,hunt:0,burst:99,rest:0,hover:0,r:0.5,h:2.4},collector:{hear:20,sight:14,speed:2.0,hunt:3.8,burst:4,rest:4,hover:0,r:0.5,h:1.3},sleeper:{hear:60,sight:10,speed:2.4,hunt:5.6,burst:3,rest:7,hover:0,r:1.7,h:2.2},mimic:{hear:0,sight:12,speed:2.8,hunt:4.9,burst:3,rest:6,hover:0,r:0.45,h:0.7},swarm:{hear:0,sight:20,speed:1.3,hunt:2.4,burst:99,rest:0,hover:1.4,r:0.8,h:1.6},burrower:{hear:30,sight:0,speed:2.2,hunt:2.2,burst:99,rest:0,hover:0,r:0.8,h:1.3},twin:{hear:0,sight:16,speed:0.9,hunt:6.6,burst:1.6,rest:8,hover:0,r:0.45,h:2.1}};
const TIRED_SPEED=2.8;
function paceSpeed(c,speed,dt){const cfg=CR_CFG[c.kind];if(!cfg||speed<=0)return speed;speed=Math.min(speed,Math.max(cfg.speed,cfg.hunt)*1.15);const fast=speed>cfg.speed*1.05+0.05;
  if(c.restT>0){c.restT-=dt;if(c.restT<=0)c.tired=false;return Math.min(speed,Math.min(TIRED_SPEED,Math.max(cfg.speed,1.0)));}
  if(c.burstT===undefined)c.burstT=cfg.burst;
  if(fast&&cfg.burst<99){c.burstT-=dt;if(c.burstT<=0){c.restT=cfg.rest;c.burstT=cfg.burst;c.tired=true;return Math.min(speed,TIRED_SPEED);}return speed;}
  c.burstT=Math.min(cfg.burst,c.burstT+dt*0.5);return speed;}
const reach=k=>CR_CFG[k].r+0.95;
let crSeq=0;
function spawnCreature(kind,x,z,k,opts){opts=opts||{};const id=opts.id||('c'+(crSeq++)+'_'+kind);const c={id,kind,pos:new THREE.Vector3(x,groundY(G.map,k,x,z),z),k,yaw:0,state:opts.state||'wander',timer:0,target:null,path:null,pathT:0,pathI:0,alert:0,lastHeard:null,anim:'idle',visible:kind!=='crawler'&&kind!=='window',rig:null,ceiling:false,sfxT:Math.random()*4,mimicT:25+Math.random()*20,per:{},cool:0,net:null,extra:{},born:G.t};
  c.rig=Assets.rig(kind);if(!c.rig){c.rig={root:new THREE.Group(),mixer:{update(){}},play(){}};}else enhanceRig(c.rig.root,kind);G.scene.add(c.rig.root);c.rig.root.visible=c.visible;
  const sc=kind==='drifter'?0.8:1;c.rig.root.scale.set(sc,sc,sc);
  if(kind==='crawler'){c.state='hidden';c.visible=false;c.timer=15+Math.random()*20;}
  if(kind==='window'){c.state='idle';c.visible=false;c.timer=30+Math.random()*30;}
  if(kind==='stack'){c.state='hidden';c.visible=true;}
  if(kind==='drifter'){c.dir=Math.random()*TAU;}
  if(kind==='warden'){c.state='hunt';}
  if(kind==='mourner'){c.state='kneel';c.sobT=2+Math.random()*4;}
  if(kind==='hanger'){c.state='hang';c.pos.y=layerY(k)+WALL_H-0.05;c.anchorY=c.pos.y;}
  if(kind==='collector'){c.state='wander';c.nest=randomWalkCell(G.map,k);}
  if(kind==='sleeper'){c.state='sleep';c.awake=0;c.nest={x:c.pos.x,z:c.pos.z,k};c.rig.root.scale.set(1.15,1.15,1.15);}
  if(kind==='mimic'){c.state='hidden';c.visible=true;c.lurkT=0;}
  if(kind==='swarm'){c.state='wander';c.pos.y=layerY(k)+1.4;}
  if(kind==='burrower'){c.state='lurk';c.visible=true;c.trackT=0;c.rumbleT=0;}
  if(kind==='twin'){c.state='approach';c.stare=0;c.waveT=3;const lb=mkLabel(nameOf(opts.who!==undefined?opts.who:P.id)||'You','#9ad');lb.material.depthTest=true;lb.position.y=2.35;c.rig.root.add(lb);}
  initHeadTrack(c);c.rig.play(kind==='drifter'?'float':'idle',0);
  G.creatures.push(c);if(mpHost()&&MP.on)bcast({t:'ev',k:'spawn',id,kind,p:[x,c.pos.y,z],l:k,st:c.state,who:opts.who});
  if(!S.stats.creaturesMet[kind]){S.stats.creaturesMet[kind]=true;}
  return c;}
function removeCreature(c){G.creatures=G.creatures.filter(x=>x!==c);c.rig.root.traverse(o=>{if(o.isSprite)o.visible=false;});if(c.rig.root.userData.dissolve&&c.visible){G.dissolving=G.dissolving||[];G.dissolving.push({root:c.rig.root,t:0,mixer:c.rig.mixer});}else G.scene.remove(c.rig.root);if(mpHost()&&MP.on)bcast({t:'ev',k:'despawn',id:c.id});}
function beamOnCreature(c,pl,range){if(!pl.flash||pl.k!==c.k||pl.dead)return false;const d=c.pos.distanceTo(pl.pos);if(d>range||d<0.3)return false;let yaw,pitch;if(pl.local){yaw=P.yaw;pitch=P.pitch;}else{const a=G.avatars[pl.id];if(!a)return false;yaw=a.yaw;pitch=(a.net&&a.net.pitch)||0;}
  const fx=-Math.sin(yaw)*Math.cos(pitch),fy=Math.sin(pitch),fz=-Math.cos(yaw)*Math.cos(pitch);const tx=c.pos.x-pl.pos.x,ty=(c.pos.y+0.5)-(pl.pos.y+1.5),tz=c.pos.z-pl.pos.z;const dot=(fx*tx+fy*ty+fz*tz)/d;if(dot<0.93)return false;return losClear(G.map,c.k,pl.pos.x,pl.pos.z,c.pos.x,c.pos.z);}
function breakObjHost(o){if(typeof breakObj==='function')breakObj(o);}
/* ===== AI runtime: blackboard, behavior tree, utility curves (shared by the director and creatures) ===== */
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
function canSee(c,pl,range){if(pl.k!==c.k||pl.dead)return false;const d=c.pos.distanceTo(pl.pos);let r=range||CR_CFG[c.kind].sight;if(!pl.flash&&!roomLit(pl.k,pl.pos.x,pl.pos.z))r*=0.4;if(pl.crouch)r*=0.7;if(d>r)return false;return losClear(G.map,c.k,c.pos.x,c.pos.z,pl.pos.x,pl.pos.z);}
function roomLit(k,x,z){for(const l of G.lights){if(l.k!==k||!l.on)continue;if(dist2(l.x,l.z,x,z)<7)return true;}for(const f of G.flareObjs){if(f.k===k&&dist2(f.p.x,f.p.z,x,z)<6)return true;}return false;}
function nearestPlayer(c,filter){let best=null,bd=1e9;for(const p of allPlayers()){if(p.dead||p.inVan)continue;if(filter&&!filter(p))continue;const d=p.pos.distanceTo(c.pos)+(p.k!==c.k?LAYER_GAP*3:0);if(d<bd){bd=d;best=p;}}return best?{p:best,d:bd}:null;}
function moveTo(c,tx,tz,tk,speed,dt){speed=paceSpeed(c,speed,dt);const same=c.k===tk;const d=same?dist2(c.pos.x,c.pos.z,tx,tz):99;
  if(same&&d<1.2){c.path=null;return true;}
  {const nwp=c.path&&c.path[c.pathI];if(creatureDoors(c,nwp?nwp.x:tx,nwp?nwp.z:tz,speed,dt))return false;}
  if(same&&d<9&&losClear(G.map,c.k,c.pos.x,c.pos.z,tx,tz)){stepToward(c,tx,tz,speed,dt);return false;}
  if(!c.path||G.t-c.pathT>0.8||!c.path.length){c.path=findPath(G.map,c.k,c.pos.x,c.pos.z,tk,tx,tz);c.pathT=G.t;c.pathI=0;if(!c.path){c.path=null;return false;}}
  const wp=c.path[c.pathI];if(!wp)return true;
  if(wp.k!==c.k&&Math.abs(wp.k-c.k)===1){/* on stairs: move toward wp x/z, switch layer when we drop below midpoint */const st=stairAtPos(G.map,c.k,c.pos.x,c.pos.z);if(st){const midY=layerY(st.k)-LAYER_GAP*0.5;if((wp.k>c.k&&c.pos.y<midY)||(wp.k<c.k&&c.pos.y>midY))c.k=wp.k;}else if(dist2(c.pos.x,c.pos.z,wp.x,wp.z)<0.8)c.k=wp.k;}
  stepToward(c,wp.x,wp.z,speed,dt);
  if(dist2(c.pos.x,c.pos.z,wp.x,wp.z)<0.7){c.pathI++;if(c.pathI>=c.path.length){c.path=null;return dist2(c.pos.x,c.pos.z,tx,tz)<1.5;}}
  /* doors: handled by creatureDoors at the top of moveTo */
  return false;}
function stepToward(c,tx,tz,speed,dt){const dx=tx-c.pos.x,dz=tz-c.pos.z;const d=Math.hypot(dx,dz);if(d<1e-3)return;const s=Math.min(d,speed*dt);const ty=Math.atan2(dx,dz);let dy=((ty-c.yaw+Math.PI*3)%(Math.PI*2))-Math.PI;c.yaw+=dy*Math.min(1,dt*8);const solid=c.kind!=='crawler'||!c.ceiling;const opts=doorStyle(c)==='seep'?{noDoors:true}:null;const n=solid?Math.max(1,Math.ceil(s/0.25)):1;const p2={x:c.pos.x,z:c.pos.z};for(let i=0;i<n;i++){p2.x+=dx/d*(s/n);p2.z+=dz/d*(s/n);if(solid)collideCircle(G.map,c.k,p2,0.35,c.pos.y,2,opts);}c.pos.x=p2.x;c.pos.z=p2.z;}
/* ---- creatures and doors ----
   open  : stops, works the handle for a moment (door rattles, players hear it), then opens
   fast  : opens instantly and quietly
   slam  : kicks the door open at a run (loud)
   smash : the warden breaks it (existing state)
   seep  : slips under or through closed doors (spore clouds, swarms, burrower) */
const DOOR_STYLE={echo:'open',crawler:'fast',lighteater:'open',hound:'slam',stack:'open',drifter:'seep',warden:'smash',collector:'open',sleeper:'open',mimic:'fast',swarm:'seep',burrower:'seep',twin:'open',mourner:'open',hanger:'seep',window:'seep'};
function doorStyle(c){return DOOR_STYLE[c.kind]||'open';}
function doorRattle(d,t){d.rattle=Math.max(d.rattle||0,t);const p=new THREE.Vector3(d.x,layerY(d.k)+1,d.z);Aud.rattle(p,t);if(MP.on)bcast({t:'ev',k:'rattle',id:d.id,t});}
const DOOR_CLOSE={open:0.45,fast:0.35,slam:0,smash:0,seep:0};
function doorNormal(d){const a=d.cells[0],b=d.cells[1];return [b[0]-a[0],b[1]-a[1]];}
function playerNearDoor(d,r){for(const p of allPlayers()){if(p.k===d.k&&!p.dead&&dist2(p.pos.x,p.pos.z,d.x,d.z)<r)return true;}return false;}
function creatureDoors(c,hx,hz,speed,dt){
  if(c.dwait>0){c.dwait-=dt;const d=c.ddoor;
    if(c.dclose){/* turning back to shut the door we came through */if(!d||d.broken||d.open<0.5&&d.target<0.5){c.dwait=0;c.ddoor=null;c.dclose=false;return false;}
      const ty=Math.atan2(d.x-c.pos.x,d.z-c.pos.z);let dy=((ty-c.yaw+Math.PI*3)%(Math.PI*2))-Math.PI;c.yaw+=dy*Math.min(1,dt*10);
      if(c.dwait<=0){c.ddoor=null;c.dclose=false;if(!playerNearDoor(d,1.3))setDoorHost(d,0,Math.random()<0.25);return false;}return true;}
    if(!d||d.broken||d.open>0.5||d.target>0.5){c.dwait=0;c.ddoor=null;return false;}
    if(c.dwait<=0){c.ddoor=null;if(!d.locked||c.kind==='crawler'){d.locked=false;setDoorHost(d,1,!!c.dslam);}c.dslam=false;return false;}
    return true;}
  const st=doorStyle(c);if(st==='seep')return false;
  /* the door we last passed: once we are through and a step beyond it, sometimes turn and close it */
  if(c.pdoor){const d=c.pdoor;const n=doorNormal(d);const sd=(c.pos.x-d.x)*n[0]+(c.pos.z-d.z)*n[1];const dl=Math.hypot(c.pos.x-d.x,c.pos.z-d.z);
    if(d.broken||d.k!==c.k||(d.open<0.5&&d.target<0.5)||dl>5){c.pdoor=null;}
    else if(Math.sign(sd)!==c.pside&&dl>1.2){c.pdoor=null;if(Math.random()<(DOOR_CLOSE[st]||0)&&!playerNearDoor(d,2.2)){c.ddoor=d;c.dwait=0.3+Math.random()*0.3;c.dclose=true;return true;}}}
  const reach=Math.max(1.7,0.8+speed*0.3);const mx=hx-c.pos.x,mz=hz-c.pos.z,ml=Math.hypot(mx,mz)||1;
  for(const id in G.doors){const dd=G.doors[id];if(dd.k!==c.k||dd.blast||dd.broken)continue;
    const dx=dd.x-c.pos.x,dz=dd.z-c.pos.z;const dl=Math.hypot(dx,dz);if(dl>reach)continue;
    if(dl>0.6&&(dx*mx+dz*mz)/(dl*ml)<0.15)continue; /* not the door we are heading for */
    if(dd.open>0.5||dd.target>0.5){if(!c.pdoor&&!dd.locked){const n=doorNormal(dd);c.pdoor=dd;c.pside=Math.sign((c.pos.x-dd.x)*n[0]+(c.pos.z-dd.z)*n[1])||1;}continue;}
    if(c.kind==='warden'){if(c.state!=='smashdoor'){c.state='smashdoor';c.timer=3;c.door=dd;c.rig.play('smash',0.2,true);}return true;}
    if(dd.locked&&c.kind!=='crawler'){if(G.t-(dd.rattledT||0)>5){dd.rattledT=G.t;doorRattle(dd,1.4);}continue;}
    {const n=doorNormal(dd);c.pdoor=dd;c.pside=Math.sign((c.pos.x-dd.x)*n[0]+(c.pos.z-dd.z)*n[1])||1;}
    if(st==='slam'){c.ddoor=dd;c.dwait=0.55;c.dslam=true;doorRattle(dd,0.55);return true;}
    if(st==='fast'){setDoorHost(dd,1,false);continue;}
    const wait=0.5+Math.random()*0.7;c.ddoor=dd;c.dwait=wait;doorRattle(dd,wait);return true;}
  return false;}
function setDoorHost(d,o,slam){d.target=o;const p=new THREE.Vector3(d.x,layerY(d.k)+1,d.z);Aud.door(p,slam);if(slam)doorSlamFeel(d);if(MP.on)bcast({t:'ev',k:'door',id:d.id,o,slam:!!slam});}
function hostDamage(pid,amt,src){if(pid===P.id){hurt(amt,src);return;}if(MP.on)sendTo(pid,{t:'ev',k:'damage',amt,src});}
function hostEvent(pid,ev){if(pid===P.id)applyLocalEvent(ev);else if(MP.on)sendTo(pid,{t:'ev',k:'local',ev});}
function applyLocalEvent(ev){if(ev.k==='whisper'){const fx=-Math.sin(P.yaw),fz=-Math.cos(P.yaw);const p=new THREE.Vector3(P.pos.x-fx*0.5,P.pos.y+1.5,P.pos.z-fz*0.5);if(!Aud.play('whisper_'+(ev.i||1),p,1.0,{noVar:true}))Aud.creature('echo',p,1);setTimeout(()=>Aud.play('breath_close',p,0.5),900);G.fx.shake+=0.25;G.fx.glitch=Math.max(G.fx.glitch,0.35);if(S.set.subs)subtitle('[...right behind you]');Aud.duck(0.7,2.5);return;}
  if(ev.k==='doorbehind'){if(S.set.subs)subtitle('[the door you closed just opened]');G.fx.shake+=0.15;return;}
  if(ev.k==='blind'){P.blind=8;P.slow=8;toast('🫧 Spores! You can\'t see!');Aud.creature('drifter',P.pos,2);}else if(ev.k==='drain'){P.batt=0;toast('🔦 It ate your light.');G.fx.flicker=1;}else if(ev.k==='scare'){Aud.sting('scare');G.fx.shake+=2.5;G.fx.glitch=1.2;}else if(ev.k==='ach'){ach(ev.id);}else if(ev.k==='flicker'){G.fx.flicker=ev.t||6;}else if(ev.k==='grabbed'){P.grabbedT=G.t+(ev.t||2.5);toast('🪢 IT HAS YOU — someone throw something at it!');Aud.sting('scare');G.fx.shake+=2;}else if(ev.k==='released'){P.grabbedT=0;toast('🪢 It let go.');}else if(ev.k==='bitten'){dropHands(true);P.kick=1;G.fx.shake+=1.5;toast('🧰 IT BIT YOU — that is not a strongbox!');}else if(ev.k==='swarmed'){P.blind=Math.max(P.blind,1.3);P.batt=Math.max(0,P.batt-0.05);if(!P.swarmToast||G.t-P.swarmToast>6){P.swarmToast=G.t;toast('🪰 They are in your eyes — flashlight OFF (F) and walk away!');}}else if(ev.k==='toast'){toast(ev.s,'big');}else if(ev.k==='radiolure'){Aud.radioStatic(2,0.3);setTimeout(()=>{Aud.radioClick();if(VOICE.clips&&VOICE.clips.length)echoPlayClip(null,true,0.9);else Aud.play('vo_radio_1',null,0.9,{noVar:true,lp:2800,dest:Aud.voiceBus});subtitle('[a teammate on the radio, calling you the wrong way]');},900);$('radio').classList.add('rx');setTimeout(()=>$('radio').classList.remove('rx'),4000);}else if(ev.k==='tripped'){dropHands(true);P.slow=5;P.kick=1;P.landT=0.3;G.fx.shake+=2;toast('🕳 THE FLOOR HAS YOUR LEG — stop sprinting!');Aud.sting('scare');}}
function creatureAttackNoted(c){G.director.calmUntil=G.t+40+Math.random()*50;G.mission.stats.encounters++;const t=G.t;G.mission.lastMajor=t;if(!G.mission.metKinds[c.kind]){G.mission.metKinds[c.kind]=true;S.stats.encounters[c.kind]=(S.stats.encounters[c.kind]||0)+1;}}
function updateCreaturesHost(dt){if(G.mission&&G.mission.zero)sigTick(dt);const calm=G.t<G.director.calmUntil;const agg=(G.mission.diff.creat||1)*(1+G.director.aggro*0.5)*(G.mission.weekly==='angry'?1.5:1)*(G.stage>=3?1.25:1);const hearMul=(calm?0.5:1)*agg;
  /* process noises */const fresh=NOISES.filter(n=>G.t-n.t<0.5&&!n.done);for(const n of fresh){n.done=true;for(const c of G.creatures){const cfg=CR_CFG[c.kind];if(!cfg.hear)continue;if(c.kind==='crawler'&&c.state==='hidden')continue;const same=n.k===c.k;const d=same?dist2(c.pos.x,c.pos.z,n.x,n.z):Math.hypot(n.x-c.pos.x,n.z-c.pos.z,(n.y-c.pos.y)*2);const range=n.loud*cfg.hear*hearMul*(same?1:0.35);if(d<range){c.lastHeard={x:n.x,z:n.z,k:n.k,t:G.t,loud:n.loud,pid:n.pid,kind:n.kind};c.alert=Math.min(1,c.alert+n.loud);}}}
  while(NOISES.length>60)NOISES.shift();
  for(const c of G.creatures.slice()){c.timer-=dt;c.cool-=dt;const cfg=CR_CFG[c.kind];const spd=cfg.speed*(calm?0.85:1),hunt=cfg.hunt*(calm?0.85:1)*(G.stage>=6?1.15:1);
    switch(c.kind){
    case 'echo':{
      if(c.state==='wander'){if(!c.wp||moveTo(c,c.wp.x,c.wp.z,c.wp.k,spd,dt)){c.wp=randomWalkCell(G.map,Math.random()<0.7?c.k:ri(Math.random,0,G.map.L-1));}c.anim='walk';
        if(c.lastHeard&&G.t-c.lastHeard.t<1&&c.lastHeard.loud>0.2){c.state='listen';c.timer=2.2;c.anim='listen';}}
      else if(c.state==='listen'){c.anim='listen';if(c.timer<=0){c.state='stalk';c.anim='walk';}}
      else if(c.state==='stalk'){const h=c.lastHeard;const ob=observed(c,22);if(ob){c.anim='idle';c.frozenT=(c.frozenT||0)+dt;if(c.frozenT>0.6&&!G.mission.angelHint&&ob.local){G.mission.angelHint=true;hostEvent(ob.id,{k:'toast',s:'👁 It stopped when you looked. It will not stay stopped when you look away.'});}if(Math.random()<dt*0.4){if(MP.on)bcast({t:'ev',k:'sfx',kind:'echo',p:[c.pos.x,c.pos.y+1,c.pos.z]});Aud.creature('echo',c.pos,0.5);}}else{c.frozenT=0;if(!h||moveTo(c,h.x,h.z,h.k,spd*2.6,dt)){c.state='wander';c.wp=null;}c.anim='walk';}}
      else if(c.state==='hunt'){const pl=allPlayers().find(p=>p.id===c.target);if(!pl||pl.dead||pl.inVan||(pl.k!==c.k&&!c.path)){c.state='wander';c.target=null;break;}moveTo(c,pl.pos.x,pl.pos.z,pl.k,hunt,dt);c.anim='walk';if(canSee(c,pl,30))c.lastSeen=G.t;else if(G.t-c.lastSeen>8){c.state='wander';c.target=null;}
        const d=c.pos.distanceTo(pl.pos);if(d<reach('echo')&&c.cool<=0){c.state='attack';c.timer=0.45;c.anim='lunge';c.victim=pl.id;}}
      else if(c.state==='attack'){c.anim='lunge';if(c.timer<=0){const pl=allPlayers().find(p=>p.id===c.victim);if(pl&&pl.pos.distanceTo(c.pos)<reach('echo')+0.6&&pl.k===c.k){hostDamage(pl.id,55,'echo');creatureAttackNoted(c);}c.state='retreat';c.timer=5;c.cool=5;c.wp=randomWalkCell(G.map,c.k);}}
      else if(c.state==='retreat'){c.anim='walk';if(!c.wp||moveTo(c,c.wp.x,c.wp.z,c.wp.k,spd*2.2,dt))c.wp=randomWalkCell(G.map,c.k);if(c.timer<=0)c.state='wander';}
      if(c.state!=='attack'&&c.state!=='retreat'){const seen=alivePlayers().filter(p=>p.loud>0.3&&canSee(c,p));const tp=pickTarget(c,seen);if(tp){c.state='hunt';c.target=tp.id;c.lastSeen=G.t;G.mission.echoHunted=true;}}
      c.mimicT-=dt;if(c.mimicT<=0){c.mimicT=25+Math.random()*25;const np=nearestPlayer(c);if(np&&np.d<28){const radio=Math.random()<0.3;if(MP.on)bcast({t:'ev',k:'mimic',p:[c.pos.x,c.pos.y,c.pos.z],l:c.k,radio});echoPlayClip(c.pos.clone(),radio,1);}}
      break;}
    case 'crawler':{
      if(c.state==='hidden'){c.visible=false;if(c.timer<=0){c.timer=(MP.on&&Object.keys(MP.players).length>1?15:24)+Math.random()*20;
          const cands=alivePlayers().filter(p=>!p.downed);const iso=cands.filter(p=>!cands.some(q=>q.id!==p.id&&q.k===p.k&&q.pos.distanceTo(p.pos)<12));const pool=iso.length?iso:(Math.random()<0.25?cands:[]);if(!pool.length)break;const tp=pick(pool);
          let vent=null,vd=1e9;for(const v of G.map.vents){if(v.k!==tp.k)continue;const d=dist2(v.x,v.z,tp.pos.x,tp.pos.z);if(d>4&&d<vd&&d<28){vd=d;vent=v;}}if(!vent)break;
          c.pos.set(vent.x,layerY(vent.k)+WALL_H-0.6,vent.z);c.k=vent.k;c.ceiling=true;c.visible=true;c.state='stalk';c.target=tp.id;c.timer=30;c.anim='crawl';if(MP.on)bcast({t:'ev',k:'sfx',kind:'crawler',p:[c.pos.x,c.pos.y,c.pos.z]});Aud.creature('crawler',c.pos,1);}
        else if(Math.random()<dt*0.06){const np=nearestPlayer(c)||{p:allPlayers()[0]};if(np&&np.p){const v=pick(G.map.vents.filter(v=>v.k===np.p.k)||[]);if(v){const p=new THREE.Vector3(v.x,layerY(v.k)+3,v.z);if(MP.on)bcast({t:'ev',k:'sfx',kind:'scratch',p:[p.x,p.y,p.z]});Aud.creature('scratch',p,0.8);}}}}
      else if(c.state==='stalk'){const pl=allPlayers().find(p=>p.id===c.target);const grouped=pl&&allPlayers().some(q=>q.id!==pl.id&&!q.dead&&q.k===pl.k&&q.pos.distanceTo(pl.pos)<8);
        if(!pl||pl.dead||pl.inVan||grouped||c.timer<=0||pl.k!==c.k){c.state='retreat';c.timer=20;break;}
        moveTo(c,pl.pos.x,pl.pos.z,pl.k,hunt,dt);c.pos.y=layerY(c.k)+WALL_H-0.6;c.anim='crawl';
        if(Math.random()<dt*0.5){if(MP.on)bcast({t:'ev',k:'sfx',kind:'scratch',p:[c.pos.x,c.pos.y,c.pos.z]});Aud.creature('scratch',c.pos,0.6);}
        if(c.pos.distanceTo(pl.pos)<reach('crawler')+1.2){c.state='pounce';c.timer=0.55;c.ceiling=false;c.anim='pounce';c.victim=pl.id;if(MP.on)bcast({t:'ev',k:'sfx',kind:'crawler',p:[c.pos.x,c.pos.y,c.pos.z]});Aud.creature('crawler',c.pos,1.5);}}
      else if(c.state==='pounce'){c.pos.y=lerp(c.pos.y,groundY(G.map,c.k,c.pos.x,c.pos.z),dt*8);const pl=allPlayers().find(p=>p.id===c.victim);if(pl)stepToward(c,pl.pos.x,pl.pos.z,7,dt);if(c.timer<=0){if(pl&&pl.k===c.k&&pl.pos.distanceTo(c.pos)<reach('crawler')+0.6){hostDamage(pl.id,45,'crawler');creatureAttackNoted(c);}c.state='retreat';c.timer=20;}}
      else if(c.state==='retreat'){c.anim='crawl';c.ceiling=false;if(!c.wp){let best=null,bd=1e9;for(const v of G.map.vents){if(v.k!==c.k)continue;const d=dist2(v.x,v.z,c.pos.x,c.pos.z);if(d>6&&d<bd){bd=d;best=v;}}c.wp=best||pick(G.map.vents.filter(v=>v.k===c.k))||{x:c.pos.x,z:c.pos.z,k:c.k};}
        if(moveTo(c,c.wp.x,c.wp.z,c.wp.k,hunt*1.3,dt)||c.timer<=0){c.state='hidden';c.visible=false;c.wp=null;c.timer=18+Math.random()*20;}}
      break;}
    case 'lighteater':{
      let best=null,bs=0;for(const p of alivePlayers()){if(p.k!==c.k)continue;const d=c.pos.distanceTo(p.pos);const w=p.flash?(3+S.up.flash*0.3)/Math.max(1,d):(d<2.4?2:0);if(w>bs&&(p.flash?losClear(G.map,c.k,c.pos.x,c.pos.z,p.pos.x,p.pos.z):true)){bs=w;best={p,d,kind:'player'};}}
      for(const l of G.lights){if(l.k!==c.k||!l.on)continue;const d=dist2(l.x,l.z,c.pos.x,c.pos.z);if(d>30)continue;const w=0.9/Math.max(1,d);if(w>bs){bs=w;best={l,d,kind:'lamp'};}}
      for(const f of G.flareObjs){if(f.k!==c.k)continue;const d=dist2(f.p.x,f.p.z,c.pos.x,c.pos.z);const w=4/Math.max(1,d);if(w>bs){bs=w;best={f,d,kind:'flare'};}}
      if(c.state==='eat'){c.anim='eat';if(c.timer<=0){c.state='wander';c.cool=3;}break;}
      if(best&&c.cool<=0){c.anim='move';if(best.kind==='player'){moveTo(c,best.p.pos.x,best.p.pos.z,c.k,best.d<8?hunt:spd,dt);if(best.d<reach('lighteater')){c.state='eat';c.timer=1.6;hostDamage(best.p.id,35,'lighteater');hostEvent(best.p.id,{k:'drain'});creatureAttackNoted(c);if(MP.on)bcast({t:'ev',k:'sfx',kind:'lighteater',p:[c.pos.x,c.pos.y,c.pos.z]});Aud.creature('lighteater',c.pos,1.5);}}
        else if(best.kind==='lamp'){moveTo(c,best.l.x,best.l.z,c.k,spd,dt);if(best.d<1.8){c.state='eat';c.timer=1.6;best.l.on=false;best.l.eaten=true;if(MP.on)bcast({t:'ev',k:'lamp',id:best.l.id,on:false});Aud.creature('lighteater',c.pos,1);}}
        else{moveTo(c,best.f.p.x,best.f.p.z,c.k,hunt,dt);if(best.d<1.4){c.state='eat';c.timer=1.2;removeObj(best.f);G.flareObjs=G.flareObjs.filter(x=>x!==best.f);if(MP.on)bcast({t:'ev',k:'rmobj',id:best.f.id});}}}
      else{c.anim='idle';if(!c.wp||moveTo(c,c.wp.x,c.wp.z,c.wp.k,spd*0.5,dt))c.wp=randomWalkCell(G.map,c.k);}
      c.pos.y=lerp(c.pos.y,groundY(G.map,c.k,c.pos.x,c.pos.z)+1.0+Math.sin(G.t*1.3)*0.15,dt*3);
      break;}
    case 'window':{
      if(c.state==='idle'){c.visible=false;if(c.timer<=0){const cands=alivePlayers().filter(p=>!p.downed);if(!cands.length){c.timer=10;break;}const tp=pick(cands);const per=c.per[tp.id]||(c.per[tp.id]={count:0});
          const room=roomAt(G.map,tp.k,tp.pos.x,tp.pos.z);let spot=null;
          if(per.count<2){const wins=G.map.windows.filter(w=>w.k===tp.k&&roomAt(G.map,tp.k,w.x-w.nx*0.5,w.z-w.nz*0.5)===room);if(wins.length){const w=pick(wins);spot={x:w.x+w.nx*0.55,z:w.z+w.nz*0.55,face:tp.pos,win:true};}}
          if(!spot&&per.count<4){for(let i=0;i<30&&!spot;i++){const rp=randomWalkCell(G.map,tp.k);const d=dist2(rp.x,rp.z,tp.pos.x,tp.pos.z);if(d>5&&d<11&&losClear(G.map,tp.k,rp.x,rp.z,tp.pos.x,tp.pos.z))spot={x:rp.x,z:rp.z,face:tp.pos};}}
          if(!spot||per.count>=4){/* behind the player, close */const a=Math.random()*TAU;const x=tp.pos.x+Math.sin(a)*2.6,z=tp.pos.z+Math.cos(a)*2.6;if(cellAt(G.map,tp.k,x,z)!==T_VOID)spot={x,z,face:tp.pos,close:true};}
          if(!spot){c.timer=8;break;}
          c.pos.set(spot.x,groundY(G.map,tp.k,spot.x,spot.z),spot.z);c.k=tp.k;c.yaw=Math.atan2(tp.pos.x-spot.x,tp.pos.z-spot.z);c.visible=true;c.state='present';c.target=tp.id;c.lookT=0;c.timer=spot.close?14:22;c.close=!!spot.close;c.anim=spot.close?'reach':'idle';
          if(MP.on)bcast({t:'ev',k:'sfx',kind:'window',p:[c.pos.x,c.pos.y+1.5,c.pos.z]});Aud.creature('window',c.pos,1);}}
      else if(c.state==='present'){const pl=allPlayers().find(p=>p.id===c.target);const per=c.per[c.target]||(c.per[c.target]={count:0});
        if(!pl||pl.dead||pl.k!==c.k||pl.inVan){c.state='idle';c.visible=false;c.timer=30;break;}
        if(pl.lookW)c.lookT+=dt;
        const need=c.close?0.9:1.5;
        if(c.lookT>need){c.visible=false;c.state='idle';if(c.close){hostDamage(pl.id,100,'window');hostEvent(pl.id,{k:'scare'});creatureAttackNoted(c);per.count=0;c.timer=60;}else{per.count++;c.timer=18+Math.random()*25;if(MP.on)bcast({t:'ev',k:'sfx',kind:'window',p:[c.pos.x,c.pos.y+1.5,c.pos.z]});}}
        else if(c.timer<=0){c.visible=false;c.state='idle';if(c.close){hostEvent(pl.id,{k:'ach',id:'window'});per.count=0;c.timer=70;}else{per.count=Math.max(0,per.count-1);c.timer=30+Math.random()*30;}}}
      break;}
    case 'hound':{
      /* light in its eyes: a beam held on it for ~0.8 s makes it cower and run */
      {let lit=false;if(c.state==='chase'||c.state==='recoil'||c.state==='circle'||c.state==='fetch'){for(const p of alivePlayers()){if(beamOnCreature(c,p,9)){lit=true;break;}}}
        c.lit=lit?(c.lit||0)+dt:Math.max(0,(c.lit||0)-dt*2);c.cowerCd=Math.max(0,(c.cowerCd||0)-dt);
        if(lit&&c.lit>0.8&&c.cowerCd<=0&&c.state!=='cower'){c.state='cower';c.timer=2.4;c.cowerCd=9;c.lit=0;c.cool=Math.max(c.cool,1.5);const lp=alivePlayers().find(p=>beamOnCreature(c,p,9));c.fleeFrom=lp?lp.pos.clone():c.pos.clone();
          if(MP.on)bcast({t:'ev',k:'sfx',kind:'hound',p:[c.pos.x,c.pos.y,c.pos.z]});Aud.creature('hound',c.pos,0.7);
          if(lp&&!G.mission.houndLightHint){G.mission.houndLightHint=true;hostEvent(lp.id,{k:'toast',s:'🔦 It can\'t stand the light. Hold the beam on it and it runs.'});}}}
      if(c.state==='wander'){c.anim='idle';if(!c.wp||moveTo(c,c.wp.x,c.wp.z,c.wp.k,spd,dt)){c.wp=randomWalkCell(G.map,Math.random()<0.75?c.k:ri(Math.random,0,G.map.L-1));}if(Math.hypot(c.pos.x-(c.prevX||c.pos.x),c.pos.z-(c.prevZ||c.pos.z))>0.01)c.anim='run';
        if(c.lastHeard&&G.t-c.lastHeard.t<1&&c.lastHeard.loud>0.15){c.state='investigate';}}
      else if(c.state==='investigate'){c.anim='run';const h=c.lastHeard;if(!h||moveTo(c,h.x,h.z,h.k,hunt*0.9,dt)||G.t-h.t>15){c.state='sniff';c.timer=3;}}
      else if(c.state==='sniff'){c.anim='idle';if(c.timer<=0)c.state='wander';if(c.lastHeard&&G.t-c.lastHeard.t<1&&c.lastHeard.loud>0.15)c.state='investigate';}
      else if(c.state==='cower'){c.anim='run';const f=c.fleeFrom||c.pos;const dx=c.pos.x-f.x,dz=c.pos.z-f.z;const dl=Math.hypot(dx,dz)||1;moveTo(c,c.pos.x+dx/dl*4,c.pos.z+dz/dl*4,c.k,5.2,dt);if(c.timer<=0){c.state='sniff';c.timer=2.5;}}
      else if(c.state==='fetch'){c.anim='run';const o=c.fetchObj;if(!o||o.held!==null||o.k!==c.k||moveTo(c,o.p.x,o.p.z,o.k,hunt,dt)||c.timer<=0){c.state='sniff';c.timer=2;c.fetchObj=null;if(o&&o.frag&&!o.broken&&c.timer<=2&&dist2(o.p.x,o.p.z,c.pos.x,c.pos.z)<1.5){breakObjHost(o);}}}
      else if(c.state==='recoil'){/* after a bite it backs off: this is the player's window */c.anim='run';const pl=allPlayers().find(p=>p.id===c.target);const f=pl?pl.pos:c.pos;const dx=c.pos.x-f.x,dz=c.pos.z-f.z;const dl=Math.hypot(dx,dz)||1;moveTo(c,c.pos.x+dx/dl*3.5,c.pos.z+dz/dl*3.5,c.k,5.0,dt);
        if(c.timer<=0){c.state='circle';c.timer=1.1+Math.random()*0.5;if(MP.on)bcast({t:'ev',k:'sfx',kind:'hound_growl',p:[c.pos.x,c.pos.y,c.pos.z]});Aud.creature('hound_growl',c.pos,1);}}
      else if(c.state==='circle'){c.anim='idle';const pl=allPlayers().find(p=>p.id===c.target);if(pl){const ty=Math.atan2(pl.pos.x-c.pos.x,pl.pos.z-c.pos.z);let dy=((ty-c.yaw+Math.PI*3)%(Math.PI*2))-Math.PI;c.yaw+=dy*Math.min(1,dt*6);}if(c.timer<=0){c.state='chase';c.lastSeen=G.t;}}
      else if(c.state==='chase'){const pl=allPlayers().find(p=>p.id===c.target);if(!pl||pl.dead||pl.inVan){c.state='wander';break;}c.anim='run';moveTo(c,pl.pos.x,pl.pos.z,pl.k,hunt,dt);const d=c.pos.distanceTo(pl.pos);
        const hidden=pl.crouch&&pl.speed<0.3&&!pl.flash&&d>2.5&&!roomLit(pl.k,pl.pos.x,pl.pos.z);c.hideT=hidden?(c.hideT||0)+dt:0;if(c.hideT>2.2||(!canSee(c,pl,40)&&G.t-c.lastSeen>4.5)){c.state='sniff';c.timer=3;c.target=null;break;}if(canSee(c,pl,40))c.lastSeen=G.t;
        /* anything thrown near it is more interesting than you */{let fo=null;for(const o of G.objs){if(o.k!==c.k||o.held!==null||o.carrier)continue;if(o.v.length()>3.5&&o.thrownAt&&G.t-o.thrownAt<3&&dist2(o.p.x,o.p.z,c.pos.x,c.pos.z)<7){fo=o;break;}}if(fo){c.state='fetch';c.fetchObj=fo;c.timer=4;c.target=null;if(MP.on)bcast({t:'ev',k:'sfx',kind:'hound_bark',p:[c.pos.x,c.pos.y,c.pos.z]});Aud.creature('hound_bark',c.pos,1);break;}}
        if(c.lastHeard&&c.lastHeard.kind==='impact'&&G.t-c.lastHeard.t<0.5&&c.lastHeard.loud>0.5&&Math.random()<0.5){c.state='investigate';c.target=null;break;}
        if(d<reach('hound')&&pl.k===c.k&&c.cool<=0){c.cool=3;c.anim='bite';c.rig.play('bite',0.1,true);hostDamage(pl.id,16,'hound');creatureAttackNoted(c);if(MP.on)bcast({t:'ev',k:'sfx',kind:'hound',p:[c.pos.x,c.pos.y,c.pos.z]});Aud.creature('hound',c.pos,1.2);c.state='recoil';c.timer=1.4;
          if(!G.mission.houndBiteHint){G.mission.houndBiteHint=true;hostEvent(pl.id,{k:'toast',s:'🐕 It bites and backs off. That pause is your window: run, throw something, or put your light in its eyes.'});}}}
      if(c.state!=='chase'&&c.state!=='recoil'&&c.state!=='circle'&&c.state!=='cower'&&c.state!=='fetch'){const seen=alivePlayers().filter(p=>canSee(c,p));const tp=pickTarget(c,seen);if(tp){c.state='chase';c.target=tp.id;c.lastSeen=G.t;if(MP.on)bcast({t:'ev',k:'sfx',kind:'hound_bark',p:[c.pos.x,c.pos.y,c.pos.z]});Aud.creature('hound_bark',c.pos,1.4);}}
      c.prevX=c.pos.x;c.prevZ=c.pos.z;break;}
    case 'stack':{
      if(c.state==='hidden'){c.anim='idle';}
      else if(c.state==='reveal'){c.anim='reveal';if(c.timer<=0){const pl=allPlayers().find(p=>p.id===c.target);if(pl&&pl.k===c.k&&pl.pos.distanceTo(c.pos)<3){hostDamage(pl.id,40,'stack');}c.state='hunt';c.timer=25;creatureAttackNoted(c);}}
      else if(c.state==='hunt'){c.anim='run';const pl=allPlayers().find(p=>p.id===c.target);if(!pl||pl.dead||pl.inVan||c.timer<=0){c.state='flee';c.timer=12;c.wp=randomWalkCell(G.map,c.k);break;}moveTo(c,pl.pos.x,pl.pos.z,pl.k,hunt,dt);if(c.pos.distanceTo(pl.pos)<reach('stack')&&pl.k===c.k&&c.cool<=0){c.cool=1.5;hostDamage(pl.id,20,'stack');Aud.creature('stack',c.pos,1);if(MP.on)bcast({t:'ev',k:'sfx',kind:'stack',p:[c.pos.x,c.pos.y,c.pos.z]});}}
      else if(c.state==='flee'){c.anim='run';if(!c.wp||moveTo(c,c.wp.x,c.wp.z,c.wp.k,hunt*1.3,dt))c.wp=randomWalkCell(G.map,c.k);if(c.timer<=0){removeCreature(c);continue;}}
      break;}
    case 'drifter':{
      if(Math.random()<dt*0.4)c.dir+=(Math.random()-0.5)*1.5;const nx=c.pos.x+Math.sin(c.dir)*spd*dt,nz=c.pos.z+Math.cos(c.dir)*spd*dt;const p2={x:nx,z:nz};const hit=collideCircle(G.map,c.k,p2,0.5,c.pos.y,1,{noDoors:true});if(hit)c.dir+=Math.PI*0.7;c.pos.x=p2.x;c.pos.z=p2.z;c.pos.y=groundY(G.map,c.k,c.pos.x,c.pos.z)+1.4+Math.sin(G.t*0.9+c.dir)*0.2;
      for(const p of alivePlayers()){if(p.k===c.k&&c.cool<=0&&p.pos.distanceTo(c.pos)<CR_CFG.drifter.r+0.5){c.cool=10;hostEvent(p.id,{k:'blind'});}}
      for(const o of G.objs){if(o.k!==c.k||o.held!==null)continue;if(o.v.length()>4&&o.p.distanceTo(c.pos)<CR_CFG.drifter.r+o.r+0.2){removeCreature(c);if(MP.on)bcast({t:'ev',k:'sfx',kind:'drifter',p:[c.pos.x,c.pos.y,c.pos.z]});Aud.creature('drifter',c.pos,3);Aud.shatter(c.pos);break;}}
      break;}
    case 'mourner':{
      if(c.state==='kneel'){c.anim='idle';const np=nearestPlayer(c);if(np&&np.p.k===c.k&&np.d<CR_CFG.mourner.r+2.7){c.state='rise';c.timer=1.2;c.anim='rise';if(MP.on)bcast({t:'ev',k:'sfx',kind:'sob',p:[c.pos.x,c.pos.y+1.5,c.pos.z]});Aud.creature('sob',c.pos,1.5);}}
      else if(c.state==='rise'){c.anim='rise';if(c.timer<=0){c.state='scream';c.timer=2.4;c.anim='scream';const sp={x:c.pos.x,y:c.pos.y+1.6,z:c.pos.z};for(let i=0;i<3;i++)NOISES.push({x:sp.x,y:sp.y,z:sp.z,k:c.k,loud:1,kind:'scream',t:G.t+i*0.3,pid:-1});for(const o of G.creatures){if(o!==c&&CR_CFG[o.kind].hear){o.lastHeard={x:c.pos.x,z:c.pos.z,k:c.k,t:G.t,loud:1,pid:-1,kind:'scream'};o.alert=1;if(o.kind==='sleeper')o.awake=Math.min(1,(o.awake||0)+0.6);}}G.director.aggro+=0.6;
          for(const p of alivePlayers()){if(p.k===c.k&&p.pos.distanceTo(c.pos)<7){hostDamage(p.id,12,'mourner');hostEvent(p.id,{k:'scare'});}}if(MP.on)bcast({t:'ev',k:'sfx',kind:'mourner_scream',p:[sp.x,sp.y,sp.z]});Aud.creature('mourner_scream',c.pos,1);creatureAttackNoted(c);}}
      else if(c.state==='scream'){c.anim='scream';if(c.timer<=0){removeCreature(c);continue;}}
      break;}
    case 'mimic':{
      if(c.state==='hidden'){c.anim='idle';const n=nearestPlayer(c,p=>p.k===c.k&&!p.downed);if(n&&n.d<1.7){c.lurkT+=dt;if(c.lurkT>1.1)mimicTrigger(c,n.p.id);}else c.lurkT=0;}
      else if(c.state==='reveal'){c.anim='reveal';if(c.timer<=0){c.state='chase';c.timer=8;}}
      else if(c.state==='chase'){c.anim=c.biteT>0?'bite':'run';c.biteT=(c.biteT||0)-dt;const n=nearestPlayer(c,p=>p.k===c.k&&!p.downed);
        if(!n||c.timer<=0||n.d>18){c.state='flee';c.timer=14;c.dest=randomWalkCell(G.map,c.k);}
        else{moveTo(c,n.p.pos.x,n.p.pos.z,n.p.k,CR_CFG.mimic.hunt*agg,dt);if(n.d<reach('mimic')&&c.cool<=0){c.cool=1.4;c.biteT=0.5;hostDamage(n.p.id,14,'mimic');hostEvent(n.p.id,{k:'bitten'});crSfx(c,'mimic_snap',1);creatureAttackNoted(c);}}
        for(const o of G.objs){if(o.k===c.k&&o.held===null&&o.v.length()>4&&dist2(o.p.x,o.p.z,c.pos.x,c.pos.z)<1.8){c.state='flee';c.timer=14;c.dest=randomWalkCell(G.map,c.k);crSfx(c,'mimic',1);break;}}}
      else if(c.state==='flee'){c.anim='run';if(!c.dest||moveTo(c,c.dest.x,c.dest.z,c.k,CR_CFG.mimic.speed,dt)||c.timer<=0){c.state='hidden';c.anim='idle';c.lurkT=0;c.cool=3;}}
      break;}
    case 'swarm':{
      c.pos.y=layerY(c.k)+1.4;c.anim=c.state==='hunt'?'attack':'idle';
      let fl=null,fd=400;for(const f of G.flareObjs){if(f.k!==c.k)continue;const d=dist2(f.p.x,f.p.z,c.pos.x,c.pos.z);if(d<fd){fd=d;fl=f;}}
      const lit=nearestPlayer(c,p=>p.k===c.k&&p.flash&&!p.downed);
      if(fl){c.state='feed';moveTo(c,fl.p.x,fl.p.z,c.k,CR_CFG.swarm.hunt,dt);}
      else if(lit&&lit.d<CR_CFG.swarm.sight&&losClear(G.map,c.k,c.pos.x,c.pos.z,lit.p.pos.x,lit.p.pos.z)){c.state='hunt';c.target=lit.p.id;c.lostT=0;moveTo(c,lit.p.pos.x,lit.p.pos.z,lit.p.k,CR_CFG.swarm.hunt*agg,dt);
        if(dist2(lit.p.pos.x,lit.p.pos.z,c.pos.x,c.pos.z)<2.6&&c.cool<=0){c.cool=0.45;hostEvent(lit.p.id,{k:'swarmed'});if(!c.noted){c.noted=true;creatureAttackNoted(c);}}}
      else if(c.state==='hunt'&&c.target!=null){c.lostT=(c.lostT||0)+dt;const t=allPlayers().find(p=>p.id===c.target);if(t&&c.lostT<3&&t.k===c.k&&!t.dead)moveTo(c,t.pos.x,t.pos.z,t.k,CR_CFG.swarm.speed,dt);else{c.state='wander';c.target=null;}}
      else{c.state='wander';if(!c.dest||moveTo(c,c.dest.x,c.dest.z,c.k,CR_CFG.swarm.speed*0.6,dt))c.dest=randomWalkCell(G.map,c.k);}
      break;}
    case 'burrower':{
      c.rumbleT-=dt;
      if(c.state==='lurk'){c.anim='idle';c.visible=true;c.pos.y=layerY(c.k);
        let best=null,bd=1e9;const rr=CR_CFG.burrower.hear*hearMul;for(const p of alivePlayers()){if(p.k!==c.k||p.downed||p.crouch||(p.speed||0)<2.2)continue;const d=dist2(p.pos.x,p.pos.z,c.pos.x,c.pos.z);if(d<bd&&d<rr*rr){bd=d;best=p;}}
        if(best){c.tx=best.pos.x;c.tz=best.pos.z;c.tid=best.id;c.trackT=2.5;}
        if(c.trackT>0){c.trackT-=dt;const dx=c.tx-c.pos.x,dz=c.tz-c.pos.z,d=Math.hypot(dx,dz);
          if(d>0.3){const s=Math.min(d,CR_CFG.burrower.speed*agg*dt);const nx=c.pos.x+dx/d*s,nz=c.pos.z+dz/d*s;if(walkable(G.map,c.k,Math.floor(nx/CELL),Math.floor(nz/CELL))){c.pos.x=nx;c.pos.z=nz;}else c.trackT=0;c.yaw=Math.atan2(dx,dz);if(c.rumbleT<=0){c.rumbleT=2.2;crSfx(c,'burrower_rumble',0.8);}}
          const v=allPlayers().find(p=>p.id===c.tid);if(v&&v.k===c.k&&!v.downed&&!v.dead&&dist2(v.pos.x,v.pos.z,c.pos.x,c.pos.z)<1.7&&c.cool<=0){c.state='surface';c.timer=0.55;c.anim='surface';c.victim=v.id;crSfx(c,'burrower_burst',1);}}}
      else if(c.state==='surface'){c.anim='surface';if(c.timer<=0){const v=allPlayers().find(p=>p.id===c.victim);if(v&&v.k===c.k&&!v.dead&&dist2(v.pos.x,v.pos.z,c.pos.x,c.pos.z)<2.8){hostDamage(v.id,30,'burrower');hostEvent(v.id,{k:'tripped'});creatureAttackNoted(c);}c.state='grab';c.timer=1.6;c.anim='grab';}}
      else if(c.state==='grab'){c.anim='grab';if(c.timer<=0){c.state='sink';c.timer=1.0;c.anim='sink';c.cool=14;c.trackT=0;}}
      else if(c.state==='sink'){c.anim='sink';if(c.timer<=0){c.state='lurk';c.anim='idle';}}
      break;}
    case 'twin':{
      const n=nearestPlayer(c,p=>p.k===c.k&&!p.downed);
      if(c.state==='approach'){if(!n){c.anim='idle';break;}
        let stared=false;for(const p of alivePlayers()){if(p.k!==c.k)continue;const dd=p.pos.distanceTo(c.pos);if(dd>14||dd<0.01)continue;let yaw,pitch;if(p.local){yaw=P.yaw;pitch=P.pitch;}else{const a=G.avatars[p.id];if(!a||!a.net)continue;yaw=a.net.yaw;pitch=a.net.pitch||0;}
          const fx=-Math.sin(yaw)*Math.cos(pitch),fz=-Math.cos(yaw)*Math.cos(pitch);const dx=c.pos.x-p.pos.x,dz=c.pos.z-p.pos.z;const dh=Math.hypot(dx,dz)||1;if((dx*fx+dz*fz)/dh>0.94&&losClear(G.map,c.k,c.pos.x,c.pos.z,p.pos.x,p.pos.z)){c.stare+=dt;stared=true;c.starer=p.id;}}
        if(!stared)c.stare=Math.max(0,c.stare-dt*0.5);
        c.waveT-=dt;if(c.waveT<=0){c.waveT=4+Math.random()*4;c.animT=1.5;c.anim='wave';}
        if(c.animT>0)c.animT-=dt;else c.anim=n.d>2.5?'walk':'idle';
        if(n.d>2.5&&!(c.animT>0))moveTo(c,n.p.pos.x,n.p.pos.z,n.p.k,CR_CFG.twin.speed*agg,dt);
        let thrown=false;for(const o of G.objs){if(o.k===c.k&&o.held===null&&o.v.length()>4&&dist2(o.p.x,o.p.z,c.pos.x,c.pos.z)<2.4){thrown=true;break;}}
        if(c.stare>2.6||n.d<2.2||thrown){c.why=c.stare>2.6?'stare':(n.d<2.2?'close':'thrown');c.state='lunge';c.timer=5;c.anim='run';c.target=(c.stare>2.6&&c.starer!=null)?c.starer:n.p.id;crSfx(c,'twin_shriek',1);for(const p of alivePlayers())if(p.k===c.k&&p.pos.distanceTo(c.pos)<12)hostEvent(p.id,{k:'scare'});G.director.aggro+=0.3;}}
      else if(c.state==='lunge'){c.anim='run';const t=allPlayers().find(p=>p.id===c.target&&!p.dead);if(!t||c.timer<=0){c.state='gone';c.timer=0.2;break;}moveTo(c,t.pos.x,t.pos.z,t.k,CR_CFG.twin.hunt*agg,dt);if(t.k===c.k&&t.pos.distanceTo(c.pos)<reach('twin')){hostDamage(t.id,38,'twin');hostEvent(t.id,{k:'scare'});creatureAttackNoted(c);c.state='gone';c.timer=0.2;}}
      else if(c.state==='gone'){if(c.timer<=0){removeCreature(c);continue;}}
      break;}
    case 'hanger':{
      c.pos.y=c.anchorY;
      if(c.state==='hang'){c.anim='idle';if(c.cool<=0){for(const p of alivePlayers()){if(p.k===c.k&&!p.downed&&dist2(p.pos.x,p.pos.z,c.pos.x,c.pos.z)<CR_CFG.hanger.r+0.5){c.state='drop';c.timer=0.45;c.anim='drop';c.victim=p.id;if(MP.on)bcast({t:'ev',k:'sfx',kind:'hanger_drop',p:[c.pos.x,c.pos.y-1,c.pos.z]});Aud.creature('hanger_drop',c.pos,1);break;}}}}
      else if(c.state==='drop'){c.anim='drop';if(c.timer<=0){const pl=allPlayers().find(p=>p.id===c.victim);if(pl&&pl.k===c.k&&dist2(pl.pos.x,pl.pos.z,c.pos.x,c.pos.z)<CR_CFG.hanger.r+1.2){hostDamage(pl.id,45,'hanger');hostEvent(pl.id,{k:'grabbed',t:2.6});c.state='grab';c.timer=2.6;c.anim='grab';creatureAttackNoted(c);}else{c.state='climb';c.timer=2.5;c.anim='idle';}}}
      else if(c.state==='grab'){c.anim='grab';for(const o of G.objs){if(o.k===c.k&&o.held===null&&o.v.length()>4&&dist2(o.p.x,o.p.z,c.pos.x,c.pos.z)<CR_CFG.hanger.r+o.r+0.4){c.timer=0;hostEvent(c.victim,{k:'released'});break;}}if(c.timer<=0){c.state='climb';c.timer=3;c.anim='idle';c.cool=22;}}
      else if(c.state==='climb'){c.anim='idle';if(c.timer<=0)c.state='hang';}
      break;}
    case 'collector':{
      const carried=c.item?G.objById[c.item]:null;if(c.item&&!carried)c.item=null;
      const vanBusy=allPlayers().some(p=>!p.dead&&p.k===0&&dist2(p.pos.x,p.pos.z,G.map.van.x,G.map.van.z)<8);
      if(c.state==='wander'){c.anim='run';if(!c.wp||moveTo(c,c.wp.x,c.wp.z,c.wp.k,spd,dt))c.wp=randomWalkCell(G.map,c.k);
        if(Math.random()<dt*2){let best=null,bd=18;for(const o of G.objs){if(o.kind!=='item'||o.value<=0||o.held!==null||o.holders.length||o.carrier||o.k!==c.k||o.special)continue;if(o.inVan&&vanBusy)continue;const d=dist2(o.p.x,o.p.z,c.pos.x,c.pos.z);if(d<bd){bd=d;best=o;}}if(best){c.state='fetch';c.target=best.id;c.timer=25;}}}
      else if(c.state==='fetch'){const o=G.objById[c.target];if(!o||o.held!==null||o.carrier||c.timer<=0){c.state='wander';break;}c.anim='run';if(moveTo(c,o.p.x,o.p.z,o.k,hunt,dt)||dist2(o.p.x,o.p.z,c.pos.x,c.pos.z)<1.3){c.state='grab';c.timer=0.6;c.anim='grab';c.rig.play('grab',0.1,true);}}
      else if(c.state==='grab'){c.anim='grab';if(c.timer<=0){const o=G.objById[c.target];if(o&&o.held===null&&!o.carrier){o.carrier=c.id;o.sleep=false;o.mesh.visible=true;c.item=o.id;const fromVan=o.inVan;if(fromVan&&MP.on)bcast({t:'toast',s:'🎒 The Collector took '+o.name+' out of the van!'});if(fromVan)toast('🎒 The Collector took '+o.name+' out of the van!');if(MP.on)bcast({t:'ev',k:'sfx',kind:'collector',p:[c.pos.x,c.pos.y+1,c.pos.z]});Aud.creature('collector',c.pos,1);c.state='carry';c.timer=60;}else c.state='wander';}}
      else if(c.state==='carry'){c.anim='run';if(!carried){c.state='wander';break;}if(moveTo(c,c.nest.x,c.nest.z,c.nest.k,hunt*0.9,dt)||c.timer<=0){carried.carrier=null;carried.sleep=false;carried.p.set(c.nest.x+(Math.random()-0.5)*1.5,groundY(G.map,c.k,c.nest.x,c.nest.z)+0.3,c.nest.z+(Math.random()-0.5)*1.5);carried.k=c.k;carried.v.set(0,1,0);c.item=null;c.state='wander';c.cool=4;}}
      else if(c.state==='flee'){c.anim='run';if(!c.wp||moveTo(c,c.wp.x,c.wp.z,c.wp.k,hunt*1.4,dt))c.wp=randomWalkCell(G.map,c.k);if(c.timer<=0)c.state='wander';}
      if(carried&&c.item){carried.p.set(c.pos.x-Math.sin(c.yaw)*0.4,c.pos.y+1.25,c.pos.z-Math.cos(c.yaw)*0.4);carried.k=c.k;carried.yaw=c.yaw;carried.v.set(0,0,0);}
      /* scared by thrown objects and flares */if(c.state!=='flee'){let hit=false;for(const o of G.objs){if(o.k!==c.k||o.carrier)continue;if((o.held===null&&o.v.length()>4&&dist2(o.p.x,o.p.z,c.pos.x,c.pos.z)<CR_CFG.collector.r+o.r+0.4)||(o.special==='flare'&&dist2(o.p.x,o.p.z,c.pos.x,c.pos.z)<4)){hit=true;break;}}if(hit){if(carried){carried.carrier=null;carried.sleep=false;carried.v.set((Math.random()-0.5)*2,2,(Math.random()-0.5)*2);c.item=null;}c.state='flee';c.timer=8;c.wp=null;if(MP.on)bcast({t:'ev',k:'sfx',kind:'collector',p:[c.pos.x,c.pos.y+1,c.pos.z]});Aud.creature('collector',c.pos,1.5);}}
      break;}
    case 'sleeper':{
      if(c.state==='sleep'){c.anim='idle';for(const p of alivePlayers()){if(p.k!==c.k)continue;const d=p.pos.distanceTo(c.pos);if(d<6)c.awake+=dt*0.12*(6-d)/6;if(p.flash&&d<10&&losClear(G.map,c.k,c.pos.x,c.pos.z,p.pos.x,p.pos.z))c.awake+=dt*0.07;}
        if(c.lastHeard&&c.lastHeard.t!==c.lastNoiseT){c.lastNoiseT=c.lastHeard.t;const d=dist2(c.lastHeard.x,c.lastHeard.z,c.pos.x,c.pos.z);c.awake+=c.lastHeard.loud*0.4*clamp(1-d/40,0.1,1);}
        c.awake=Math.max(0,c.awake-dt*0.012);
        if(c.awake>0.35&&Math.random()<dt*0.3){if(MP.on)bcast({t:'ev',k:'sfx',kind:'sleeper_breath',p:[c.pos.x,c.pos.y+1,c.pos.z]});}
        if(c.awake>=1){c.state='wake';c.timer=2.2;c.anim='wake';c.rig.play('wake',0.1,true);if(MP.on)bcast({t:'ev',k:'sfx',kind:'sleeper_roar',p:[c.pos.x,c.pos.y+1.5,c.pos.z]});Aud.creature('sleeper_roar',c.pos,1);G.director.aggro+=0.8;creatureAttackNoted(c);if(MP.on)bcast({t:'toast',s:'😴 THE SLEEPER IS AWAKE'});toast('😴 THE SLEEPER IS AWAKE','big');}}
      else if(c.state==='wake'){c.anim='wake';if(c.timer<=0){c.state='hunt';c.timer=40;}}
      else if(c.state==='hunt'){c.anim='walk';const np=nearestPlayer(c);if(!np||c.timer<=0){c.state='return';break;}moveTo(c,np.p.pos.x,np.p.pos.z,np.p.k,hunt,dt);if(np.d<reach('sleeper')+0.5&&np.p.k===c.k&&c.cool<=0){c.cool=1.6;hostDamage(np.p.id,60,'sleeper');if(MP.on)bcast({t:'ev',k:'sfx',kind:'sleeper_roar',p:[c.pos.x,c.pos.y+1.5,c.pos.z]});Aud.creature('sleeper_roar',c.pos,0.7);}}
      else if(c.state==='return'){c.anim='walk';if(moveTo(c,c.nest.x,c.nest.z,c.nest.k,spd,dt)){c.state='sleep';c.awake=0;c.rig.play('idle',0.5);}}
      break;}
    case 'warden':{
      if(c.state==='smashdoor'){c.anim='smash';if(c.timer<=0){if(c.door){c.door.broken=true;c.door.open=1;c.door.target=1;if(c.door.mesh)c.door.mesh.visible=false;Aud.impact(1,new THREE.Vector3(c.door.x,layerY(c.door.k)+1,c.door.z));if(MP.on)bcast({t:'ev',k:'doorbreak',id:c.door.id});}c.state='hunt';}break;}
      if(c.state==='attack'){c.anim='smash';if(c.timer<=0){const pl=allPlayers().find(p=>p.id===c.victim);if(pl&&pl.k===c.k&&pl.pos.distanceTo(c.pos)<reach('warden')+0.8){hostDamage(pl.id,80,'warden');creatureAttackNoted(c);}c.state='hunt';c.cool=2.5;}break;}
      const np=nearestPlayer(c);const ws=spd*(G.stage>=7?1.35:1);
      if(np){if(np.p.inVan||inVanZone(np.p.pos)){/* wait outside */const vz=G.vanZone;const tx=G.map.van.x,tz=vz.z0-5;if(dist2(c.pos.x,c.pos.z,tx,tz)>1.5)moveTo(c,tx,tz,0,ws,dt);c.anim='idle';}
        else{moveTo(c,np.p.pos.x,np.p.pos.z,np.p.k,ws,dt);c.anim='walk';if(np.d<reach('warden')&&np.p.k===c.k&&c.cool<=0){c.state='attack';c.timer=0.7;c.victim=np.p.id;c.rig.play('smash',0.1,true);}}}
      if(Math.random()<dt*0.15){if(MP.on)bcast({t:'ev',k:'sfx',kind:'warden',p:[c.pos.x,c.pos.y,c.pos.z]});Aud.creature('warden',c.pos,0.8);}
      break;}
    }
    if(c.kind!=='lighteater'&&c.kind!=='drifter'&&!(c.kind==='crawler'&&c.ceiling))c.pos.y=lerp(c.pos.y,groundY(G.map,c.k,c.pos.x,c.pos.z),Math.min(1,dt*10));
  }
}
function stackReveal(c,pid){if(c.state!=='hidden')return;c.state='reveal';c.timer=1.0;c.target=pid;c.rig.play('reveal',0.05,true);Aud.creature('stack',c.pos,1.5);if(MP.on)bcast({t:'ev',k:'stackrev',id:c.id,pid});creatureAttackNoted(c);}
/* visual / audio side of creatures (all peers) */
function updateCreaturesVisual(dt){for(const c of G.creatures){if(!mpHost()&&c.net){c.pos.lerp(c.net.p,Math.min(1,dt*10));const dy=((c.net.yaw-c.yaw+Math.PI*3)%(Math.PI*2))-Math.PI;c.yaw+=dy*Math.min(1,dt*10);c.k=c.net.k;c.visible=c.net.vis;c.ceiling=c.net.ceil;c.state=c.net.st;if(c.net.anim)c.anim=c.net.anim;}
  const r=c.rig;r.root.visible=c.visible;r.root.position.copy(c.pos);r.root.rotation.set(c.ceiling?Math.PI:0,c.yaw,0);
  if(c.kind==='lighteater')r.root.rotation.z=Math.sin(G.t*0.8)*0.08;
  const an=c.anim||'idle';if(an!==c.curAnim){c.curAnim=an;const once=['lunge','pounce','eat','reveal','smash','bite','reach','rise','scream','drop','wake','surface','sink','wave'].indexOf(an)>=0||(an==='grab'&&c.kind==='collector');r.play(an,0.15,once);}
  if(!c.prevP)c.prevP=c.pos.clone();c.spdS=lerp(c.spdS||0,dt>0?Math.min(12,c.pos.distanceTo(c.prevP)/dt):0,Math.min(1,dt*8));
  r.mixer.update(dt);procAnim(c,r,an,dt);
  c.stepD=(c.stepD||0)+c.pos.distanceTo(c.prevP);c.prevP.copy(c.pos);const _sl={warden:1.6,hound:0.9,echo:1.3,stack:0.7,crawler:0.5}[c.kind];if(_sl&&c.visible&&c.stepD>_sl){c.stepD=0;if(c.k===P.k&&c.pos.distanceTo(P.pos)<40)Aud.creatureStep(c.kind,c.pos);}
  /* ambient sound per kind */c.sfxT-=dt;if(c.sfxT<=0&&c.visible&&c.k===P.k){c.sfxT=3+Math.random()*6;const d=c.pos.distanceTo(P.pos);if(d<30){if(c.kind==='echo')Aud.creature('echo',c.pos,0.6);else if(c.kind==='lighteater')Aud.creature('lighteater',c.pos,0.5);else if(c.kind==='hound'&&c.state!=='chase')Aud.creature('hound',c.pos,0.3);else if(c.kind==='drifter')Aud.creature('drifter',c.pos,0.6);else if(c.kind==='crawler'&&c.state==='stalk')Aud.creature('scratch',c.pos,0.5);else if(c.kind==='mourner'&&c.state==='kneel')Aud.creature('sob',c.pos,0.7);else if(c.kind==='hanger')Aud.creature('hanger',c.pos,0.6);else if(c.kind==='collector')Aud.creature('collector',c.pos,0.4);else if(c.kind==='sleeper'&&c.state==='sleep')Aud.creature('sleeper_breath',c.pos,0.8);else if(c.kind==='swarm')Aud.creature('swarm',c.pos,0.6);else if(c.kind==='twin'&&c.state==='approach')Aud.creature('twin',c.pos,0.5);else if(c.kind==='mimic'&&c.state!=='hidden')Aud.creature('mimic',c.pos,0.5);if(S.set.subs&&d<18)subtitle('['+CREATURES[c.kind].n+' nearby]');}}
  /* stack fake prompt shadow */
  /* window look detection (local) */if(c.kind==='window'){if(c.visible&&c.target===P.id){const to=_tmpV.copy(c.pos).sub(G.cam.position);to.y+=1.4;const d=to.length();to.normalize();const fwd=new THREE.Vector3(0,0,-1).applyQuaternion(G.cam.quaternion);const look=fwd.dot(to)>0.9&&losClear(G.map,P.k,P.pos.x,P.pos.z,c.pos.x,c.pos.z);P.lookW=look;if(look&&Math.random()<dt*2)Aud.creature('window',c.pos,0.5);}else P.lookW=false;}
  /* first sighting stat */if(c.visible&&c.k===P.k&&!G.mission.seenKinds[c.kind]){const d=c.pos.distanceTo(P.pos);if(d<16&&losClear(G.map,P.k,P.pos.x,P.pos.z,c.pos.x,c.pos.z)){G.mission.seenKinds[c.kind]=G.t;if(CREATURES[c.kind].major&&!G.mission.firstMajor)G.mission.firstMajor=G.t;if(!S.stats.seenKinds[c.kind]){S.stats.seenKinds[c.kind]=true;save();creatureCard(c.kind);}else if(S.set.subs)subtitle('['+CREATURES[c.kind].n+']');Aud.musicSet(Math.max(Aud.music.target||0,2));if(c.kind==='echo'||c.kind==='warden'||c.kind==='window')ach('heard');}}
}}
function creatureThreat(){/* music level from creature states */let lvl=0;for(const c of G.creatures){if(!c.visible||c.k!==P.k)continue;const d=c.pos.distanceTo(P.pos);if(['hunt','chase','pounce','attack','stalk','wake','scream','drop','grab'].indexOf(c.state)>=0&&(c.target===P.id||c.victim===P.id||d<10))lvl=Math.max(lvl,3);else if(d<12)lvl=Math.max(lvl,2);else if(d<25)lvl=Math.max(lvl,1);}return lvl;}
/* ================= LIGHTS ================= */
function updateGlowPool(){const pool=G.glowPool;if(!pool)return;const c=[];for(const o of G.objs){if(!o.glowOn||o.broken||o.k!==P.k||o.inVan||!o.mesh||!o.mesh.visible)continue;const d=dist2(o.p.x,o.p.z,P.pos.x,P.pos.z);if(d<14)c.push([d,o]);}c.sort((a,b)=>a[0]-b[0]);
  for(let i=0;i<pool.length;i++){const pl=pool[i];const e=c[i];if(!e){pl.intensity=0;continue;}const o=e[1];pl.position.set(o.p.x,o.p.y+o.h*0.5,o.p.z);pl.color.setHex(o.glowC);pl.intensity=o.glowPulse?0.5*(0.55+0.45*Math.sin(G.t*4+o.p.x)):0.5;}}
function updateFloorCulling(){const m=G.map;if(!m||!m.layers)return;const sp=P.dead&&P.spectate&&G.avatars[P.spectate];const vk=sp?sp.k:P.k;for(let k=0;k<m.layers.length;k++){const g=m.layers[k].grp;if(!g)continue;const v=Math.abs(k-vk)<=1;if(g.visible!==v)g.visible=v;}}
function updateLights(dt){updateFloorCulling();if(frame%2===0)updateGlowPool();const pal=G.map.loc.pal;const cands=[];for(const l of G.lights){if(l.k!==P.k)continue;const d=dist2(l.x,l.z,P.pos.x,P.pos.z);if(d<24)cands.push([d,l]);}cands.sort((a,b)=>a[0]-b[0]);
  let off=0;if(G.shadowLamp){const c0=cands[0];if(c0&&c0[1].on&&G.fx.lightsOut<=0&&S.set.gfx>=3&&c0[0]<14){const l=c0[1];G.shadowLamp.position.set(l.x,l.y-0.3,l.z);G.shadowLamp.color.setHex(l.vault?0xff9060:pal.light);G.shadowLamp.intensity=(l.flicker&&Math.sin(G.t*23+l.phase)*Math.sin(G.t*7.3+l.phase)>0.6)?0.2:1.25;off=1;}else G.shadowLamp.intensity=0;}
  const n=G.lightPool.length;for(let i=0;i<n;i++){const pl=G.lightPool[i];const c=cands[i+off];if(!c){pl.intensity=0;continue;}const l=c[1];pl.position.set(l.x,l.y-0.2,l.z);
    if(l.on){let it=1.25;if(l.flicker&&Math.sin(G.t*23+l.phase)*Math.sin(G.t*7.3+l.phase)>0.6)it*=0.15;if(G.fx.lightsOut>0)it=0;pl.color.setHex(l.vault?0xff9060:pal.light);pl.intensity=it;pl.distance=15;if(l.tube){l.tube.emissive.setHex(l.vault?0xff9060:0xfff2d8);l.tube.emissiveIntensity=it>0.5?1:0.1;}}
    else if(l.emerg){pl.color.setHex(0xff2010);pl.intensity=0.7+Math.sin(G.t*2+l.phase)*0.3;pl.distance=11;if(l.tube)l.tube.emissiveIntensity=0;}
    else{pl.intensity=0;if(l.tube)l.tube.emissiveIntensity=0;}}
  for(const l of G.lights){if(l.tube&&!G.lightPool.some(p=>p.intensity>0&&Math.abs(p.position.x-l.x)<0.01&&Math.abs(p.position.z-l.z)<0.01)){l.tube.emissiveIntensity=l.on&&G.fx.lightsOut<=0?0.9:0;}if(l.emesh)l.emesh.visible=!!l.emerg&&!l.on;}
  if(G.fx.lightsOut>0)G.fx.lightsOut-=dt;
  /* remote flashlights already on avatars */
}
/* ================= DIRECTOR / EVENTS / STAGES ================= */
function initDirector(){G.director={aggro:0,calmUntil:0,nextEvent:25+Math.random()*20,seen:{},tension:0,used:{},closed:[],pending:[],decideT:0,lastEventT:0,lastBigT:0,bb:new Blackboard(),tick:0,distantT:20};}
/* the director scores every scare it could run right now (utility AI) on a calm → dread → spike → relief curve */
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
      /* fire when the best scare is good enough; the gap since the last event raises the bar it must clear */const gap=G.t-(D.lastEventT||G.mission.startT||0);const bar=gap<18?9:Math.max(0.12,0.6-(gap-18)*0.005)*(G.mission.sandbox?1.6:1)/(1+G.stage*0.1);
      if(r.a&&r.s>bar){const m=r.a.m;D.used[m.id]=G.t;D.seen[m.id]=(D.seen[m.id]||0)+1;S.seenEvents[m.id]=(S.seenEvents[m.id]||0)+1;D.lastEventT=G.t;if(m.big)D.lastBigT=G.t;runEvent(m.id,false,bb.get('tp'));}}}
  D.distantT-=dt;if(D.distantT<=0){D.distantT=14+Math.random()*25;runEvent('distant',true);}
}
function runEvent(id,quiet,chosen){const data={};const pls=alivePlayers();const tp=chosen||(pls.length?pick(pls):null);
  switch(id){
    case 'lightsout':data.t=20+Math.random()*25;break;
    case 'flicker':data.pid=tp?tp.id:P.id;break;
    case 'ownvoice':data.pid=tp?tp.id:P.id;break;
    case 'objmove':{if(!tp)return;const near=G.objs.filter(o=>o.k===tp.k&&o.held===null&&!o.holders.length&&dist2(o.p.x,o.p.z,tp.pos.x,tp.pos.z)<15);data.ids=near.slice(0,5).map(o=>o.id);data.pid=tp.id;for(const o of near.slice(0,5)){o.sleep=false;o.v.set((Math.random()-0.5)*4,2,(Math.random()-0.5)*4);}break;}
    case 'lowg':data.t=25;G.gravity=6;setTimeout(()=>{G.gravity=G.mission.baseGravity;},25000);break;
    case 'lockdown':if(G.map.gen.on||G.map.exit.locked)return;G.map.exit.locked=true;setDoorHost(G.map.exit,0,true);break;
    case 'goldroom':{const lay=pick(G.map.layers);const room=pick(lay.rooms);data.k=lay.k;data.room=room.id;for(const o of G.objs){if(o.kind==='item'&&o.k===lay.k&&roomAt(G.map,lay.k,o.p.x,o.p.z)===room.id&&!o.broken){o.value=Math.round(o.value*3);}}break;}
    case 'elevator':if(!G.map.elev)return;if(G.stage>=4&&Math.random()<0.6){const k=ri(Math.random,0,G.map.L-1);spawnCreature('hound',G.map.elev.wx+2,G.map.elev.wz,k);}break;
    case 'doorslam':{if(!tp)return;let best=null,bd=1e9;for(const did in G.doors){const d=G.doors[did];if(d.k!==tp.k||d.blast||d.broken||d.open<0.5)continue;const dd=dist2(d.x,d.z,tp.pos.x,tp.pos.z);if(dd<bd&&dd>2){bd=dd;best=d;}}if(!best)return;best.slamming=true;setDoorHost(best,0,true);setTimeout(()=>{best.slamming=false;},800);return;}
    case 'distant':{if(!tp)return;const a=Math.random()*TAU,d=14+Math.random()*16;data.p=[tp.pos.x+Math.sin(a)*d,layerY(tp.k)+1.5,tp.pos.z+Math.cos(a)*d];data.kind=pick(['pipe','scream','scratch','echo','impact','laugh','door']);break;}
    case 'creature':{if(!tp)return;const kind=pick(['hound','drifter','stack','drifter']);const rp=randomWalkCell(G.map,ri(Math.random,0,G.map.L-1));spawnCreature(kind,rp.x,rp.z,rp.k);if(kind==='drifter'){spawnCreature('drifter',rp.x+1,rp.z+1,rp.k);}return;}
    case 'intern':{if(G.mission.intern)return;const rp=pick(pick(G.map.layers).rooms);G.mission.intern={x:rp.cx-1,z:rp.cz+1,k:rp.k};data.p=[rp.cx-1,rp.cz+1];data.k=rp.k;break;}
    case 'radio':case 'alarm':case 'fakeexit':case 'mapglitch':break;
    case 'peripheral':{if(!tp)return;const eco=(G.mission.eco&&G.mission.eco.length)?G.mission.eco:['echo'];const kind=pick(eco.filter(k=>k!=='window'&&k!=='hanger'&&k!=='mimic'))||'echo';let yaw;if(tp.local)yaw=P.yaw;else{const a=G.avatars[tp.id];yaw=a?a.yaw:0;}
      let spot=null;for(let i=0;i<24&&!spot;i++){const side=Math.random()<0.5?-1:1;const ang=yaw+side*(0.95+Math.random()*0.5);const d=8+Math.random()*6;const x=tp.pos.x-Math.sin(ang)*d,z=tp.pos.z-Math.cos(ang)*d;if(cellAt(G.map,tp.k,x,z)===T_VOID)continue;if(!losClear(G.map,tp.k,tp.pos.x,tp.pos.z,x,z))continue;spot={x,z};}
      if(!spot)return;data.kind=kind;data.p=[spot.x,layerY(tp.k),spot.z];data.k=tp.k;data.yaw=Math.atan2(tp.pos.x-spot.x,tp.pos.z-spot.z);data.pid=tp.id;break;}
    case 'doorbehind':{if(!tp)return;const D=G.director;const cds=D.closed.filter(c=>c.pid===tp.id&&G.t-c.t<75&&G.doors[c.id]&&G.doors[c.id].open<0.5&&G.doors[c.id].k===tp.k);let best=null;for(const c of cds){const d=G.doors[c.id];const dist=dist2(d.x,d.z,tp.pos.x,tp.pos.z);if(dist>4&&dist<16&&!lookingAtPoint(tp,d.x,d.z,0.3))best=d;}if(!best)return;best.locked=false;setDoorHost(best,1,false);hostEvent(tp.id,{k:'doorbehind'});return;}
    case 'whisper':{if(!tp)return;hostEvent(tp.id,{k:'whisper',i:1+Math.floor(Math.random()*3)});return;}
    case 'fakeout':{if(!tp)return;const a=Math.random()*TAU,d=2.5+Math.random()*2;data.p=[tp.pos.x+Math.sin(a)*d,layerY(tp.k)+1,tp.pos.z+Math.cos(a)*d];data.pid=tp.id;
      /* the real one: six to ten seconds after everyone relaxes */const D=G.director;D.pending.push({t:G.t+6+Math.random()*4,fn:()=>{const pl=alivePlayers().find(p=>p.id===tp.id);if(!pl||pl.inVan)return;const eco=(G.mission.eco&&G.mission.eco.length)?G.mission.eco.filter(k=>['hound','echo','stack','crawler','collector','sleeper'].indexOf(k)>=0):[];const kind=eco.length?pick(eco):'hound';const b=Math.random()*TAU;const rp=randomWalkCell(G.map,pl.k);spawnCreature(kind,rp.x,rp.z,pl.k,{state:kind==='hound'?'chase':'hunt'});const c=G.creatures[G.creatures.length-1];if(c){c.target=pl.id;c.lastSeen=G.t;c.lastHeard={x:pl.pos.x,z:pl.pos.z,k:pl.k,t:G.t,loud:1};}runEvent('lightsout');}});break;}
  }
  if(MP.on)bcast({t:'ev',k:'event',id,d:data});applyEvent(id,data,quiet);
}
function applyEvent(id,d,quiet){switch(id){
    case 'peripheral':spawnGhost(d.kind,d.p,d.k,d.yaw,d.pid);break;
    case 'fakeout':{const p=new THREE.Vector3(d.p[0],d.p[1],d.p[2]);if(!Aud.play('fake_drop',p,0.9))Aud.impact(0.8,p);if(S.set.subs)subtitle('[something fell]');if(d.pid===P.id)G.fx.shake+=0.25;break;}
  case 'lightsout':G.fx.lightsOut=d.t;toast('💡 The lights just went out.');Aud.tone(200,0.6,'sawtooth',0.1,null,{slide:60,lp:600});Aud.musicSet(Math.max(Aud.music.target||0,1));break;
  case 'flicker':if(d.pid===P.id){G.fx.flicker=7;toast('🔦 Your flashlight is flickering.');}break;
  case 'radio':{Aud.radioStatic(3,0.3);setTimeout(()=>{Aud.radioClick();if(Math.random()<0.5&&Aud.play('vo_radio_1',null,0.9,{noVar:true,lp:2800,dest:Aud.voiceBus})){}else echoPlayClip(null,true,0.7);subtitle('[unknown transmission on your channel]');},1200);$('radio').classList.add('rx');setTimeout(()=>$('radio').classList.remove('rx'),4000);G.fx.glitch=0.6;break;}
  case 'ownvoice':if(d.pid===P.id){const p=P.pos.clone();const a=Math.random()*TAU;p.x+=Math.sin(a)*7;p.z+=Math.cos(a)*7;echoPlayClip(p,false,1);subtitle('[your own voice, from the next room]');}break;
  case 'objmove':if(d.pid===P.id){toast('📦 Something in this room just moved.');}if(!mpHost()){for(const id2 of d.ids||[]){const o=G.objById[id2];if(o){o.sleep=false;o.v.set((Math.random()-0.5)*4,2,(Math.random()-0.5)*4);}}}Aud.noise(0.6,0.3,null,{f:500});break;
  case 'lowg':G.gravity=6;toast('🌀 Gravity just… changed. For a bit.');setTimeout(()=>{G.gravity=G.mission.baseGravity;toast('🌀 Gravity is back.');},d.t*1000);break;
  case 'fakeexit':toast('🚨 EXTRACTION SIGNAL RECEIVED — VEHICLE READY','big');Aud.alarm();$('van').style.color='#7ddc7d';setTimeout(()=>{toast('📡 …signal lost. That wasn\'t us.');$('van').style.color='';},18000);break;
  case 'alarm':toast('🚨 EMERGENCY ALARM');for(let i=0;i<4;i++)setTimeout(()=>Aud.alarm(),i*2500);if(mpHost()){const rp=randomWalkCell(G.map,P.k);for(let i=0;i<8;i++)setTimeout(()=>emitNoise(rp,rp.k,1,'alarm'),i*1200);}break;
  case 'lockdown':toast('🔒 LOCKDOWN — the blast door has sealed','big');Aud.alarm();G.map.exit.locked=true;G.map.exit.target=0;objectiveHint('Restore power at the generator or find another way out');break;
  case 'goldroom':toast('💰 Appraisal update: a room on '+LAYER_NAMES[d.k]+' just became extremely valuable.');if(!mpHost()){for(const o of G.objs){if(o.kind==='item'&&o.k===d.k&&roomAt(G.map,d.k,o.p.x,o.p.z)===d.room&&!o.broken)o.value=Math.round(o.value*3);}}Aud.ui('cash');break;
  case 'mapglitch':G.fx.mapGlitch=40;toast('🗺 Map interference.');G.fx.glitch=1;break;
  case 'elevator':{if(!G.map.elev)break;const p=new THREE.Vector3(G.map.elev.wx,P.pos.y,G.map.elev.wz);Aud.noise(3,0.35,p,{f:180,a:0.4});setTimeout(()=>{Aud.tone(880,0.4,'sine',0.15,p);Aud.tone(1100,0.5,'sine',0.12,p);},2600);toast('🛗 The elevator is moving. Nobody called it.');subtitle('[elevator moving]');break;}
  case 'doorslam':break;
  case 'distant':{const p=new THREE.Vector3(d.p[0],d.p[1],d.p[2]);if(d.kind==='impact')Aud.impact(0.7,p);else if(d.kind==='door')Aud.door(p,true);else Aud.creature(d.kind,p,0.9);if(S.set.subs&&Math.random()<0.6)subtitle('['+({pipe:'pipes groaning',scream:'distant scream',scratch:'scratching',echo:'someone humming',impact:'something fell',laugh:'laughter',door:'a door slammed'})[d.kind]+']');break;}
  case 'intern':{G.mission.intern={x:d.p[0],z:d.p[1],k:d.k};const r=Assets.rig('player');applyCosmetics(r.root,{hair:0,face:2,outfit:4,helmet:0,pack:3,acc:2,color:5});r.root.position.set(d.p[0],layerY(d.k),d.p[1]);G.scene.add(r.root);r.play('idle',0);const lab=mkLabel('☕ the intern','#ffb347');lab.position.y=2.3;r.root.add(lab);G.mission.internRig=r;break;}
}}
function objectiveHint(t){$('objOpt').textContent=t;}
function updateStage(dt){const M=G.mission;if(M.sandbox)return;M.time+=dt;const f=M.time/M.total;const thr=[0,0.2,0.35,0.5,0.65,0.8,0.9];let st=1;for(let i=1;i<7;i++)if(f>=thr[i])st=i+1;
  if(st!==G.stage&&(mpHost()||!MP.on)){setStage(st);if(MP.on)bcast({t:'ev',k:'stage',s:st});}
  if(G.stage>=7){M.departT-=dt;if(M.departT<=0&&(mpHost()||!MP.on)&&M.state==='play'){const v=G.map.van;let near=false;for(const p of alivePlayers()){if(p.inVan)continue;if(p.k===0&&dist2(p.pos.x,p.pos.z,v.x,v.z-2)<225)near=true;}M.grace=M.grace||0;if(near&&M.grace<30){M.grace+=dt;if(!M.graceToast){M.graceToast=true;toast('🚐 THE DRIVER SEES YOU — 30 SECONDS, RUN','big');Aud.alarm();if(MP.on)bcast({t:'ev',k:'toast',s:'🚐 THE DRIVER SEES YOU — 30 SECONDS, RUN'});}}else finishMission('emergency');}}
}
function setStage(st){G.stage=st;const names=['','EXPLORATION','ANOMALIES','ACTIVITY','LIGHTS FAILING','MAJOR ENTITY','COLLAPSE','EMERGENCY EXTRACTION'];$('stageN').textContent='STAGE '+st;$('stageT').textContent=names[st];$('stage').className=st>=6?'crit':st>=4?'warn':'';
  if(st>=2)toast('⚠ STAGE '+st+' · '+names[st],'big');Aud.tone(110,1.2,'sine',0.2);Aud.tone(55,1.5,'square',0.1,null,{lp:200});
  if(st===4){let n=0;for(const l of G.lights){if(Math.random()<0.6){l.on=false;l.emerg=true;n++;}}}
  if(st===5&&(mpHost()||!MP.on)){const hasMajor=G.creatures.some(c=>CREATURES[c.kind].major);const rp=randomWalkCell(G.map,hasMajor?ri(Math.random,0,G.map.L-1):0);spawnCreature(hasMajor?'hound':'warden',rp.x,rp.z,rp.k);}
  if(st===6){G.fx.rumble=true;for(const id in G.doors){const d=G.doors[id];if(!d.blast&&Math.random()<0.15)d.jam=true;}}
  if(st===7){G.mission.departT=60;Aud.alarm();toast('🚐 THE VAN LEAVES IN 60 SECONDS — get inside or lose what you carry','big');}
  if(st===6){toast('🏚 THE SITE IS COLLAPSING. The van leaves at 10:00 sharp.','big');}
  if(st===2&&(mpHost()||!MP.on)&&!G.mission.tutorial){const near=G.creatures.some(c=>c.k===P.k&&c.visible!==false);if(!near)runEvent('creature',true);}
  if(st>=6)Aud.musicSet(Math.max(Aud.music.target||0,4));
}
function objectiveProgress(id){if(typeof showObjMarker==='function')setTimeout(()=>showObjMarker(6),300);const o=G.mission.objective;if(o.id!==id||o.done)return;o.done=true;toast('✅ OBJECTIVE COMPLETE: '+o.text,'big');Aud.ui('ok');updateObjHud();if(mpHost()&&MP.on)bcast({t:'ev',k:'objdone'});}
function checkObjectives(){const o=G.mission.objective;if(o.done)return;if(o.id==='quota'){if(vanValue()>=o.quota)objectiveProgress('quota');}
  else if(o.id==='researcher'){const t=G.objById.objtag;if(t&&t.inVan)objectiveProgress('researcher');}
  else if(o.id==='drive'){const t=G.objById.drive_obj;if(t&&t.inVan)objectiveProgress('drive');}
  else if(o.id==='samples'){let n=0;for(const ob of G.objs)if(ob.inVan&&ob.kind==='item'&&ITEMS[ob.tpl]&&ITEMS[ob.tpl].sample)n++;if(n>=3)objectiveProgress('samples');}
  else if(o.id==='artifact'){const t=G.objById.artifact;if(t&&t.inVan)objectiveProgress('artifact');}}
function updateObjHud(){const o=G.mission.objective;$('objMain').innerHTML=(o.done?'✅ ':'▸ ')+o.text+(o.id==='quota'?' <span class="dim">('+fmt(vanValue())+' / '+fmt(o.quota)+')</span>':'');const opts=G.mission.optionals.map(x=>(x.failed?'✖ ':x.done?'✅ ':'○ ')+x.n).join(' · ');$('objOpt').textContent=opts;}
/* motion sensor */
let sensorT=0;function updateSensor(dt){if(!S.up.sensor||P.dead)return;let best=1e9,bc=null;const rng=S.up.sensor>=2?25:15;for(const c of G.creatures){if(!c.visible||c.k!==P.k)continue;const d=c.pos.distanceTo(P.pos);if(d<rng&&d<best){best=d;bc=c;}}sensorT-=dt;if(bc&&sensorT<=0){sensorT=clamp(best/rng,0.12,1)*1.4;Aud.tone(1400,0.06,'square',0.05);if(S.up.sensor>=2&&Math.random()<0.3){const dx=bc.pos.x-P.pos.x,dz=bc.pos.z-P.pos.z;const ang=Math.atan2(dx,-dz);const rel=((ang-P.yaw+Math.PI*3)%(Math.PI*2))-Math.PI;const dir=Math.abs(rel)<0.6?'ahead':rel>0?'right':'left';$('noiseT').textContent='SENSOR: '+Math.round(best)+'m '+dir;}}}

function updateVanLock(dt){const locked=vanLocked();if(G.vanDoors){for(const d of G.vanDoors){const t=locked?0:d.userData.openY;d.rotation.set(0,lerp(d.rotation.y,t,Math.min(1,dt*2)),0);}}if(G.mission&&G.mission.vanWasLocked&&!locked){G.mission.vanWasLocked=false;toast('🚐 The van doors are open. Loot goes in the back.','big');Aud.door(new THREE.Vector3(G.map.van.x,1,G.map.van.z-4),true);}}
function updateDissolve(dt){if(!G.dissolving)return;for(const d of G.dissolving.slice()){d.t+=dt;d.root.userData.dissolve.value=Math.min(1,d.t/1.1);if(d.mixer)d.mixer.update(dt);if(d.t>1.2){G.scene.remove(d.root);G.dissolving=G.dissolving.filter(x=>x!==d);}}}
function spawnGhost(kind,p,k,yaw,pid){const rig=Assets.rig(kind);if(!rig)return;enhanceRig(rig.root,kind);rig.root.position.set(p[0],p[1],p[2]);rig.root.rotation.y=yaw+Math.PI;rig.root.traverse(o=>{if(o.isSprite)o.visible=false;});G.scene.add(rig.root);try{rig.play('idle',0);}catch(e){}
  G.ghosts=G.ghosts||[];G.ghosts.push({rig,k,t:0,seen:0,pid,pos:new THREE.Vector3(p[0],p[1],p[2])});if(pid===P.id){Aud.creature(kind,new THREE.Vector3(p[0],p[1]+1,p[2]),0.35);}}
function updateGhosts(dt){if(!G.ghosts)return;for(const g of G.ghosts.slice()){g.t+=dt;if(g.rig.mixer)g.rig.mixer.update(dt);const fake={pos:g.pos,k:g.k,dead:false,id:P.id,local:true};const look=P.k===g.k&&lookingAt(fake,{pos:P.pos,k:P.k,dead:false,id:P.id,local:true},24,0.9);if(look)g.seen+=dt;
    if(g.seen>0.22||g.t>3.2){G.ghosts=G.ghosts.filter(x=>x!==g);if(g.rig.root.userData.dissolve){G.dissolving=G.dissolving||[];G.dissolving.push({root:g.rig.root,t:0,mixer:g.rig.mixer});}else G.scene.remove(g.rig.root);if(g.seen>0.22&&g.pid===P.id){G.fx.shake+=0.3;G.fx.glitch=Math.max(G.fx.glitch,0.5);Aud.sting('scare');if(S.set.subs)subtitle('[it was there]');if(!G.mission.ghostHint){G.mission.ghostHint=true;setTimeout(()=>toast('👁 Something was standing at the edge of your vision. It never stays where you look.','big'),600);}}}}}
function updateLightsFx(dt){updateVanLock(dt);updateDissolve(dt);updateGhosts(dt);SHU.time.value=G.t;
  for(const l of G.lights){if(!l.glow)continue;const near=l.k===P.k&&dist2(l.x,l.z,P.pos.x,P.pos.z)<45;l.glow.visible=near;if(near){let it=l.on&&G.fx.lightsOut<=0?1:0;if(l.flicker&&Math.sin(G.t*23+l.phase)*Math.sin(G.t*7.3+l.phase)>0.6)it*=0.15;l.glow.material.opacity=0.42*it;}if(l.eglow){const e=near&&l.emerg&&!l.on;l.eglow.visible=e;if(e)l.eglow.material.opacity=0.3+0.3*Math.sin(G.t*2+l.phase);}}
  const cols={hanger:0xb0b090,collector:0xffb020,sleeper:0xff5010,mourner:0x000000,warden:0xff2a08,hound:0x40ff70,lighteater:0xff7a20,drifter:0x60e0ff,crawler:0xffe070,stack:0xffd040,echo:0x8090ff,window:0x000000};const cands=[];for(const c of G.creatures){if(!c.visible||c.k!==P.k||c.kind==='window')continue;const d=c.pos.distanceTo(P.pos);if(d<30)cands.push([d,c]);}cands.sort((a,b)=>a[0]-b[0]);
  (G.crLights||[]).forEach((pl,i)=>{const e=cands[i];if(!e){pl.intensity=0;return;}const c=e[1];pl.position.set(c.pos.x,c.pos.y+(c.kind==='warden'?3.2:c.kind==='lighteater'?1.2:c.kind==='drifter'?0.9:1.6),c.pos.z);pl.color.setHex(cols[c.kind]||0xffffff);pl.intensity=(c.kind==='warden'?1.2:0.55)*(0.85+0.15*Math.sin(G.t*9+i));});
  {const nd=cands.length?cands[0][0]:99;let want=Math.max(0,Math.min(1,1-nd/22));if(G.stage>=5)want=Math.max(want,0.22);if(P.dead)want=0;const dtl=G._dangerT===undefined?0.016:Math.min(0.1,G.t-G._dangerT);G._dangerT=G.t;G.fx.danger=lerp(G.fx.danger||0,want,1-Math.exp(-(want>(G.fx.danger||0)?4:1.2)*dtl));}
  if(G.edgePass){const u=G.edgePass.uniforms;u.time.value=G.t;const dg=G.fx.danger||0;u.uDanger.value=dg;u.uPulse.value=Math.sin(G.t*(0.9+dg*1.4)*6.2832);u.uGrain.value=0.028+dg*0.045+(P.k>0?0.006:0);u.uRain.value=(P.k===0&&cellAt(G.map,0,P.pos.x,P.pos.z)===T_YARD)?1:0;u.uAberr.value=Math.max(G.fx.glitch>0?0.012*Math.min(1,G.fx.glitch):(G.fx.shake>0.4?0.003:0),dg*0.007+Math.max(0,P.hurtT)*0.012);u.uHurt.value=Math.min(1,(P.hp<35&&!P.dead?(1-P.hp/35)*0.7:0)+Math.max(0,P.hurtT)*0.6);u.uBlind.value=P.blind>0?Math.min(1,P.blind/2):0;}
  if(!(G.composer&&S.set.gfx>=2)&&P.blind<=0){const dg=G.fx.danger||0;const q=Math.round(dg*8)/8;if(G._vigQ!==q){G._vigQ=q;$('vig').style.background=q>0?'radial-gradient(ellipse at center,transparent '+Math.round(45-q*14)+'%,rgba(0,0,0,'+(0.7+q*0.25).toFixed(2)+') 100%)':'';}}
  if(G.beam){G.beam.visible=G.flash.intensity>0&&!P.dead;G.beam.material.opacity=0.034*Math.min(1,G.flash.intensity)*(P.k===0&&cellAt(G.map,0,P.pos.x,P.pos.z)===T_YARD?1.5:1);G.fill.intensity=P.dead?0:0.2;}
  if(G.lightning){G.lightningT-=dt;if(G.lightningT<=0){G.lightningT=18+Math.random()*35;G.flashSeq=0.6;G.lightning.position.set(P.pos.x+30+Math.random()*20,60,P.pos.z+Math.random()*40-20);Aud.thunder(0.6+Math.random()*2);}
    if(G.flashSeq>0){G.flashSeq-=dt;const f=G.flashSeq;const it=(f>0.5?1:f>0.4?0.1:f>0.3?0.8:f>0.15?0.05:0.3)*(P.k===0?1:0.12);G.lightning.intensity=it*2.2;if(G.hemi)G.hemi.intensity=0.22+it*0.5;}else{G.lightning.intensity=0;if(G.hemi)G.hemi.intensity=0.22;}}
}

function spawnEco(kind,k,rp,rng){const m=G.map;
  if(kind==='stack'){const r=pick(m.layers[k].rooms,rng);spawnCreature('stack',r.cx+1,r.cz-1,k);}
  else if(kind==='sleeper'){const r=m.deepRoom;spawnCreature('sleeper',r.cx,r.cz,r.k);}
  else if(kind==='hanger'){const n=W_hangers(m,rng);for(const h of n)spawnCreature('hanger',h.x,h.z,h.k);}
  else if(kind==='mourner'){const r=pick(m.layers[k].rooms,rng);spawnCreature('mourner',r.cx-1,r.cz+1,k);}
  else if(kind==='mimic'){const r=pick(m.layers[k].rooms,rng);spawnCreature('mimic',r.cx+0.9,r.cz+0.7,k);}
  else if(kind==='burrower'){const c=randomWalkCell(m,k,rng);spawnCreature('burrower',c.x,c.z,k);}
  else spawnCreature(kind,rp.x,rp.z,k);}
function W_hangers(m,rng){const out=[];const want=m.L>=4?3:2;let tries=0;while(out.length<want&&tries<200){tries++;const k=ri(rng,0,m.L-1);const lay=m.layers[k];const cx=ri(rng,0,m.W-1),cz=ri(rng,0,m.H-1);if(lay.cells[cz*m.W+cx]!==T_CORR)continue;const x=(cx+0.5)*CELL,z=(cz+0.5)*CELL;if(out.some(o=>o.k===k&&dist2(o.x,o.z,x,z)<12))continue;out.push({x,z,k});}return out;}

function playEmote(pid,e){const a=G.avatars[pid];if(!a||a.dead)return;a.rig.play(e,0.1,true);a.emoteT=G.t+(e==='wave'?1.3:1.0);a.anim=e;}
function doEmote(e){if(P.dead||G.state!=='play')return;if(MP.on){if(MP.host)bcast({t:'ev',k:'emote',pid:P.id,e});else sendAct({k:'emote',e});}toast(e==='wave'?'👋 You wave.':'👉');Aud.ui('click');}

function crSfx(c,kind,i){if(MP.on)bcast({t:'ev',k:'sfx',kind,p:[c.pos.x,c.pos.y+1,c.pos.z]});Aud.creature(kind,c.pos,i||1);}
function mimicTrigger(c,pid){if(!c||c.kind!=='mimic'||c.state!=='hidden')return;c.state='reveal';c.timer=0.7;c.anim='reveal';c.lurkT=0;hostDamage(pid,22,'mimic');hostEvent(pid,{k:'bitten'});hostEvent(pid,{k:'scare'});crSfx(c,'mimic_snap',1.2);creatureAttackNoted(c);G.director.aggro+=0.2;}

/* ---- procedural animation layer: breathing, hit flinch, locomotion sync, head tracking ---- */
const _pq=new THREE.Quaternion(),_pq2=new THREE.Quaternion(),_pq3=new THREE.Quaternion(),_pv=new THREE.Vector3(),_pv2=new THREE.Vector3(),_pv3=new THREE.Vector3();
const HEAD_KINDS={echo:1,mourner:1,twin:1,warden:1,window:1,hound:1,sleeper:1,collector:1,crawler:1,burrower:1,hanger:1,lighteater:0,mimic:0,stack:0,swarm:0,drifter:0};
function initHeadTrack(c){c.headBone=false;if(!HEAD_KINDS[c.kind]||!c.rig||!c.rig.root)return;let hb=null;c.rig.root.traverse(o=>{if(!hb&&o.isBone&&o.name==='head')hb=o;});if(!hb)return;
  c.rig.root.updateMatrixWorld(true);c.rig.root.getWorldQuaternion(_pq);hb.getWorldQuaternion(_pq2);_pq.invert().multiply(_pq2);c.headF0=new THREE.Vector3(0,0,1).applyQuaternion(_pq.invert());
  c.headBone=hb;c.headQ=new THREE.Quaternion();c.headPre=hb.quaternion.clone();c.headApplied=hb.quaternion.clone();}
function procAnim(c,r,an,dt){const root=r.root;
  /* breathing */if(c.kind!=='swarm'&&c.kind!=='stack'&&c.kind!=='mimic'){c.brPh=c.brPh||Math.random()*6;const bs=c.kind==='sleeper'?1.15:1;root.scale.y=bs*(1+(c.kind==='sleeper'?0.03:0.012)*Math.sin(G.t*(c.kind==='sleeper'?0.9:1.7)+c.brPh));}
  /* hit flinch + flash */for(const o of G.objs){if(o.k!==c.k||o.held!==null||o.v.length()<4)continue;const rr=CR_CFG[c.kind].r+(o.r||0.3)+0.3;if(dist2(o.p.x,o.p.z,c.pos.x,c.pos.z)<rr*rr&&o.p.y>c.pos.y-0.3&&o.p.y<c.pos.y+CR_CFG[c.kind].h+0.5){if(!(c.hitCd>G.t)){c.hitT=0.45;c.hitCd=G.t+0.6;if(c.k===P.k)Aud.drop(0.6,o.p);}break;}}
  if(c.hitT>0){c.hitT-=dt;const k=Math.max(0,c.hitT);root.rotation.z+=Math.sin(k*45)*0.14*k;root.rotation.x+=k*0.12;if(root.userData.hit)root.userData.hit.value=Math.min(1,k*2.5);}else if(root.userData.hit&&root.userData.hit.value>0)root.userData.hit.value=0;
  /* locomotion sync: play walk/run at the speed the creature actually moves */if(an==='walk'||an==='run'||an==='crawl'||an==='move'){const cfg=CR_CFG[c.kind];const nom=(an==='run'||an==='crawl')?Math.max(cfg.hunt,0.1):Math.max(cfg.speed,0.1);r.mixer.timeScale=clamp((c.spdS||0)/nom,0.3,1.8)*(c.kind==='hound'&&an==='run'?1.4:1);}else r.mixer.timeScale=1;
  /* head tracking */const hb=c.headBone;if(!hb)return;if(hb.quaternion.equals(c.headApplied))hb.quaternion.copy(c.headPre);c.headPre.copy(hb.quaternion);
  const st=c.state;const want=!c.ceiling&&st!=='sleep'&&st!=='hidden'&&st!=='lurk'&&st!=='hang'&&st!=='kneel'&&st!=='gone'&&st!=='reveal';let target=null;if(want){let bd=1e9;for(const p of allPlayers()){if(p.dead||p.k!==c.k)continue;const d=p.pos.distanceTo(c.pos);if(d<14&&d<bd){bd=d;target=p;}}}
  _pq3.identity();if(target){hb.updateWorldMatrix(true,false);hb.getWorldPosition(_pv);_pv2.copy(target.pos);_pv2.y+=1.5;_pv2.sub(_pv);if(_pv2.lengthSq()>0.05){_pv2.normalize();_pv3.set(Math.sin(c.yaw),0,Math.cos(c.yaw));const ang=Math.acos(clamp(_pv3.dot(_pv2),-1,1));if(ang<1.25){hb.getWorldQuaternion(_pq);const cur=_pv3.copy(c.headF0).applyQuaternion(_pq).normalize();_pq3.setFromUnitVectors(cur,_pv2);hb.parent.getWorldQuaternion(_pq2);_pq.copy(_pq2).invert();_pq3.premultiply(_pq).multiply(_pq2);}}}
  c.headQ.slerp(_pq3,1-Math.exp(-5*dt));hb.quaternion.premultiply(c.headQ);c.headApplied.copy(hb.quaternion);}

/* ---------- SITE ZERO: The Signal (host authority) ---------- */
function sigToast(s){toast(s,'big');if(MP.on&&mpHost())bcast({t:'ev',k:'toast',s});}
function sigBcast(){const sg=G.map.specials.sig;if(MP.on&&mpHost())bcast({t:'ev',k:'sig',g:sg.gens.map(g=>g.on?1:0),n:sg.next,d:sg.done?1:0});updateObjHud();}
function sigGenHost(i,pid){const sg=G.map.specials&&G.map.specials.sig;if(!sg||sg.done)return;const g=sg.gens[i];if(!g||!g.on)return;
  if(sg.order[sg.next]===i){g.on=false;if(g.lamp){g.lamp.color.setHex(0x203020);g.lamp.intensity=0.35;}sg.next++;Aud.play('generator',new THREE.Vector3(g.x,layerY(g.k)+1,g.z),1);G.fx.shake+=1.5;
    if(sg.next>=sg.gens.length){sg.done=true;sigBcast();sigFinish();}else{sigToast('⚙ Generator '+sg.next+' / '+sg.gens.length+' down. The building notices.');sigBcast();sigAttack('lights',pid);setTimeout(()=>{if(G.state==='play')runEvent('creature',true);},2500);}}
  else{const last=sg.next>0?sg.gens[sg.order[sg.next-1]]:null;if(last){last.on=true;if(last.lamp){last.lamp.color.setHex(0xff3020);last.lamp.intensity=1.2;}sg.next--;}sigToast('⚠ WRONG ORDER. '+(last?'Generator '+sigFloor(last.k)+' restarted. ':'')+'The site pushes back.');sigBcast();sigAttack('wrong',pid);}}
function sigFinish(){const sg=G.map.specials.sig;sigToast('◆ THE SIGNAL STOPS. Everything is quiet. Get to the van.');Aud.alarm();objectiveProgress('signal');G.mission.sigTime=G.mission.time;for(const c of G.creatures.slice())removeCreature(c);G.mission.vanLockT=0;G.mission.time=Math.max(G.mission.time,G.mission.total*0.82);G.director.calmUntil=G.t+9999;if(MP.on&&mpHost())bcast({t:'ev',k:'sigdone'});}
function sigTick(dt){const sg=G.map.specials&&G.map.specials.sig;if(!sg||sg.done||G.mission.state!=='play')return;sg.atkT=(sg.atkT===undefined?28:sg.atkT)-dt;if(sg.atkT<=0){sg.atkT=34-sg.next*5+Math.random()*12;sigAttack(pick(['door','lights','radio','twin','door','radio']),null);}}
function sigAttack(kind,pid){const pls=alivePlayers().filter(p=>!p.inVan);if(!pls.length)return;const tp=pid!==null&&pid!==undefined?(pls.find(p=>p.id===pid)||pick(pls)):pick(pls);
  if(kind==='door'||kind==='wrong'){let best=null,bd=1e9;for(const did in G.doors){const d=G.doors[did];if(d.k!==tp.k||d.blast||d.broken||d.open<0.5)continue;const dd=dist2(d.x,d.z,tp.pos.x,tp.pos.z);if(dd<bd&&dd>1.5){bd=dd;best=d;}}if(best&&bd<120){best.jam=true;setDoorHost(best,0,true);hostEvent(tp.id,{k:'toast',s:'🚪 The Signal shut the door on you. Shove it open.'});setTimeout(()=>{best.jam=false;},14000);}}
  if(kind==='lights'||kind==='wrong'){const k=tp.k;let n=0;for(const l of G.lights){if(l.k===k&&l.on&&!l.dead){l.on=false;l.emerg=true;l.sigOff=true;n++;}}if(n){sigToast('💡 Floor '+sigFloor(k)+' goes dark.');setTimeout(()=>{for(const l of G.lights){if(l.sigOff){l.sigOff=false;if(!l.dead&&!l.eaten){l.on=true;l.emerg=false;}}}},26000);}}
  if(kind==='radio'){hostEvent(tp.id,{k:'radiolure'});}
  if(kind==='twin'||kind==='wrong'){const c=randomWalkCell(G.map,tp.k);const who=pick(alivePlayers().concat(pls)).id;spawnCreature('twin',c.x,c.z,tp.k,{who});sigToast('🧍 Something wearing a familiar face is on floor '+sigFloor(tp.k)+'.');}}
