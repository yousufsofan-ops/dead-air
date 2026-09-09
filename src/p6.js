/* ================= NETWORKING (PeerJS, host-authoritative) ================= */
const MAXP=4;const PEER_OPT={debug:0,config:{iceServers:[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:global.stun.twilio.com:3478'}]}};
const MP={on:false,host:false,peer:null,code:'',conns:[],hostConn:null,myId:0,players:{},peerIds:{},nextId:1,name:'',busy:false,err:'',status:'',lobby:{contract:null,ready:{},started:false},snapT:0,inputT:0,ping:0,dropped:{},netLost:null,hostId:0,connecting:0,peerAlt:null};
function mpHost(){return !MP.on||MP.host;}
function mkCode(){const a='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let s='';for(let i=0;i<4;i++)s+=a[Math.floor(Math.random()*a.length)];return s;}
function bcast(m,except){for(const c of MP.conns){if(c===except)continue;try{if(c.open)c.send(m);}catch(e){}}}
function sendTo(pid,m){const c=MP.conns.find(c=>c._pid===pid);if(c)try{c.send(m);}catch(e){}}
function sendHost(m){if(MP.hostConn)try{MP.hostConn.send(m);}catch(e){}}
function sendAct(a){if(!MP.on||MP.host)return;a.t='act';sendHost(a);}
function mpHostStart(){if(MP.on||MP.busy)return;if(!window.Peer){MP.err='Multiplayer library did not load.';renderCrew();return;}MP.busy=true;MP.err='';MP.status='Opening room…';renderCrew();
  const code=mkCode();const peer=new Peer('deadair-'+code,PEER_OPT);MP.peer=peer;hookCalls(peer);
  peer.on('open',()=>{MP.busy=false;MP.on=true;MP.host=true;MP.code=code;MP.myId=0;P.id=0;MP.players={0:{name:MP.name,cos:sanitizedCos(),ready:false,up:S.up,pr:S.prestige||0,bd:S.ending?1:0}};MP.peerIds={0:'deadair-'+code};MP.status='';Aud.ui('ok');toast('📡 Room open · code '+code);renderCrew();updateRoomPill();if(S.set.voiceAuto&&!VOICE.on)setTimeout(voiceStart,400);});
  peer.on('connection',hostAcceptConn);peer.on('disconnected',()=>{try{peer.reconnect();}catch(e){}});
  peer.on('error',e=>{MP.busy=false;MP.err=(e&&e.type==='unavailable-id')?'Code collision — try again.':'Could not open room ('+((e&&e.type)||'error')+').';try{peer.destroy();}catch(x){}MP.peer=null;MP.status='';renderCrew();});}
function hostAcceptConn(conn){const inPlay=MP.lobby.started&&G.state!=='hub';const live=MP.conns.length;if(live>=MAXP-1&&!inPlay){try{conn.on('open',()=>{conn.send({t:'full'});setTimeout(()=>conn.close(),300);});}catch(e){}return;}
  conn._pid=MP.nextId++;conn._prov=true;
  conn.on('open',()=>{MP.conns.push(conn);if(inPlay){/* only rejoining players may enter a running game; give them 4 s to identify */setTimeout(()=>{if(conn._prov&&MP.conns.indexOf(conn)>=0){try{conn.send({t:'full'});conn.close();}catch(e){}}},4000);}});
  conn.on('data',d=>hostMsg(conn._pid,d,conn));
  conn.on('close',()=>hostConnClosed(conn));
  conn.on('error',()=>{});}
function hostConnClosed(conn){MP.conns=MP.conns.filter(c=>c!==conn);const id=conn._pid;if(conn._prov||!MP.players[id])return;const nm=(MP.players[id]||{}).name||('P'+id);
  if(G.state==='play'&&!MP.players[id].gone){MP.players[id].gone=true;MP.dropped[id]=G.t;const a=G.avatars[id];if(a)a.gone=true;voiceDropPeer(MP.peerIds[id]);bcast({t:'roster',p:MP.players,ids:MP.peerIds});toast('📡 '+nm+' lost connection — holding their spot for 60 s');renderCrew();updateRoomPill();return;}
  hostFinalizeDrop(id);}
function hostFinalizeDrop(id){const nm=(MP.players[id]||{}).name||('P'+id);const pk=MP.peerIds[id];voiceDropPeer(pk);removeAvatar(id);delete MP.players[id];delete MP.peerIds[id];delete MP.lobby.ready[id];delete MP.dropped[id];bcast({t:'roster',p:MP.players,ids:MP.peerIds});toast('👋 '+nm+' left');renderCrew();updateRoomPill();if(G.state==='play')hostDropInventory(id);}
function connectHost(peerId,rejoinId){const conn=MP.peer.connect(peerId,{reliable:true});let opened=false;
  conn.on('open',()=>{opened=true;MP.hostConn=conn;MP.connecting=0;conn.send({t:'hi',n:MP.name,cos:sanitizedCos(),up:S.up,pk:MP.peer.id,rejoin:rejoinId,pr:S.prestige||0,bd:S.ending?1:0});});
  conn.on('data',clientMsg);conn.on('close',()=>{if(MP.hostConn===conn)hostLost();});conn.on('error',()=>{});return conn;}
function hostLost(){if(!MP.on||MP.host)return;if(G.state!=='play'){toast('❌ Host closed the room');mpLeave(true);return;}if(MP.netLost)return;MP.netLost={t:G.t,phase:'reconnect',last:-9,target:null};sysMsg('📡 Connection to the host lost — reconnecting…','err',999);}
function netRecoverTick(){const L=MP.netLost;if(!L||MP.host)return;const el=G.t-L.t;
  if(L.phase==='reconnect'){if(el>8){L.phase='migrate';const ids=Object.keys(MP.players).map(Number).filter(i=>i!==MP.hostId&&!(MP.players[i]||{}).gone).sort((a,b)=>a-b);const cand=ids[0];L.cand=cand;if(cand===undefined||cand===P.id){becomeHost();return;}sysMsg('📡 Host is gone — '+nameOf(cand)+' is taking over. Reconnecting…','err',999);}
    else if(G.t-L.last>2.5){L.last=G.t;sysMsg('📡 Connection to the host lost — reconnecting ('+Math.ceil(8-el)+' s)…','err',999);tryConnect(MP.peerIds[MP.hostId]||('deadair-'+MP.code),P.id);}return;}
  if(L.phase==='migrate'){if(el>70){sysMsg('❌ Could not recover the session.','err',6);MP.netLost=null;mpLeave();return;}if(G.t-L.last>2.5){L.last=G.t;tryConnect('deadair-'+MP.code+'-m'+L.cand,P.id);}}}
function tryConnect(peerId,rejoinId){if(!MP.peer)return;try{if(MP.peer.disconnected&&!MP.peer.destroyed){MP.peer.reconnect();return;}}catch(e){}try{connectHost(peerId,rejoinId);}catch(e){}}
function becomeHost(){const L=MP.netLost;MP.netLost=null;const oldHost=MP.hostId;MP.host=true;MP.hostId=P.id;MP.hostConn=null;MP.conns=[];MP.snapT=0;MP.dropped={};MP.nextId=Math.max(P.id,...Object.keys(MP.players).map(Number).filter(n=>isFinite(n)))+1;
  removeAvatar(oldHost);for(const o of G.objs){if(o.held===oldHost){o.held=null;o.mesh.visible=true;o.sleep=false;}o.holders=o.holders.filter(h=>h!==oldHost);o.net=null;}delete MP.players[oldHost];delete MP.peerIds[oldHost];
  for(const c of G.creatures){c.net=null;c.path=null;}for(const id in MP.players){if(+id!==P.id){MP.players[id].gone=true;MP.dropped[id]=G.t;const a=G.avatars[id];if(a)a.gone=true;}}
  const old=MP.peer;const mp=new Peer('deadair-'+MP.code+'-m'+P.id,PEER_OPT);MP.peer=mp;hookCalls(mp);
  mp.on('open',()=>{MP.peerIds[P.id]=mp.id;sysMsg('📡 You are now the host. Waiting for the others to reconnect…','warn',8);toast('📡 You are now the host');updateRoomPill();renderCrew&&renderCrew();setTimeout(claimRoomId,4000);setTimeout(()=>{try{old.destroy();}catch(e){}},6000);});
  mp.on('connection',hostAcceptConn);mp.on('disconnected',()=>{try{mp.reconnect();}catch(e){}});mp.on('error',e=>{if(e&&e.type==='unavailable-id')setTimeout(becomeHost,3000);});}
function claimRoomId(){if(!MP.on||!MP.host||MP.peerAlt)return;try{const p2=new Peer('deadair-'+MP.code,PEER_OPT);p2.on('open',()=>{MP.peerAlt=p2;hookCalls(p2);p2.on('connection',hostAcceptConn);p2.on('disconnected',()=>{try{p2.reconnect();}catch(e){}});});p2.on('error',e=>{try{p2.destroy();}catch(x){}if(MP.on&&MP.host)setTimeout(claimRoomId,15000);});}catch(e){}}
function mpJoin(code){if(MP.on||MP.busy)return;code=(code||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,4);if(code.length!==4){MP.err='Enter the 4-character room code.';renderCrew();return;}if(!window.Peer){MP.err='Multiplayer library did not load.';renderCrew();return;}
  MP.busy=true;MP.err='';MP.status='Connecting to '+code+'…';renderCrew();const peer=new Peer(PEER_OPT);MP.peer=peer;hookCalls(peer);let done=false;
  peer.on('disconnected',()=>{try{peer.reconnect();}catch(e){}});
  peer.on('open',()=>{MP.code=code;MP.hostId=0;const conn=connectHost('deadair-'+code,undefined);MP.hostConn=conn;
    conn.on('open',()=>{done=true;MP.busy=false;MP.on=true;MP.host=false;MP.status='Joining…';renderCrew();updateRoomPill();});
    let alt=0;const giveUp=()=>{MP.busy=false;MP.err='No room found with code '+code+'.';MP.status='';try{peer.destroy();}catch(e){}MP.peer=null;MP.hostConn=null;renderCrew();};
    const tryAlt=()=>{if(done)return;alt++;if(alt>3){giveUp();return;}MP.status='Looking for the room ('+alt+')…';renderCrew();const c2=connectHost('deadair-'+code+'-m'+alt,undefined);MP.hostConn=c2;c2.on('open',()=>{done=true;MP.busy=false;MP.on=true;MP.host=false;MP.status='Joining…';renderCrew();updateRoomPill();});setTimeout(tryAlt,6000);};
    setTimeout(tryAlt,9000);});
  peer.on('error',e=>{if(done)return;MP.busy=false;MP.err='Could not connect ('+((e&&e.type)||'error')+').';MP.status='';try{peer.destroy();}catch(x){}MP.peer=null;renderCrew();});}
function mpLeave(silent){MP.netLost=null;if(MP.host)bcast({t:'bye'});voiceStop();try{if(MP.peerAlt)MP.peerAlt.destroy();}catch(e){}MP.peerAlt=null;MP.dropped={};MP.hostId=0;MP.conns.forEach(c=>{try{c.close();}catch(e){}});try{if(MP.peer)MP.peer.destroy();}catch(e){}MP.on=false;MP.host=false;MP.peer=null;MP.hostConn=null;MP.conns=[];MP.code='';MP.players={};MP.peerIds={};MP.nextId=1;MP.myId=0;P.id=0;MP.lobby={contract:null,ready:{},started:false};for(const id in G.avatars)removeAvatar(id);updateRoomPill();if(G.state==='play'&&!silent){finishMission('disconnect');}if(G.state==='hub')renderCrew();}
function updateRoomPill(){if(typeof renderHubCrew==='function'){renderHubCrew();if(G.state==='hub')refreshHubCrewAvatars();}const el=$('roomPill');if(!MP.on){el.style.display='none';return;}el.style.display='inline-block';el.textContent=(MP.host?'HOSTING ':'IN ROOM ')+MP.code+' · '+Object.keys(MP.players).length+'/4';}
/* ---- host message handling ---- */
function hostMsg(id,d,conn){if(!d||!d.t)return;
  switch(d.t){
    case 'hi':{conn._prov=false;const rj=d.rejoin;const taken=rj!==undefined&&MP.conns.some(c=>c!==conn&&c._pid===rj);
      if(rj!==undefined&&MP.players[rj]&&!taken){id=rj;conn._pid=id;MP.players[id].gone=false;delete MP.dropped[id];MP.peerIds[id]=d.pk;const a=G.avatars[id];if(a)a.gone=false;conn.send({t:'welcome',id,p:MP.players,ids:MP.peerIds,lobby:MP.lobby,state:G.state,rejoin:true,hostId:P.id});bcast({t:'roster',p:MP.players,ids:MP.peerIds},conn);toast('📡 '+MP.players[id].name+' reconnected');renderCrew();updateRoomPill();if(VOICE.on)callPeer(d.pk);break;}
      if(G.state==='play'&&!MP.lobby.lateOk&&Object.keys(MP.players).length>=MAXP){conn.send({t:'full'});setTimeout(()=>{try{conn.close();}catch(e){}},300);break;}
      MP.players[id]={name:(d.n||'P'+id).slice(0,16),cos:d.cos||{},ready:false,up:d.up||{},pr:d.pr||0,bd:d.bd||0};MP.peerIds[id]=d.pk;conn.send({t:'welcome',id,p:MP.players,ids:MP.peerIds,lobby:MP.lobby,state:G.state,hostId:P.id});bcast({t:'roster',p:MP.players,ids:MP.peerIds},conn);toast('👋 '+MP.players[id].name+' joined');renderCrew();updateRoomPill();if(VOICE.on)callPeer(d.pk);
      if(G.state==='play'){/* late join: send mission */conn.send({t:'start',seed:G.mission.seed,contract:G.mission.contract,late:true,stage:G.stage,time:G.mission.time});}break;}
    case 'ready':MP.lobby.ready[id]=!!d.v;bcast({t:'lobby',l:MP.lobby});renderCrew();if(typeof renderHubCrew==='function')renderHubCrew();break;
    case 'chat':{const m={t:'chat',n:nameOf(id),s:String(d.s||'').slice(0,120)};bcast(m);chatLine(m.n,m.s);break;}
    case 'input':{applyAvatarPacket(id,d);if(d.hp!==undefined&&MP.players[id]){MP.players[id].hp=d.hp;}break;}
    case 'act':hostAct(id,d);break;
    case 'cos':if(MP.players[id]){MP.players[id].cos=d.cos;bcast({t:'roster',p:MP.players,ids:MP.peerIds});renderCrew();}break;
  }}
function hostAct(id,a){const av=G.avatars[id];
  switch(a.k){
    case 'grab':{const o=G.objById[a.id];if(!o||o.carrier||o.held!==null&&o.held!==id)return;o.held=id;o.lastHolder=id;o.sleep=false;o.mesh.visible=!a.pocket;if(av)av.hold=a.pocket?av.hold:o.id;bcast({t:'ev',k:'held',id:o.id,pid:id,pocket:!!a.pocket});if(o.special==='tag')objectiveProgress('researcher');break;}
    case 'grab2':{const o=G.objById[a.id];if(!o)return;if(o.holders.indexOf(id)<0)o.holders.push(id);o.sleep=false;bcast({t:'ev',k:'holders',id:o.id,h:o.holders});break;}
    case 'drop':{const o=G.objById[a.id];if(!o)return;o.held=null;o.holders=o.holders.filter(h=>h!==id);o.sleep=false;o.p.set(a.p[0],a.p[1],a.p[2]);o.v.set(a.v[0],a.v[1],a.v[2]);if(a.spin)o.spin=a.spin;o.mesh.visible=true;o.k=av?av.k:o.k;bcast({t:'ev',k:'held',id:o.id,pid:null,p:a.p,v:a.v,spin:a.spin||0},null);break;}
    case 'door':{const d=G.doors[a.id];if(!d||d.locked&&!a.force)return;d.target=a.o;Aud.door(new THREE.Vector3(d.x,layerY(d.k)+1,d.z));emitNoiseHost(d.x,layerY(d.k),d.z,d.k,0.2,'door',id);bcast({t:'ev',k:'door',id:d.id,o:a.o});break;}
    case 'unlock':{const d=G.doors[a.id];if(d){d.locked=false;d.target=1;G.director.aggro+=0.5;bcast({t:'ev',k:'unlock',id:d.id});}break;}
    case 'noise':emitNoiseHost(a.p[0],a.p[1],a.p[2],a.l,a.loud,a.kind,id);break;
    case 'doc':{const dd=G.docs.find(x=>x.id===a.id);if(dd){dd.read=true;if(dd.mesh)dd.mesh.visible=false;bcast({t:'ev',k:'doc',id:a.id});G.mission.docsRead=(G.mission.docsRead||0)+1;}break;}
    case 'power':doPowerRemote();bcast({t:'ev',k:'power'});break;
    case 'term':{const t=G.map.specials.terminal;if(t&&!t.done){t.done=true;spawnObj({kind:'item',tpl:17,value:1600,x:t.x,z:t.z-0.8,k:t.k,id:'drive_obj'});bcast({t:'ev',k:'term'});}break;}
    case 'beacon':{const t=G.map.specials.beacon;if(t&&!t.done){t.done=true;objectiveProgress('beacon');G.director.aggro+=0.8;bcast({t:'ev',k:'beacon'});}break;}
    case 'hatch':G.map.hatch.found=true;bcast({t:'ev',k:'hatch'});break;
    case 'revive':hostRevive(a.id);break;
    case 'heal':hostHeal(a.id,50);break;
    case 'hp':if(av){av.hp=a.hp;av.downed=!!a.dn;}break;
    case 'down':if(av){av.downed=true;}bcast({t:'ev',k:'down',pid:id});break;
    case 'dead':if(av){av.dead=true;av.downed=false;}bcast({t:'ev',k:'dead',pid:id,p:a.p,k2:a.k2});spawnCorpse(id,new THREE.Vector3(a.p[0],a.p[1],a.p[2]),a.k2);hostDropInventory(id);break;
    case 'stack':{const c=G.creatures.find(c=>c.id===a.id);if(c)stackReveal(c,id);break;}
    case 'mimic':{const c=G.creatures.find(c=>c.id===a.id);if(c)mimicTrigger(c,id);break;}
    case 'siggen':sigGenHost(a.i,id);break;
    case 'sigterm':sigReveal();bcast({t:'ev',k:'sigorder'});break;
    case 'flare':{const o=spawnObj({kind:'item',special:'flare',tpl:-1,x:a.p[0],z:a.p[2],y:a.p[1],k:av?av.k:0,id:a.id});o.v.set(a.v[0],a.v[1],a.v[2]);o.flare=G.t+45;G.flareObjs.push(o);bcast({t:'ev',k:'flare',p:a.p,v:a.v,k:av?av.k:0,id:a.id},null);break;}
    case 'ping':addPing(a.p,a.type,id);bcast({t:'ev',k:'ping',p:a.p,type:a.type,pid:id});break;
    case 'marker':addMarker(a.m);bcast({t:'ev',k:'marker',m:a.m});break;
    case 'aggro':G.director.aggro+=a.v||0.3;break;
    case 'emote':bcast({t:'ev',k:'emote',pid:id,e:a.e},null);playEmote(id,a.e);break;
    case 'intern':internTalk(id);break;
    case 'cheat':break;
  }}
function emitNoiseHost(x,y,z,k,loud,kind,pid){NOISES.push({x,y,z,k,loud,kind,t:G.t,pid});}
function hostDropInventory(pid){for(const o of G.objs){if(o.held===pid){o.held=null;o.mesh.visible=true;o.sleep=false;const av=G.avatars[pid];if(av){o.p.copy(av.pos);o.p.y+=0.5;o.k=av.k;}bcast({t:'ev',k:'held',id:o.id,pid:null,p:[o.p.x,o.p.y,o.p.z],v:[0,0,0]});}o.holders=o.holders.filter(h=>h!==pid);}}
function hostRevive(pid){if(pid===P.id){if(P.downed){P.downed=false;P.hp=35;$('downed').style.display='none';Aud.sting('revive');toast('🩹 You\'re up.');}return;}const av=G.avatars[pid];if(av){av.downed=false;av.hp=35;}sendTo(pid,{t:'ev',k:'revived'});bcast({t:'ev',k:'revivedOther',pid});G.mission.stats.revives++;}
function hostHeal(pid,amt){if(pid===P.id){P.hp=Math.min(100,P.hp+amt);updateVitals();return;}sendTo(pid,{t:'ev',k:'heal',amt});}
function doPowerRemote(){const g=G.map.gen;g.on=true;if(G.map.exit.locked){G.map.exit.locked=false;G.map.exit.target=1;}for(const l of G.lights)if(!l.eaten){l.on=true;l.emerg=false;}objectiveProgress('power');toast('⚡ POWER RESTORED');Aud.alarm();}
/* ---- client message handling ---- */
function clientMsg(d){if(!d||!d.t)return;
  switch(d.t){
    case 'welcome':MP.myId=d.id;P.id=d.id;MP.players=d.p;MP.peerIds=d.ids;MP.lobby=d.lobby;MP.status='';MP.hostId=d.hostId||0;renderCrew();updateRoomPill();if(d.rejoin){MP.netLost=null;sysMsg('📡 Reconnected.','warn',4);}else{toast('✅ Joined room '+MP.code);if(S.set.voiceAuto&&!VOICE.on)setTimeout(voiceStart,400);}if(VOICE.on)callEveryone();break;
    case 'roster':MP.players=d.p;MP.peerIds=d.ids;if(VOICE.on)callEveryone();renderCrew();updateRoomPill();break;
    case 'lobby':MP.lobby=d.l;renderCrew();break;
    case 'full':MP.err='Room is full or in progress.';mpLeave(true);renderCrew();break;
    case 'bye':toast('Host left');mpLeave(true);break;
    case 'chat':chatLine(d.n,d.s);break;
    case 'start':MP.lobby.started=true;startMission(d.contract,d.seed,d.late?{late:true,stage:d.stage,time:d.time}:null);break;
    case 'snap':applySnapshot(d);break;
    case 'ev':clientEvent(d);break;
    case 'end':showResults(d.r);break;
  }}
function clientEvent(d){if(G.state!=='play'&&['spawn'].indexOf(d.k)<0)return;
  switch(d.k){
    case 'held':{const o=G.objById[d.id];if(!o)return;if(d.pid===null||d.pid===undefined){o.held=null;o.holders=[];o.mesh.visible=true;o.sleep=false;if(d.p)o.p.set(d.p[0],d.p[1],d.p[2]);if(d.v)o.v.set(d.v[0],d.v[1],d.v[2]);if(d.spin)o.spin=d.spin;if(P.hands===o.id)P.hands=null;const i=P.pockets.indexOf(o.id);if(i>=0)P.pockets.splice(i,1);updateInv();}else{o.held=d.pid;o.lastHolder=d.pid;o.mesh.visible=!d.pocket;if(d.pid!==P.id&&(P.hands===o.id||P.pockets.indexOf(o.id)>=0)){/* stolen race: we lose it */P.hands=P.hands===o.id?null:P.hands;P.pockets=P.pockets.filter(x=>x!==o.id);updateInv();toast('🫳 '+nameOf(d.pid)+' grabbed that first.');}}break;}
    case 'holders':{const o=G.objById[d.id];if(o){o.holders=d.h.slice();o.held=null;if(o.holders.length>=2&&o.holders.indexOf(P.id)>=0)toast('🫳 Both carrying — move together');}break;}
    case 'rattle':{const dd=G.doors[d.id];if(dd){dd.rattle=d.t;Aud.rattle(new THREE.Vector3(dd.x,layerY(dd.k)+1,dd.z),d.t);}break;}
    case 'door':{const dd=G.doors[d.id];if(dd){dd.target=d.o;Aud.door(new THREE.Vector3(dd.x,layerY(dd.k)+1,dd.z),d.slam);}break;}
    case 'unlock':{const dd=G.doors[d.id];if(dd){dd.locked=false;dd.target=1;}break;}
    case 'doorbreak':{const dd=G.doors[d.id];if(dd){dd.broken=true;dd.open=dd.target=1;if(dd.mesh)dd.mesh.visible=false;Aud.impact(1,new THREE.Vector3(dd.x,layerY(dd.k)+1,dd.z));}break;}
    case 'doc':{const dd=G.docs.find(x=>x.id===d.id);if(dd){dd.read=true;if(dd.mesh)dd.mesh.visible=false;}break;}
    case 'power':doPowerRemote();break;
    case 'term':{const t=G.map.specials.terminal;if(t){t.done=true;spawnObj({kind:'item',tpl:17,value:1600,x:t.x,z:t.z-0.8,k:t.k,id:'drive_obj'});}break;}
    case 'beacon':{const t=G.map.specials.beacon;if(t){t.done=true;objectiveProgress('beacon');Aud.alarm();}break;}
    case 'hatch':G.map.hatch.found=true;toast('🔧 Emergency hatch located (see map)');break;
    case 'damage':hurt(d.amt,d.src);break;
    case 'local':applyLocalEvent(d.ev);break;
    case 'revived':if(P.downed){P.downed=false;P.hp=35;$('downed').style.display='none';Aud.sting('revive');toast('🩹 You\'re up.');}break;
    case 'revivedOther':{const a=G.avatars[d.pid];if(a){a.downed=false;a.hp=35;}toast('🩹 '+nameOf(d.pid)+' is back up');break;}
    case 'heal':P.hp=Math.min(100,P.hp+d.amt);updateVitals();toast('🩹 Someone patched you up');break;
    case 'down':{const a=G.avatars[d.pid];if(a)a.downed=true;if(d.pid!==P.id)toast('🩸 '+nameOf(d.pid)+' is DOWN');break;}
    case 'dead':{const a=G.avatars[d.pid];if(a){a.dead=true;a.downed=false;}if(d.pid!==P.id){toast('☠ '+nameOf(d.pid)+' died');spawnCorpse(d.pid,new THREE.Vector3(d.p[0],d.p[1],d.p[2]),d.k2);}break;}
    case 'spawn':{if(G.creatures.some(c=>c.id===d.id))return;const c=spawnCreature(d.kind,d.p[0],d.p[2],d.l,{id:d.id,who:d.who});c.state=d.st;break;}
    case 'despawn':{const c=G.creatures.find(c=>c.id===d.id);if(c)removeCreature(c);break;}
    case 'stackrev':{const c=G.creatures.find(c=>c.id===d.id);if(c){c.state='reveal';c.rig.play('reveal',0.05,true);Aud.creature('stack',c.pos,1.5);}break;}
    case 'sfx':{const p=new THREE.Vector3(d.p[0],d.p[1],d.p[2]);if(p.distanceTo(P.pos)<45)Aud.creature(d.kind,p,1);break;}
    case 'mimic':{const p=new THREE.Vector3(d.p[0],d.p[1],d.p[2]);echoPlayClip(d.radio?null:p,d.radio,1);break;}
    case 'lamp':{const l=G.lamps[d.id];if(l){l.on=d.on;l.eaten=!d.on;}break;}
    case 'rmobj':{const o=G.objById[d.id];if(o){removeObj(o);G.flareObjs=G.flareObjs.filter(x=>x!==o);}break;}
    case 'break':{const o=G.objById[d.id];if(o&&!o.broken)breakObj(o);break;}
    case 'flare':{if(G.objById[d.id])return;const o=spawnObj({kind:'item',special:'flare',tpl:-1,x:d.p[0],z:d.p[2],y:d.p[1],k:d.k,id:d.id});o.v.set(d.v[0],d.v[1],d.v[2]);o.flare=G.t+45;G.flareObjs.push(o);break;}
    case 'event':applyEvent(d.id,d.d||{});break;
    case 'stage':setStage(d.s);break;
    case 'objdone':G.mission.objective.done=true;updateObjHud();toast('✅ OBJECTIVE COMPLETE','big');break;
    case 'ping':addPing(d.p,d.type,d.pid);break;
    case 'marker':addMarker(d.m);break;
    case 'depart':startDepartLocal(d.t);break;
    case 'toast':toast(d.s);break;
    case 'intern':internLine(d.s,d.bonus);break;
    case 'emote':playEmote(d.pid,d.e);break;
    case 'sig':sigApply(d.g,d.n,d.d);break;
    case 'sigorder':sigReveal();break;
    case 'sigdone':{for(const c of G.creatures.slice())removeCreature(c);G.mission.vanLockT=0;break;}
  }}
/* ---- snapshots ---- */
function hostSnapshot(){const pl={};pl[P.id]={p:[+P.pos.x.toFixed(2),+P.pos.y.toFixed(2),+P.pos.z.toFixed(2)],y:+P.yaw.toFixed(3),pt:+P.pitch.toFixed(2),l:P.k,cr:P.crouch?1:0,fl:(P.flash&&P.batt>0)?1:0,tk:P.talk?1:0,rd:P.radio.on?1:0,h:P.hands,n:+P.lastNoise.toFixed(2),sp:+Math.hypot(P.vel.x,P.vel.z).toFixed(1),hp:Math.round(P.hp),dn:P.downed?1:0,dd:P.dead?1:0,iv:P.inVan?1:0};
  for(const id in G.avatars){const a=G.avatars[id];pl[id]={p:[+a.pos.x.toFixed(2),+a.pos.y.toFixed(2),+a.pos.z.toFixed(2)],y:+a.yaw.toFixed(3),pt:+a.pitch.toFixed(2),l:a.k,cr:a.crouch?1:0,fl:a.flash?1:0,tk:a.talk?1:0,rd:a.radio?1:0,h:a.hold,n:a.loud,sp:a.speed,hp:Math.round(a.hp),dn:a.downed?1:0,dd:a.dead?1:0,iv:a.inVan?1:0};}
  const ob={};for(const o of G.objs){if(o.held!==null&&!o.holders.length)continue;if(o.sleep&&o._sentSleep)continue;o._sentSleep=o.sleep;ob[o.id]=[+o.p.x.toFixed(2),+o.p.y.toFixed(2),+o.p.z.toFixed(2),+o.yaw.toFixed(2),o.k,o.value];}
  const cr=G.creatures.map(c=>({id:c.id,k:c.kind,p:[+c.pos.x.toFixed(2),+c.pos.y.toFixed(2),+c.pos.z.toFixed(2)],y:+c.yaw.toFixed(2),l:c.k,st:c.state,an:c.anim,vis:c.visible?1:0,ce:c.ceiling?1:0,tg:c.target}));
  const dr={};for(const id in G.doors){const d=G.doors[id];dr[id]=[+d.target.toFixed(0),d.locked?1:0,d.jam?1:0,d.broken?1:0];}
  const lt=G.lights.filter(l=>!l.on).map(l=>l.id+(l.emerg?'!':''));
  return {t:'snap',pl,ob,cr,dr,lt,st:G.stage,tm:+G.mission.time.toFixed(1),dep:G.mission.departT,gr:G.gravity,lo:G.fx.lightsOut>0?1:0,ex:[G.map.exit.locked?1:0,G.map.gen.on?1:0],ag:+G.director.aggro.toFixed(2),vb:G.mission.valueBoost||0};}
function applySnapshot(d){for(const id in d.pl){if(+id===P.id)continue;applyAvatarPacket(+id,d.pl[id]);}
  for(const id in d.ob){const o=G.objById[id];if(!o)continue;const a=d.ob[id];if(o.held===P.id||o.holders.indexOf(P.id)>=0&&o.holders.length<2)continue;o.net={p:new THREE.Vector3(a[0],a[1],a[2]),yaw:a[3],k:a[4]};if(a[5]!==undefined)o.value=a[5];if(o.holders.length>=2)o.p.lerp(o.net.p,0.5);}
  const seen=new Set();for(const c of d.cr){seen.add(c.id);let cc=G.creatures.find(x=>x.id===c.id);if(!cc){cc=spawnCreature(c.k,c.p[0],c.p[2],c.l,{id:c.id});cc.pos.y=c.p[1];}cc.net={p:new THREE.Vector3(c.p[0],c.p[1],c.p[2]),yaw:c.y,k:c.l,st:c.st,anim:c.an,vis:!!c.vis,ceil:!!c.ce};cc.target=c.tg;}
  for(const c of G.creatures.slice())if(!seen.has(c.id))removeCreature(c);
  for(const id in d.dr){const dd=G.doors[id];if(!dd)continue;const a=d.dr[id];dd.target=a[0];dd.locked=!!a[1];dd.jam=!!a[2];if(a[3]&&!dd.broken){dd.broken=true;if(dd.mesh)dd.mesh.visible=false;}}
  const off=new Set(d.lt.map(s=>s.replace('!','')));const em=new Set(d.lt.filter(s=>s.endsWith('!')).map(s=>s.replace('!','')));for(const l of G.lights){l.on=!off.has(l.id);l.emerg=em.has(l.id);}
  if(d.st!==G.stage)setStage(d.st);G.mission.time=d.tm;G.mission.departT=d.dep;G.gravity=d.gr;if(d.lo&&G.fx.lightsOut<=0)G.fx.lightsOut=5;G.map.exit.locked=!!d.ex[0];G.map.gen.on=!!d.ex[1];G.mission.valueBoost=d.vb;}
function clientInput(){const o=G.objById[P.hands];const m={t:'input',p:[+P.pos.x.toFixed(2),+P.pos.y.toFixed(2),+P.pos.z.toFixed(2)],y:+P.yaw.toFixed(3),pt:+P.pitch.toFixed(2),l:P.k,cr:P.crouch?1:0,fl:(P.flash&&P.batt>0)?1:0,tk:P.talk?1:0,rd:P.radio.on?1:0,h:P.hands,n:+P.lastNoise.toFixed(2),sp:+Math.hypot(P.vel.x,P.vel.z).toFixed(1),hp:Math.round(P.hp),dn:P.downed?1:0,dd:P.dead?1:0,lw:P.lookW?1:0,iv:P.inVan?1:0};if(o&&o.holders.length>=2&&o.anchor)m.an=[+o.anchor.x.toFixed(2),+o.anchor.y.toFixed(2),+o.anchor.z.toFixed(2)];sendHost(m);}
function netTick(dt){if(!MP.on||G.state!=='play')return;if(MP.host){MP.snapT+=dt;if(MP.snapT>=0.1){MP.snapT=0;bcast(hostSnapshot());}for(const id in MP.dropped){if(G.t-MP.dropped[id]>60)hostFinalizeDrop(+id);}}else{if(MP.netLost){netRecoverTick();}else{MP.inputT+=dt;if(MP.inputT>=0.066){MP.inputT=0;clientInput();}}}P.lastNoise*=Math.pow(0.15,dt);}
/* ================= VOICE (proximity + radio) ================= */
const VOICE={on:false,muted:false,stream:null,calls:{},remotes:{},an:null,lvl:0,err:'',src:null,pttHeld:false,vaHold:0,clips:[],cap:null,capBuf:null,capPos:0,capHot:0,static:null};
function voiceSupported(){return !!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia);}
function analyserFor(node){const c=Aud.ctx;const an=c.createAnalyser();an.fftSize=512;an.smoothingTimeConstant=0.5;node.connect(an);an._buf=new Uint8Array(an.frequencyBinCount);return an;}
function anLevel(an){if(!an)return 0;an.getByteFrequencyData(an._buf);let s=0;for(let i=2;i<28;i++)s+=an._buf[i];return s/(26*255);}
async function voiceStart(){if(VOICE.on)return;if(!voiceSupported()){VOICE.err=window.isSecureContext===false?'Voice needs https:// or localhost.':'No microphone access in this browser.';renderCrew();return;}
  try{VOICE.stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true,channelCount:1},video:false});}catch(e){VOICE.err=(e&&e.name==='NotAllowedError')?'Microphone blocked — allow it in the address bar.':'No microphone found.';renderCrew();return;}
  VOICE.on=true;VOICE.muted=false;VOICE.err='';const c=Aud.init();VOICE.src=c.createMediaStreamSource(VOICE.stream);VOICE.an=analyserFor(VOICE.src);captureFrom(VOICE.src,'me');
  setTx(false);callEveryone();toast('🎙 Voice on · '+(S.set.voiceMode==='ptt'?'hold V to talk':'voice-activated')+' · R = radio');renderCrew();updateMicHud();}
function voiceStop(){if(VOICE.stream)VOICE.stream.getTracks().forEach(t=>t.stop());for(const k in VOICE.calls){try{VOICE.calls[k].close();}catch(e){}}for(const k in VOICE.remotes)voiceDropPeer(k);VOICE.calls={};VOICE.remotes={};VOICE.stream=null;VOICE.on=false;VOICE.an=null;VOICE.src=null;updateMicHud();}
function voiceMute(){if(!VOICE.on){voiceStart();return;}VOICE.muted=!VOICE.muted;updateMicHud();toast(VOICE.muted?'🔇 Muted':'🎙 Unmuted');}
function setTx(on){if(!VOICE.stream)return;const en=on&&!VOICE.muted;VOICE.stream.getAudioTracks().forEach(t=>{if(t.enabled!==en)t.enabled=en;});}
function voiceDropPeer(pk){const r=VOICE.remotes[pk];if(!r)return;try{r.el.pause();r.el.srcObject=null;r.el.remove();r.src.disconnect();}catch(e){}delete VOICE.remotes[pk];if(VOICE.calls[pk]){try{VOICE.calls[pk].close();}catch(e){}delete VOICE.calls[pk];}}
function attachRemote(pk,stream){voiceDropPeer(pk);const c=Aud.init();
  const el=document.createElement('audio');el.autoplay=true;el.muted=true;el.srcObject=stream;document.body.appendChild(el);const p=el.play();if(p&&p.catch)p.catch(()=>{});
  const src=c.createMediaStreamSource(stream);
  /* proximity chain */const gP=c.createGain();gP.gain.value=0;const lp=c.createBiquadFilter();lp.type='lowpass';lp.frequency.value=20000;const pan=Aud.pan(0,0,0);src.connect(gP);gP.connect(lp);lp.connect(pan);pan.connect(Aud.voiceBus);
  /* radio chain */const bp=c.createBiquadFilter();bp.type='bandpass';bp.frequency.value=1500;bp.Q.value=0.9;const ws=c.createWaveShaper();const curve=new Float32Array(256);for(let i=0;i<256;i++){const x=i/128-1;curve[i]=Math.tanh(x*3.2)*0.85;}ws.curve=curve;const gR=c.createGain();gR.gain.value=0;const hp=c.createBiquadFilter();hp.type='highpass';hp.frequency.value=350;src.connect(bp);bp.connect(ws);ws.connect(hp);hp.connect(gR);gR.connect(Aud.voiceBus);
  const an=analyserFor(src);captureFrom(src,pk);
  VOICE.remotes[pk]={el,src,gP,lp,pan,gR,an,lvl:0};}
function callPeer(pk){if(!VOICE.on||!MP.peer||!pk||pk===MP.peer.id)return;if(VOICE.calls[pk])return;try{const call=MP.peer.call(pk,VOICE.stream);if(!call)return;VOICE.calls[pk]=call;call.on('stream',s=>attachRemote(pk,s));call.on('close',()=>{delete VOICE.calls[pk];});call.on('error',()=>{});}catch(e){}}
function callEveryone(){for(const id in MP.peerIds)callPeer(MP.peerIds[id]);}
function hookCalls(peer){peer.on('call',call=>{try{call.answer(VOICE.stream||undefined);VOICE.calls[call.peer]=call;call.on('stream',s=>attachRemote(call.peer,s));call.on('close',()=>{delete VOICE.calls[call.peer];});call.on('error',()=>{});}catch(e){}});}
/* per-frame voice routing */
let voiceT=0;
function voiceLobbyTick(dt){if(!VOICE.on)return;VOICE.lvl=VOICE.muted?0:anLevel(VOICE.an);P.micLvl=VOICE.lvl;
  /* lobby: open mic (voice-activated) for everyone, V also works */if(VOICE.lvl>S.set.micSens)VOICE.vaHold=0.45;else VOICE.vaHold=(VOICE.vaHold||0)-dt;const tx=VOICE.vaHold>0||!!VOICE.pttHeld;setTx(tx);P.talk=tx&&!VOICE.muted;
  for(const pk in VOICE.remotes){const r=VOICE.remotes[pk];r.lvl=anLevel(r.an);r.gP.gain.value=1;r.lp.frequency.value=20000;r.gR.gain.value=0;}}
function voiceTick(dt){if(!VOICE.on)return;const now=performance.now();
  /* local TX gating */VOICE.lvl=VOICE.muted?0:anLevel(VOICE.an);P.micLvl=VOICE.lvl;
  let tx=false;if(S.set.voiceMode==='ptt')tx=VOICE.pttHeld;else{if(VOICE.lvl>S.set.micSens)VOICE.vaHold=0.45;else VOICE.vaHold-=dt;tx=VOICE.vaHold>0;}
  if(P.radio.on&&P.radio.batt>0)tx=true;
  setTx(tx);P.talk=tx&&!VOICE.muted&&!P.radio.on;
  /* mic-based creature detection */if(S.set.micDetect&&VOICE.lvl>0.09&&!VOICE.muted&&G.state==='play'&&!P.dead){if(now-voiceT>250){voiceT=now;const loud=clamp((VOICE.lvl-0.06)*2.2,0.15,1);emitNoise(P.pos,P.k,loud,'voice');if(loud>0.6&&S.set.subs)$('noiseT').textContent='LOUD (mic)';}}
  /* remote routing */const deep=G.state==='play';const radioLv=S.up.radio;const radioRange=[0,40,70,110,160][radioLv];
  for(const pk in VOICE.remotes){const r=VOICE.remotes[pk];r.lvl=anLevel(r.an);const pid=+Object.keys(MP.peerIds).find(id=>MP.peerIds[id]===pk);const a=G.avatars[pid];
    let gp=0,lpf=20000,gr=0;
    if(!deep||!a){gp=1;/* lobby: everyone clear */}
    else{const d=a.pos.distanceTo(P.pos);const sameK=a.k===P.k;const sameYard=cellAt(G.map,0,P.pos.x,P.pos.z)===T_YARD&&cellAt(G.map,0,a.pos.x,a.pos.z)===T_YARD;
      if(sameK||sameYard){if(d<38){const clear=losClear(G.map,P.k,P.pos.x,P.pos.z,a.pos.x,a.pos.z);gp=clear?1:0.42;lpf=clear?20000:520;}}
      else{const dk=Math.abs(a.k-P.k);gp=dk===1&&d<14?0.12:0;lpf=300;}
      if(P.dead)gp=Math.max(gp,0.5);
      /* radio */if(a.radio&&!P.dead||a.radio&&P.dead){const same=(MP.players[pid]&&MP.players[pid].ch||1)===P.radio.ch;const d3=Math.hypot(a.pos.x-P.pos.x,(a.pos.y-P.pos.y)*3,a.pos.z-P.pos.z);let q=same&&P.radio.batt>0?clamp(1.4-d3/radioRange,0,1):0;const dk=Math.abs(a.k-P.k);if(dk>=2&&radioLv<4)q*=0.15;if(G.stage>=6)q*=0.5;if(G.mission.weekly==='static')q*=0.35;q*=(0.75+0.25*Math.sin(now*0.013+pid));if(Math.random()<0.02)q*=0.2;gr=q;if(q>0.05){$('radio').classList.add('rx');r.rxT=now;}}
      if(r.rxT&&now-r.rxT>300){$('radio').classList.remove('rx');r.rxT=0;}
      if(a){pan3(r.pan,a.pos.x,a.pos.y+1.5,a.pos.z);}}
    r.gP.gain.value=lerp(r.gP.gain.value,gp,0.2);r.lp.frequency.value=lerp(r.lp.frequency.value,lpf,0.2);r.gR.gain.value=lerp(r.gR.gain.value,gr*1.2,0.3);
    if(a)a.talk=r.lvl>0.06;}
  /* radio static bed when receiving */let rx=false;for(const pk in VOICE.remotes)if(VOICE.remotes[pk].gR.gain.value>0.05&&VOICE.remotes[pk].lvl>0.05)rx=true;radioBed(rx||P.radio.on);
  updateMicHud();}
function pan3(p,x,y,z){if(p.positionX){p.positionX.value=x;p.positionY.value=y;p.positionZ.value=z;}else p.setPosition(x,y,z);}
function radioBed(on){const c=Aud.ctx;if(!c)return;if(on&&!VOICE.static){const s=c.createBufferSource();s.buffer=Aud.noiseBuf;s.loop=true;const f=c.createBiquadFilter();f.type='bandpass';f.frequency.value=2500;f.Q.value=0.6;const g=c.createGain();g.gain.value=0.035*(G.stage>=6?2:1);s.connect(f);f.connect(g);g.connect(Aud.voiceBus);s.start();VOICE.static={s,g};}else if(!on&&VOICE.static){try{VOICE.static.s.stop();}catch(e){}VOICE.static=null;}}
function updateMicHud(){const el=$('micI');if(!VOICE.on){el.textContent=MP.on?'🎙 OFF · N / click to enable':'🎙 OFF';el.className='off';el.title=VOICE.err||'Click or press N to enable voice chat';return;}el.title='Click or press N to mute';if(VOICE.muted){el.textContent='🔇 MUTED';el.className='off';return;}el.textContent=P.talk||P.radio.on?'🎙 LIVE':'🎙 '+(S.set.voiceMode==='ptt'?'PTT':'VA');el.className=P.talk||P.radio.on?'live':'';const r=$('radio');r.className=P.radio.on?'tx':(r.className==='rx'?'rx':'');$('radioB').textContent=Math.round(P.radio.batt*100)+'%';r.firstChild.textContent='📻 CH'+P.radio.ch+' · ';}
function radioSet(on){if(on&&(P.radio.batt<=0||P.dead))return;if(on===P.radio.on)return;P.radio.on=on;Aud.radioClick();if(on){emitNoise(P.pos,P.k,0.3,'radio');}updateMicHud();}
/* ---- voice clip capture (for The Echo) ---- */
function captureFrom(src,who){const c=Aud.ctx;const sp=c.createScriptProcessor(4096,1,1);const secs=3;const buf=new Float32Array(c.sampleRate*secs);let pos=0,hot=0,quiet=0;const g=c.createGain();g.gain.value=0;
  sp.onaudioprocess=e=>{const inp=e.inputBuffer.getChannelData(0);let s=0;for(let i=0;i<inp.length;i+=16)s+=Math.abs(inp[i]);s/=(inp.length/16);for(let i=0;i<inp.length;i++){buf[pos]=inp[i];pos=(pos+1)%buf.length;}
    if(s>0.03){hot+=inp.length/c.sampleRate;quiet=0;}else{quiet+=inp.length/c.sampleRate;if(hot>0.6&&quiet>0.3){/* snapshot last (hot+0.4)s */const len=Math.min(buf.length,Math.floor((hot+0.5)*c.sampleRate));const ab=c.createBuffer(1,len,c.sampleRate);const d=ab.getChannelData(0);for(let i=0;i<len;i++)d[i]=buf[(pos-len+i+buf.length)%buf.length];VOICE.clips.push({ab,who,t:G.t});if(VOICE.clips.length>16)VOICE.clips.shift();hot=0;}else if(quiet>0.3)hot=0;}};
  src.connect(sp);sp.connect(g);g.connect(c.destination);}
function echoPlayClip(pos,radio,vol){const c=Aud.init();if(!c)return;vol=vol||1;
  if(VOICE.clips.length){const clip=pick(VOICE.clips);const s=c.createBufferSource();s.buffer=clip.ab;s.playbackRate.value=0.9+Math.random()*0.12;s.detune.value=-150+Math.random()*100;
    if(radio){const bp=c.createBiquadFilter();bp.type='bandpass';bp.frequency.value=1400;bp.Q.value=0.9;const g=c.createGain();g.gain.value=0.9*vol;s.connect(bp);bp.connect(g);g.connect(Aud.voiceBus);Aud.radioClick();$('radio').classList.add('rx');setTimeout(()=>$('radio').classList.remove('rx'),clip.ab.duration*1000+300);radioBed(true);setTimeout(()=>radioBed(P.radio.on),clip.ab.duration*1000);}
    else{const lp=c.createBiquadFilter();lp.type='lowpass';lp.frequency.value=1800;const g=c.createGain();g.gain.value=1.1*vol;const p=Aud.pan(pos.x,pos.y+1.6,pos.z);s.connect(lp);lp.connect(g);g.connect(p);p.connect(Aud.voiceBus);}
    s.start();if(S.set.subs)subtitle(radio?'[a familiar voice on the radio]':'[a familiar voice, nearby]');}
  else{/* no clips: garbled voice-like synthesis */const n=5+Math.floor(Math.random()*5);for(let i=0;i<n;i++)setTimeout(()=>{const f=140+Math.random()*120;if(radio){Aud.tone(f*2,0.14,'sawtooth',0.05*vol,null,{lp:1500});}else Aud.tone(f,0.16,'sawtooth',0.07*vol,pos,{lp:900});},i*170);if(S.set.subs)subtitle(radio?'[garbled transmission]':'[someone talking, nearby]');if(radio){Aud.radioClick();radioBed(true);setTimeout(()=>radioBed(P.radio.on),n*170+200);}}
}
/* ---- chat ---- */
function chatLine(n,s){MP.chatHist=MP.chatHist||[];MP.chatHist.push([n,s]);if(MP.chatHist.length>40)MP.chatHist.shift();const el=$('chatLog');const d=document.createElement('div');d.innerHTML='<b class="teal">'+esc(n)+':</b> '+esc(s);el.appendChild(d);while(el.children.length>6)el.removeChild(el.firstChild);setTimeout(()=>{try{d.remove();}catch(e){}},14000);if(G.state==='hub'){const lg=$('lobbyChat');if(lg){lg.appendChild(d.cloneNode(true));lg.scrollTop=1e6;}}}
function esc(s){return String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));}
function sendChat(s){s=s.trim();if(!s)return;if(!MP.on){chatLine(MP.name||'You',s);return;}if(MP.host){const m={t:'chat',n:MP.name,s};bcast(m);chatLine(m.n,s);}else sendHost({t:'chat',s});}
