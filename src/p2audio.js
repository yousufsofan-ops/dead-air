/* ---------------- audio engine v2 (procedural, reverb, formant voices, dynamic music) ---------------- */
const Aud={ctx:null,master:null,sfx:null,mus:null,voiceBus:null,noiseBuf:null,conv:null,revSend:null,revSendV:null,music:{lvl:0,cur:0,t:0,target:0},ambNodes:[],ambKind:null,ambT:2,hb:{t:0,rate:0},
 init(){if(this.ctx){if(this.ctx.state==='suspended')this.ctx.resume();return this.ctx;}
  try{const c=new (window.AudioContext||window.webkitAudioContext)();this.ctx=c;
   this.master=c.createGain();this.master.gain.value=S.set.vol;const comp=c.createDynamicsCompressor();comp.threshold.value=-14;comp.ratio.value=4;comp.attack.value=0.004;comp.release.value=0.2;this.master.connect(comp);comp.connect(c.destination);
   this.sfx=c.createGain();this.sfx.connect(this.master);
   this.mus=c.createGain();this.mus.gain.value=S.set.music;this.mus.connect(this.master);
   this.voiceBus=c.createGain();this.voiceBus.gain.value=S.set.voiceVol;this.voiceBus.connect(this.master);
   const len=c.sampleRate*2,b=c.createBuffer(1,len,c.sampleRate),d=b.getChannelData(0);for(let i=0;i<len;i++)d[i]=Math.random()*2-1;this.noiseBuf=b;
   /* generated impulse response */const rl=Math.floor(c.sampleRate*2.2),ir=c.createBuffer(2,rl,c.sampleRate);for(let ch=0;ch<2;ch++){const o=ir.getChannelData(ch);let lp=0;for(let i=0;i<rl;i++){const t=i/c.sampleRate;const n=(Math.random()*2-1);lp=lp*0.6+n*0.4;o[i]=lp*Math.exp(-t*3.2)*(i<400?i/400:1)*(1+0.3*Math.sin(t*7+ch));}}
   this.conv=c.createConvolver();this.conv.buffer=ir;const rg=c.createGain();rg.gain.value=0.9;this.conv.connect(rg);rg.connect(this.master);
   this.revSend=c.createGain();this.revSend.gain.value=0.3;this.sfx.connect(this.revSend);this.revSend.connect(this.conv);
   this.revSendV=c.createGain();this.revSendV.gain.value=0.12;this.voiceBus.connect(this.revSendV);this.revSendV.connect(this.conv);
  }catch(e){}
  return this.ctx;},
 setVol(){if(!this.ctx)return;this.master.gain.value=S.set.vol;this.mus.gain.value=S.set.music;this.voiceBus.gain.value=S.set.voiceVol;},
 setWet(v){if(this.revSend)this.revSend.gain.value=v;if(this.revSendV)this.revSendV.gain.value=v*0.4;},
 pan(x,y,z){const c=this.ctx;const p=c.createPanner();p.panningModel='HRTF';p.distanceModel='inverse';p.refDistance=1.6;p.maxDistance=80;p.rolloffFactor=1.5;if(p.positionX){p.positionX.value=x;p.positionY.value=y;p.positionZ.value=z;}else p.setPosition(x,y,z);return p;},
 listener(pos,fwd,up){const c=this.ctx;if(!c)return;const l=c.listener;if(l.positionX){l.positionX.value=pos.x;l.positionY.value=pos.y;l.positionZ.value=pos.z;l.forwardX.value=fwd.x;l.forwardY.value=fwd.y;l.forwardZ.value=fwd.z;l.upX.value=up.x;l.upY.value=up.y;l.upZ.value=up.z;}else{l.setPosition(pos.x,pos.y,pos.z);l.setOrientation(fwd.x,fwd.y,fwd.z,up.x,up.y,up.z);}},
 bank:{},bankReady:false,
 loadBank(){const self=this;fetch('audio/manifest.json').then(r=>r.ok?r.json():null).then(async m=>{if(!m||!m.clips)return;const c=self.init();if(!c)return;const names=Object.keys(m.clips);let n=0;for(const k of names){try{const ab=await (await fetch(m.clips[k].file)).arrayBuffer();self.bank[k]={buf:await c.decodeAudioData(ab),loop:!!m.clips[k].loop};n++;}catch(e){}}self.bankReady=n>0;console.log('audio bank: '+n+' clips');}).catch(()=>{});},
 /* play a recorded clip if the bank has it (name or name_1..n variants); returns false to let the synth run */
 play(name,pos,vol,o){o=o||{};let e=this.bank[name];if(!e){const v=[];for(let i=1;i<=4;i++)if(this.bank[name+'_'+i])v.push(this.bank[name+'_'+i]);if(!v.length)return false;e=v[Math.floor(Math.random()*v.length)];}
  const c=this.init();if(!c)return false;const s=c.createBufferSource();s.buffer=e.buf;s.loop=!!o.loop;s.playbackRate.value=(o.rate||1)*(o.noVar?1:0.94+Math.random()*0.12);const g=c.createGain();g.gain.value=vol===undefined?1:vol;let last=s;if(o.lp){const f=c.createBiquadFilter();f.type='lowpass';f.frequency.value=o.lp;s.connect(f);last=f;}last.connect(g);this._out(g,pos,o.dest);s.start();if(o.dur)s.stop(c.currentTime+o.dur);return o.loop?{s,g}:true;},
 _out(node,pos,dest){if(pos){const p=this.pan(pos.x,pos.y,pos.z);node.connect(p);p.connect(dest||this.sfx);}else node.connect(dest||this.sfx);},
 /* generic voice: osc with envelope, optional slide/vibrato/AM/filters */
 tone(f,dur,type,vol,pos,o){const c=this.init();if(!c)return null;o=o||{};const t0=c.currentTime;const osc=c.createOscillator(),g=c.createGain();osc.type=type||'sine';osc.frequency.setValueAtTime(f,t0);if(o.slide)osc.frequency.exponentialRampToValueAtTime(Math.max(1,o.slide),t0+dur);if(o.detune)osc.detune.value=o.detune;
  let last=osc;if(o.vib){const l=c.createOscillator();l.frequency.value=o.vibF||5.5;const lg=c.createGain();lg.gain.value=o.vib;l.connect(lg);lg.connect(osc.frequency);l.start(t0);l.stop(t0+dur+0.1);}
  if(o.am){const l=c.createOscillator();l.frequency.value=o.amF||30;const lg=c.createGain();lg.gain.value=o.am;const ag=c.createGain();ag.gain.value=1-o.am;l.connect(lg);lg.connect(ag.gain);last.connect(ag);last=ag;l.start(t0);l.stop(t0+dur+0.1);}
  if(o.hp){const h=c.createBiquadFilter();h.type='highpass';h.frequency.value=o.hp;last.connect(h);last=h;}
  if(o.lp){const l=c.createBiquadFilter();l.type='lowpass';l.frequency.value=o.lp;l.Q.value=o.q||0.7;if(o.lpEnd)l.frequency.exponentialRampToValueAtTime(o.lpEnd,t0+dur);last.connect(l);last=l;}
  const a=o.a||0.01,r=o.r||dur*0.6;g.gain.setValueAtTime(0.0001,t0);g.gain.exponentialRampToValueAtTime(Math.max(0.0002,vol||0.2),t0+a);g.gain.setValueAtTime(Math.max(0.0002,vol||0.2),t0+Math.max(a,dur-r));g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);last.connect(g);this._out(g,pos,o.dest);osc.start(t0);osc.stop(t0+dur+0.05);return {osc,g};},
 noise(dur,vol,pos,o){const c=this.init();if(!c)return null;o=o||{};const t0=c.currentTime;const s=c.createBufferSource();s.buffer=this.noiseBuf;s.loop=true;s.playbackRate.value=o.rate||1;const f=c.createBiquadFilter();f.type=o.type||'lowpass';f.frequency.setValueAtTime(o.f||800,t0);if(o.slideF)f.frequency.exponentialRampToValueAtTime(o.slideF,t0+dur);f.Q.value=o.q||0.7;const g=c.createGain();const a=o.a||0.01;g.gain.setValueAtTime(0.0001,t0);g.gain.exponentialRampToValueAtTime(Math.max(0.0002,vol||0.2),t0+a);g.gain.setValueAtTime(Math.max(0.0002,vol||0.2),t0+Math.max(a,dur-(o.r||dur*0.7)));g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);s.connect(f);f.connect(g);this._out(g,pos,o.dest);s.start(t0);s.stop(t0+dur+0.05);return {s,f,g};},
 /* formant voice: sawtooth through parallel bandpasses */
 voice(f0,dur,formants,vol,pos,o){const c=this.init();if(!c)return;o=o||{};const t0=c.currentTime;const src=c.createOscillator();src.type=o.type||'sawtooth';src.frequency.setValueAtTime(f0,t0);if(o.slide)src.frequency.exponentialRampToValueAtTime(Math.max(1,o.slide),t0+dur);
  if(o.vib){const l=c.createOscillator();l.frequency.value=o.vibF||6;const lg=c.createGain();lg.gain.value=o.vib;l.connect(lg);lg.connect(src.frequency);l.start(t0);l.stop(t0+dur+0.1);}
  let head=src;if(o.am){const l=c.createOscillator();l.type='sine';l.frequency.value=o.amF||28;const lg=c.createGain();lg.gain.value=o.am;const ag=c.createGain();ag.gain.value=1-o.am;l.connect(lg);lg.connect(ag.gain);src.connect(ag);head=ag;l.start(t0);l.stop(t0+dur+0.1);}
  const sum=c.createGain();for(const [ff,q,gg] of formants){const bp=c.createBiquadFilter();bp.type='bandpass';bp.frequency.value=ff;bp.Q.value=q;const fg=c.createGain();fg.gain.value=gg;head.connect(bp);bp.connect(fg);fg.connect(sum);}
  if(o.breath){const n=c.createBufferSource();n.buffer=this.noiseBuf;n.loop=true;const bf=c.createBiquadFilter();bf.type='bandpass';bf.frequency.value=formants[0][0]*1.5;bf.Q.value=1.2;const ng=c.createGain();ng.gain.value=o.breath;n.connect(bf);bf.connect(ng);ng.connect(sum);n.start(t0);n.stop(t0+dur+0.05);}
  const g=c.createGain();const a=o.a||0.05;g.gain.setValueAtTime(0.0001,t0);g.gain.exponentialRampToValueAtTime(Math.max(0.0002,vol),t0+a);g.gain.setValueAtTime(Math.max(0.0002,vol),t0+Math.max(a,dur*0.6));g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);sum.connect(g);this._out(g,pos,o.dest);src.start(t0);src.stop(t0+dur+0.05);},
 metalClick(pos,vol,f){this.noise(0.05,vol||0.15,pos,{type:'bandpass',f:f||(2500+Math.random()*2500),q:8,a:0.002});},
 /* ---- footsteps by surface ---- */
 step(vol,pos,crouch,mat){mat=mat||'concrete';const v=vol*(crouch?0.4:1);const r=0.9+Math.random()*0.2;if(this.play('step_'+mat,pos,v*1.3))return;
  if(mat==='metal'){this.noise(0.08,v*0.9,pos,{f:900*r,type:'bandpass',q:2,a:0.003});this.tone(180*r,0.28,'triangle',v*0.35,pos,{lp:1600,r:0.25});this.tone(1300*r,0.12,'sine',v*0.12,pos);}
  else if(mat==='gravel'){this.noise(0.14,v*1.1,pos,{f:2200*r,type:'highpass',a:0.004,r:0.12});this.noise(0.08,v*0.5,pos,{f:600,type:'lowpass'});}
  else if(mat==='wet'){this.noise(0.13,v*0.9,pos,{f:500*r,type:'lowpass',slideF:1400,a:0.01});this.tone(220*r,0.09,'sine',v*0.2,pos,{slide:90});this.noise(0.06,v*0.4,pos,{f:3500,type:'highpass',a:0.002});}
  else{this.noise(0.09,v,pos,{f:crouch?300:560*r,type:'lowpass',a:0.004});this.tone(70+Math.random()*30,0.08,'sine',v*0.55,pos);this.noise(0.03,v*0.25,pos,{f:2800,type:'highpass',a:0.001});}},
 pickup(pos){if(this.play('pickup',pos,0.6))return;this.tone(520,0.08,'triangle',0.12,pos);this.tone(780,0.1,'triangle',0.1,pos);this.noise(0.06,0.08,pos,{f:2000,type:'highpass'});},
 drop(vol,pos,mat){if(this.play(mat==='metal'?'impact_metal':'impact_soft',pos,vol))return;this.noise(0.12,vol,pos,{f:mat==='metal'?1400:400,type:mat==='metal'?'bandpass':'lowpass',q:mat==='metal'?3:0.7});this.tone(mat==='metal'?300:90,0.18,'sine',vol*0.8,pos,{slide:mat==='metal'?180:40});},
 impact(vol,pos,mat){if(this.play(mat==='metal'?'impact_metal':'impact_soft',pos,vol))return;this.noise(0.18,vol,pos,{f:mat==='metal'?1600:900,type:mat==='metal'?'bandpass':'lowpass',q:mat==='metal'?2:0.7});this.tone(mat==='metal'?260:120,0.25,'square',vol*0.45,pos,{slide:mat==='metal'?120:30,lp:600});if(mat==='metal')this.tone(1700,0.4,'sine',vol*0.15,pos,{r:0.38});},
 shatter(pos){if(this.play('shatter',pos,0.9))return;for(let i=0;i<9;i++)setTimeout(()=>this.tone(1600+Math.random()*3000,0.12+Math.random()*0.1,'sine',0.1,pos,{r:0.1}),i*22);this.noise(0.45,0.4,pos,{f:5000,type:'highpass'});this.noise(0.2,0.3,pos,{f:900});},
 rattle(pos,t){const n=Math.min(9,Math.round((t||0.6)*9));for(let i=0;i<n;i++)setTimeout(()=>{this.metalClick(pos,0.09+Math.random()*0.05,1400+Math.random()*1600);if(i%3===1)this.tone(80,0.12,'triangle',0.16,pos,{lp:260});},i*(65+Math.random()*40));},
  door(pos,slam){if(this.play(slam?'door_slam':'door_creak',pos,slam?0.9:0.5))return;if(slam){this.impact(0.8,pos);this.noise(0.35,0.45,pos,{f:300});this.tone(60,0.4,'square',0.3,pos,{lp:200,slide:35});for(let i=0;i<4;i++)setTimeout(()=>this.metalClick(pos,0.08,1800+Math.random()*1200),60+i*45);}
  else{const c=this.init();if(!c)return;const f=110+Math.random()*80;this.tone(f,0.7,'sawtooth',0.035,pos,{slide:f*1.6,lp:900,vib:12,vibF:9,a:0.12,r:0.3});this.noise(0.5,0.1,pos,{f:250,a:0.1});this.metalClick(pos,0.1,3000);}},
 ui(k){if(this.play('ui_'+k,null,0.5,{noVar:true}))return;if(k==='click'){this.tone(900,0.05,'square',0.05);}else if(k==='ok'){this.tone(660,0.08,'triangle',0.12);this.tone(990,0.14,'triangle',0.1);}else if(k==='bad'){this.tone(220,0.2,'sawtooth',0.1,null,{slide:110,lp:800});}else if(k==='cash'){for(let i=0;i<5;i++)setTimeout(()=>this.tone(880+i*160,0.1,'triangle',0.1),i*60);}},
 radioClick(){if(this.play('radio_click',null,0.6))return;this.noise(0.05,0.25,null,{f:3000,type:'bandpass',q:2});this.tone(1200,0.04,'square',0.06);},
 radioStatic(dur,vol){if(this.play('radio_static',null,vol,{dur}))return null;return this.noise(dur,vol,null,{f:2200,type:'bandpass',q:0.5,a:0.05});},
 alarm(){if(this.play('alarm',null,0.5,{noVar:true}))return;for(let i=0;i<3;i++)setTimeout(()=>{this.tone(620,0.35,'square',0.07,null,{lp:1400});this.tone(624,0.35,'sawtooth',0.03,null,{lp:1400});setTimeout(()=>this.tone(480,0.35,'square',0.07,null,{lp:1400}),380);},i*800);},
 thunder(delay){setTimeout(()=>{if(this.play('thunder',null,0.8))return;this.noise(2.6,0.55,null,{f:180,a:0.05,r:2.2,slideF:60});this.tone(38,2.2,'sine',0.4,null,{r:2});this.noise(0.4,0.35,null,{f:900,a:0.01});for(let i=0;i<3;i++)setTimeout(()=>this.noise(0.6,0.2,null,{f:120+Math.random()*100,a:0.05}),400+i*350);},(delay||0)*1000);},
 sting(kind,pos){if(this.play('sting_'+kind,null,0.9))return;if(kind==='scare'){this.voice(280,1.1,[[700,6,1],[1250,7,0.7],[2900,8,0.45]],0.5,null,{slide:1100,vib:40,vibF:11,breath:0.5,a:0.02});this.noise(1.3,0.5,null,{f:220,a:0.02});this.tone(48,1.6,'sawtooth',0.4,null,{slide:26,lp:260});this.tone(2400,0.5,'sawtooth',0.1,null,{slide:500,lp:3000});}
  else if(kind==='hit'){this.noise(0.25,0.5,null,{f:600});this.tone(80,0.3,'square',0.3,null,{slide:35,lp:400});this.voice(180,0.35,[[600,5,1],[1100,6,0.5]],0.2,null,{slide:120,breath:0.4});}
  else if(kind==='down'){this.tone(200,1.5,'sine',0.3,null,{slide:40});this.noise(1.5,0.2,null,{f:150});this.heartbeatOnce(0.5);}
  else if(kind==='revive'){this.tone(330,0.4,'triangle',0.15);this.tone(440,0.4,'triangle',0.15);setTimeout(()=>this.tone(660,0.6,'triangle',0.15),300);}},
 heartbeatOnce(v){if(this.play('heartbeat',null,v*2.2))return;this.tone(52,0.14,'sine',v,null,{slide:30});setTimeout(()=>this.tone(48,0.16,'sine',v*0.8,null,{slide:28}),190);},
 /* ---- creature voices ---- */
 creature(kind,pos,i){i=i||1;const map={echo:['echo_hum','echo_whisper'],crawler:['crawler_skitter'],scratch:['crawler_chitter','crawler_skitter'],lighteater:['lighteater_throb','lighteater_gurgle'],window:['window_ring'],hound:['hound_growl'],hound_bark:['hound_bark'],stack:['stack_creak'],drifter:['drifter_chime'],warden:['warden_roar'],chains:['warden_chains'],laugh:['laugh'],ring:['phone_ring'],pipe:['pipe_groan'],scream:['scream_distant'],whisper:['echo_whisper'],sob:['mourner_sob'],mourner_scream:['mourner_scream'],hanger:['hanger_creak'],hanger_drop:['hanger_drop'],collector:['collector_chitter'],sleeper_breath:['sleeper_breath'],sleeper_roar:['sleeper_roar'],mimic:['mimic_skitter'],mimic_snap:['mimic_snap'],swarm:['swarm_buzz'],burrower_rumble:['burrower_rumble'],burrower_burst:['burrower_burst'],twin:['twin_hum'],twin_shriek:['twin_shriek']}[kind];
  if(map){const nm=map[Math.floor(Math.random()*map.length)];if(this.play(nm,pos,Math.min(1.5,0.8*i)))return;}
  switch(kind){
  case 'echo':{const f=150+Math.random()*90;this.voice(f,1.4,[[420,7,1],[900,8,0.6],[2400,9,0.25]],0.12*i,pos,{vib:6,vibF:4.5,breath:0.12,a:0.3,type:'sawtooth'});setTimeout(()=>this.noise(0.9,0.06*i,pos,{f:2200,type:'bandpass',q:2,slideF:600,a:0.2}),700);break;}
  case 'crawler':{for(let k=0;k<12;k++)setTimeout(()=>this.noise(0.03,0.22*i,pos,{f:3500+Math.random()*2500,type:'highpass',a:0.002}),k*45+Math.random()*20);this.tone(900,0.5,'square',0.035*i,pos,{vib:250,vibF:22,lp:2600});this.voice(420,0.4,[[1200,8,1],[2600,9,0.6]],0.08*i,pos,{slide:900,vib:80,vibF:15});break;}
  case 'scratch':for(let k=0;k<4;k++)setTimeout(()=>this.noise(0.11,0.22*i,pos,{f:2400+Math.random()*1200,type:'bandpass',q:1.6,a:0.02}),k*150);break;
  case 'lighteater':this.tone(36,1.6,'sine',0.35*i,pos,{am:0.7,amF:5,r:1.2});this.noise(1.2,0.16*i,pos,{f:140,a:0.3});for(let k=0;k<5;k++)setTimeout(()=>this.noise(0.12,0.12*i,pos,{f:400+Math.random()*500,type:'bandpass',q:3,a:0.01}),200+k*170+Math.random()*80);break;
  case 'window':this.tone(1180,2.4,'sine',0.02*i,pos,{a:0.9,r:1.2});this.tone(1183,2.4,'sine',0.02*i,pos,{a:0.9,r:1.2});break;
  case 'hound':this.voice(58,0.9,[[240,5,1],[620,6,0.6],[1300,7,0.25]],0.25*i,pos,{am:0.6,amF:26,vib:4,vibF:3,breath:0.25,a:0.08});this.noise(0.5,0.16*i,pos,{f:700,a:0.05});break;
  case 'hound_bark':this.voice(160,0.22,[[500,5,1],[1100,6,0.6],[2200,8,0.3]],0.35*i,pos,{slide:90,breath:0.4,a:0.01});break;
  case 'stack':this.tone(140,0.6,'sawtooth',0.12*i,pos,{slide:200,lp:900,vib:14,vibF:8,a:0.05});this.noise(0.3,0.25*i,pos,{f:900});for(let k=0;k<3;k++)setTimeout(()=>this.noise(0.12,0.2*i,pos,{f:500+k*300,type:'bandpass',q:2}),150+k*110);break;
  case 'drifter':{const base=880+Math.random()*400;for(const m of [1,1.5,2.02,2.98])this.tone(base*m,1.1,'sine',0.03*i/m,pos,{a:0.25,r:0.8,vib:3,vibF:2});break;}
  case 'warden':this.voice(38,1.6,[[160,4,1],[420,5,0.6],[900,6,0.2]],0.4*i,pos,{am:0.5,amF:14,breath:0.3,a:0.1});this.noise(1.4,0.22*i,pos,{f:200,a:0.2,slideF:80});for(let k=0;k<6;k++)setTimeout(()=>this.metalClick(pos,0.14*i,2000+Math.random()*3000),k*70);break;
  case 'sob':this.voice(240+Math.random()*60,0.5,[[600,6,1],[1100,7,0.5],[2600,9,0.2]],0.09*i,pos,{slide:180,vib:25,vibF:7,breath:0.35,a:0.06});setTimeout(()=>this.noise(0.35,0.05*i,pos,{f:1800,type:'bandpass',q:2,a:0.15}),400);setTimeout(()=>this.voice(210,0.3,[[600,6,1],[1100,7,0.5]],0.06*i,pos,{slide:150,breath:0.4}),700);break;
  case 'mourner_scream':this.voice(520,2.2,[[900,6,1],[1500,7,0.8],[3200,8,0.5]],0.5*i,pos,{slide:1400,vib:70,vibF:12,breath:0.5,a:0.03});this.noise(2,0.3*i,pos,{f:2500,type:'bandpass',q:1,a:0.05});this.tone(45,2,'sawtooth',0.3*i,null,{lp:200});break;
  case 'hanger':this.tone(90+Math.random()*40,1.2,'sawtooth',0.04*i,pos,{vib:9,vibF:1.6,lp:700,a:0.3});this.noise(0.8,0.05*i,pos,{f:400,a:0.3,slideF:900});break;
  case 'hanger_drop':this.noise(0.3,0.5*i,pos,{f:900,slideF:200,a:0.005});this.tone(70,0.4,'sine',0.5*i,pos,{slide:30});this.voice(300,0.5,[[800,6,1],[1900,7,0.6]],0.25*i,pos,{slide:140,breath:0.5});break;
  case 'collector':for(let k=0;k<6;k++)setTimeout(()=>this.voice(700+Math.random()*400,0.08,[[1500,8,1],[2800,9,0.6]],0.07*i,pos,{slide:1200,a:0.005}),k*90);for(let k=0;k<4;k++)setTimeout(()=>this.tone(2400+Math.random()*2000,0.12,'sine',0.04*i,pos,{r:0.1}),200+k*70);break;
  case 'sleeper_breath':this.noise(2.6,0.14*i,pos,{f:260,a:1.1,r:1.3,slideF:120});this.tone(30,2.6,'sine',0.18*i,pos,{a:1,r:1.2});break;
  case 'sleeper_roar':this.voice(48,2.4,[[180,4,1],[380,5,0.7],[820,6,0.3]],0.55*i,pos,{slide:70,am:0.5,amF:11,breath:0.35,a:0.15});this.noise(2,0.3*i,pos,{f:300,a:0.2,slideF:100});this.tone(34,2.4,'sawtooth',0.35*i,null,{lp:150});break;
  case 'laugh':for(let k=0;k<7;k++)setTimeout(()=>this.voice(220+Math.random()*120,0.13,[[800,6,1],[1300,7,0.6],[2800,8,0.3]],0.09*i,pos,{slide:160,breath:0.2,a:0.01}),k*125);break;
  case 'ring':for(let k=0;k<3;k++)setTimeout(()=>{this.tone(1000,0.25,'square',0.05,pos,{lp:2000,am:0.5,amF:25});this.tone(1300,0.25,'square',0.04,pos,{lp:2000,am:0.5,amF:25});},k*400);break;
  case 'pipe':this.tone(300+Math.random()*300,1.1,'sine',0.12*i,pos,{slide:140,vib:9,vibF:5,a:0.05});this.impact(0.3*i,pos,'metal');break;
  case 'scream':this.voice(420,1.3,[[800,6,1],[1400,7,0.7],[3000,8,0.35]],0.14*i,pos,{slide:900,vib:60,vibF:9,breath:0.4,a:0.05});break;
  case 'whisper':this.noise(1.4,0.06*i,pos,{f:2600,type:'bandpass',q:3,slideF:1200,a:0.3});for(let k=0;k<5;k++)setTimeout(()=>this.noise(0.09,0.05*i,pos,{f:1800+Math.random()*2000,type:'bandpass',q:4}),200+k*180);break;
  case 'chains':for(let k=0;k<8;k++)setTimeout(()=>this.metalClick(pos,0.1*i,1800+Math.random()*3500),k*55+Math.random()*40);break;
 }},
 creatureStep(kind,pos){if(kind==='warden'&&this.play('warden_stomp',pos,0.9))return;if(kind==='warden'){this.noise(0.25,0.7,pos,{f:260,a:0.005});this.tone(42,0.5,'sine',0.7,pos,{slide:26});this.creature('chains',pos,0.6);}
  else if(kind==='hound'){this.noise(0.06,0.3,pos,{f:900,a:0.003});this.noise(0.03,0.15,pos,{f:3000,type:'highpass'});}
  else if(kind==='echo'){this.noise(0.12,0.22,pos,{f:420,a:0.01});this.tone(60,0.12,'sine',0.15,pos);}
  else if(kind==='stack'){this.noise(0.07,0.3,pos,{f:1200,type:'bandpass',q:2});}
  else if(kind==='crawler'){this.noise(0.03,0.2,pos,{f:4000,type:'highpass',a:0.002});}},
 /* ---- ambience beds + scheduled one-shots ---- */
 amb(kind){this.stopAmb();const c=this.init();if(!c)return;this.ambKind=kind;const bed=this.play('amb_'+kind,null,0.0001,{loop:true,noVar:true});if(bed){bed.g.gain.exponentialRampToValueAtTime(0.35,c.currentTime+3);this.ambNodes.push(bed.s,bed.g);this.ambGain=bed.g;this.ambT=3+Math.random()*4;return;}const g=c.createGain();g.gain.value=0.0001;g.connect(this.sfx);g.gain.exponentialRampToValueAtTime(0.14,c.currentTime+3);
  const s=c.createBufferSource();s.buffer=this.noiseBuf;s.loop=true;const f=c.createBiquadFilter();f.type='lowpass';f.frequency.value={rain:1800,water:500,wind:300,space:120,music:250,hum:220,static:3200}[kind]||220;s.connect(f);f.connect(g);s.start();this.ambNodes.push(s,g);
  const o=c.createOscillator();o.type='sine';o.frequency.value=kind==='space'?38:kind==='hum'?50:kind==='music'?110:60;const og=c.createGain();og.gain.value=kind==='music'?0.03:0.05;o.connect(og);og.connect(g);o.start();this.ambNodes.push(o);
  if(kind==='hum'){const o2=c.createOscillator();o2.type='sawtooth';o2.frequency.value=100;const g2=c.createGain();g2.gain.value=0.012;const lp=c.createBiquadFilter();lp.type='lowpass';lp.frequency.value=400;o2.connect(lp);lp.connect(g2);g2.connect(g);o2.start();this.ambNodes.push(o2);}
  if(kind==='wind'){const lfo=c.createOscillator();lfo.frequency.value=0.09;const lg=c.createGain();lg.gain.value=500;lfo.connect(lg);lg.connect(f.frequency);lfo.start();this.ambNodes.push(lfo);}
  if(kind==='music'){const o2=c.createOscillator();o2.type='triangle';o2.frequency.value=165;const g2=c.createGain();g2.gain.value=0.02;const lfo=c.createOscillator();lfo.frequency.value=0.7;const lg=c.createGain();lg.gain.value=0.02;lfo.connect(lg);lg.connect(g2.gain);o2.connect(g2);g2.connect(g);o2.start();lfo.start();this.ambNodes.push(o2,lfo);}
  this.ambGain=g;this.ambT=3+Math.random()*4;},
 stopAmb(){for(const n of this.ambNodes){try{n.stop?n.stop():0;n.disconnect();}catch(e){}}this.ambNodes=[];this.ambGain=null;this.ambKind=null;},
 ambOneShot(){const k=this.ambKind;if(!k||!G.map)return;const p=P.pos.clone();const a=Math.random()*TAU,d=6+Math.random()*16;p.x+=Math.sin(a)*d;p.z+=Math.cos(a)*d;p.y+=Math.random()*2;const r=Math.random();
  if(k==='water'){if(r<0.6){this.tone(1400+Math.random()*1500,0.12,'sine',0.05,p,{slide:600,a:0.002});}else this.noise(1.5,0.08,p,{f:400,a:0.5,slideF:900});}
  else if(k==='wind'){if(r<0.5)this.noise(2.5,0.1,p,{f:200+Math.random()*300,a:1,r:1.2,q:2,type:'bandpass'});else this.tone(180+Math.random()*120,1.4,'sine',0.04,p,{vib:8,vibF:2,a:0.4});}
  else if(k==='rain'){if(r<0.5)this.noise(0.9,0.07,p,{f:2500,type:'highpass',a:0.3});else this.tone(900+Math.random()*900,0.08,'sine',0.03,p,{slide:400});}
  else if(k==='space'){if(r<0.5)this.tone(60+Math.random()*40,2.5,'sine',0.08,p,{vib:2,vibF:0.6,a:0.8});else this.metalClick(p,0.12,400+Math.random()*600);}
  else if(k==='music'){const notes=[261,311,392,466,523];if(r<0.5)this.tone(pick(notes)*(Math.random()<0.5?1:2),0.9,'triangle',0.03,p,{a:0.01,r:0.7,vib:3,vibF:5});else this.creature('laugh',p,0.3);}
  else{if(r<0.35)this.creature('pipe',p,0.5);else if(r<0.6)this.noise(0.4,0.07,p,{f:120,a:0.02});else if(r<0.8)this.tone(120,0.6,'square',0.02,p,{lp:300,am:0.5,amF:50});else this.metalClick(p,0.1,1200+Math.random()*2000);}},
 /* ---- dynamic music ---- */
 musicSet(lvl){if(lvl>(this.music.target||0)+0.5&&lvl>=2&&this.ctx&&G.state==='play')this.riser();this.music.target=lvl;},
 riser(){const c=this.ctx;if(!c||this.music.riserT&&c.currentTime-this.music.riserT<12)return;this.music.riserT=c.currentTime;this.noise(2.4,0.12,null,{f:200,slideF:2500,a:2.0,r:0.3,dest:this.mus});this.tone(110,2.4,'sawtooth',0.05,null,{slide:220,lp:1500,a:1.8,dest:this.mus});},
 musicTick(dt){const c=this.ctx;if(!c)return;const m=this.music;if(m.target===undefined)m.target=0;
  if(!m.built){m.built=true;m.layers=[];const mk=(f,type,vol)=>{const o=c.createOscillator();o.type=type;o.frequency.value=f;const g=c.createGain();g.gain.value=0.0001;o.connect(g);g.connect(this.mus);o.start();return {o,g,vol};};
   m.layers.push(mk(55,'sine',0.16));m.layers.push(mk(82.4,'triangle',0.07));m.layers.push(mk(110,'sawtooth',0.045));m.layers.push(mk(233,'square',0.03));m.layers.push(mk(466,'sawtooth',0.028));
   /* pad: two detuned saws through a slow lowpass */const lp=c.createBiquadFilter();lp.type='lowpass';lp.frequency.value=500;m.lp=lp;for(const i of [2,3,4]){m.layers[i].g.disconnect();m.layers[i].g.connect(lp);}lp.connect(this.mus);
   const pad=c.createGain();pad.gain.value=0.0001;const plp=c.createBiquadFilter();plp.type='lowpass';plp.frequency.value=380;pad.connect(plp);plp.connect(this.mus);m.pad=pad;m.padOsc=[];for(const d of [-7,0,7]){const o=c.createOscillator();o.type='sawtooth';o.frequency.value=110;o.detune.value=d;o.connect(pad);o.start();m.padOsc.push(o);}
   m.pulseT=0;m.chordT=0;m.chord=0;}
  m.cur=lerp(m.cur,m.target,dt*0.6);const L=m.cur;m.t+=dt;
  const want=[L>=0.3?1:0,L>=1?1:0,L>=2?1:0,L>=3?1:0,L>=4?1:0];if(L>=6){want[0]=1;want[1]=1;want[2]=0;want[3]=0;want[4]=0;}
  for(let i=0;i<5;i++){const l=m.layers[i];const tv=want[i]*l.vol*(i===3?(0.5+0.5*Math.sin(m.t*(L>=4?14:8))):1)*(i===4?(0.5+0.5*Math.sin(m.t*3)):1);l.g.gain.value=lerp(l.g.gain.value,Math.max(0.0001,tv),dt*2);}
  m.layers[0].o.frequency.value=L>=6?65.4:55;m.layers[1].o.frequency.value=L>=6?98:82.4;m.layers[2].o.detune.value=Math.sin(m.t*0.5)*20;m.lp.frequency.value=lerp(m.lp.frequency.value,400+L*500,dt);
  /* pad chords drift: minor for tension, major on win */m.chordT-=dt;if(m.chordT<=0){m.chordT=9+Math.random()*7;m.chord=(m.chord+1)%4;}const roots=L>=6?[130.8,164.8,196,261.6]:[110,116.5,98,103.8];const base=roots[m.chord];m.padOsc[0].frequency.value=lerp(m.padOsc[0].frequency.value,base,dt*0.5);m.padOsc[1].frequency.value=lerp(m.padOsc[1].frequency.value,base*(L>=6?1.26:1.19),dt*0.5);m.padOsc[2].frequency.value=lerp(m.padOsc[2].frequency.value,base*1.5,dt*0.5);
  const padV=G.state==='play'?(L>=0.5?0.035+0.01*L:0.012):(G.state==='hub'?0.02:0.0001);m.pad.gain.value=lerp(m.pad.gain.value,Math.max(0.0001,padV),dt);
  if(L>=6){m.layers[3].o.frequency.value=[262,330,392,523][Math.floor(m.t*4)%4];m.layers[3].g.gain.value=0.05;}
  /* heartbeat when hunted */if(G.state==='play'&&(L>=3||(typeof P!=='undefined'&&P.hp<30&&!P.dead))){this.hb.t-=dt;if(this.hb.t<=0){this.hb.t=L>=4?0.55:0.8;this.heartbeatOnce(L>=4?0.3:0.18);}}
  /* ambient one-shots */if(this.ambKind&&G.state==='play'){this.ambT-=dt;if(this.ambT<=0){this.ambT=4+Math.random()*9;this.ambOneShot();}}
 }
};
document.addEventListener('pointerdown',()=>Aud.init(),{once:false});
document.addEventListener('keydown',()=>Aud.init(),{once:false});
