/* =====================================================================
   DEAD AIR — Recovery Services
   single-file co-op horror recovery sim · Three.js r128 + PeerJS
   ===================================================================== */
'use strict';
const $=id=>document.getElementById(id);
const clamp=(v,a,b)=>v<a?a:v>b?b:v, lerp=(a,b,t)=>a+(b-a)*t, TAU=Math.PI*2;
const dist2=(ax,az,bx,bz)=>Math.hypot(ax-bx,az-bz);
const fmt=n=>Math.round(n).toLocaleString('en-US');
const pick=(a,r)=>a[Math.floor((r||Math.random)()*a.length)];
const DEBUG=location.hash.indexOf('debug')>=0;
if(DEBUG)$('dbg').style.display='block';
/* seeded rng */
function mulberry(seed){let a=seed>>>0;return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function hashStr(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function rr(rng,a,b){return a+rng()*(b-a);}
function ri(rng,a,b){return a+Math.floor(rng()*(b-a+1));}
function wpick(list,rng,wfn){let tot=0;for(const x of list)tot+=wfn(x);let r=(rng||Math.random)()*tot;for(const x of list){r-=wfn(x);if(r<=0)return x;}return list[list.length-1];}

/* ---------------- save ---------------- */
const SAVE_KEY='deadair_v1';
const DEF_SAVE={credits:1500,baseLv:1,missions:0,extracts:0,deaths:0,best:0,totalLoot:0,
  up:{flash:1,pack:1,radio:1,boots:1,armor:0,medkit:0,sensor:0,flares:0,batt:0,camera:0},
  gear:{scanner:0,generator:0,beacon:0,crate:0,detector:0,mapper:0},
  cos:{head:0,hair:0,face:0,outfit:0,helmet:0,pack:0,acc:0,color:0,name:''},
  ach:{},stats:{doors:0,thrown:0,broken:0,screams:0,revives:0,docs:0,encounters:{},lost:0,abandoned:0,pings:0,distance:0,time:0,creaturesMet:{}},
  trophies:[],moments:[],lore:{},seenEvents:{},daily:{},tutorialDone:false,
  set:{sens:0.55,smooth:0.35,fov:80,vol:0.8,music:0.6,voiceVol:1,voiceMode:'va',micSens:0.06,micDetect:true,shake:1,flash:true,subs:true,bright:1,gfx:3,invertY:false,ptt:'KeyV',crouchToggle:false,textSize:1,colorblind:false,blur:true,vsync:true,showTips:true}};
let S=loadSave();if(S.set.smooth===undefined)S.set.smooth=0.35;if(S.set.tp===undefined)S.set.tp=false;if(!S.hints)S.hints={};if(!S.cosOwned)S.cosOwned={};if(S.prestige===undefined)S.prestige=0;if(S.ending===undefined)S.ending=false;if(S.set.voiceAuto===undefined)S.set.voiceAuto=true;if(S.set.skipHome===undefined)S.set.skipHome=false;if(!S.zeroBest)S.zeroBest=0;if(!S.stats.seenKinds)S.stats.seenKinds={};if(S.set.touch===undefined)S.set.touch=!!(navigator.maxTouchPoints>0&&window.matchMedia&&matchMedia('(pointer:coarse)').matches);if(S.set.gfx===2&&!S.set.gfxMig){S.set.gfx=3;S.set.gfxMig=true;}
function loadSave(){try{const d=JSON.parse(localStorage.getItem(SAVE_KEY)||'null');if(!d)return JSON.parse(JSON.stringify(DEF_SAVE));const m=JSON.parse(JSON.stringify(DEF_SAVE));deepMerge(m,d);return m;}catch(e){return JSON.parse(JSON.stringify(DEF_SAVE));}}
function deepMerge(t,s){for(const k in s){if(s[k]&&typeof s[k]==='object'&&!Array.isArray(s[k])&&t[k]&&typeof t[k]==='object'){deepMerge(t[k],s[k]);}else t[k]=s[k];}}
let saveT=0;
function save(){try{S.sig=sigOf(S);localStorage.setItem(SAVE_KEY,JSON.stringify(S));}catch(e){}}
function sigOf(s){return hashStr(String(s.credits)+'|'+s.baseLv+'|'+s.missions+'|'+JSON.stringify(s.up)+'|da-salt-1979');}
(function(){try{const d=JSON.parse(localStorage.getItem(SAVE_KEY)||'null');if(d&&d.sig!==undefined&&d.sig!==sigOf(S)){S.credits=Math.min(S.credits,DEF_SAVE.credits);S.up=JSON.parse(JSON.stringify(DEF_SAVE.up));S.baseLv=1;console.warn('save signature mismatch — progression reset');}}catch(e){}})();

/* ---------------- data: locations ---------------- */
const LAYER_NAMES=['SURFACE','BASEMENT','MAINTENANCE','RESEARCH','RESTRICTED','UNKNOWN'];
const LOCS=[
 {id:'annex',name:'Hollowbrook Research Annex',desc:'A shuttered agricultural research annex. Fungal contamination noted. Probably fine.',layers:3,size:9,danger:1,loot:1,minLv:1,pal:{wall:0x6c7a7d,floor:0x3d4447,ceil:0x2c3336,trim:0x8fa1a3,light:0xfff1d0},amb:'hum',props:['crate','desk','locker','shelf','barrel','chair']},
 {id:'hotel',tex:{wall:'plaster',floor:'wood'},name:'The Marrow Hotel',desc:'Twelve floors, seven of which exist. Guests reported "someone in the walls" the night it closed.',layers:3,size:10,danger:2,loot:1.15,minLv:1,pal:{wall:0x7a5c4a,floor:0x4a2f28,ceil:0x3a2a24,trim:0xc9a86a,light:0xffd9a0},amb:'wind',props:['bed','desk','chair','cart','locker','crate']},
 {id:'greywater',name:'Greywater Treatment Plant',desc:'Half-flooded. Pumps still run on power nobody is paying for.',layers:4,size:10,danger:2,loot:1.25,minLv:2,pal:{wall:0x4e6a6a,floor:0x2c3a3b,ceil:0x22302f,trim:0x7fa8a0,light:0xcfffe6},amb:'water',wet:true,props:['barrel','pipe','crate','tank','pallet','chair']},
 {id:'pinecrest',tex:{wall:'wood',floor:'wood'},name:'Pinecrest Field Station',desc:'Forestry research outpost. Last transmission was 40 seconds of breathing.',layers:3,size:9,danger:2,loot:1.2,minLv:2,pal:{wall:0x5a5a42,floor:0x3b3a2a,ceil:0x2b2b20,trim:0x9a8a55,light:0xfff6d6},amb:'rain',props:['desk','shelf','crate','cot','barrel','chair']},
 {id:'cinder',name:'Cinder Peak Laboratory',desc:'A mountain lab drilled into basalt. The elevator log stops at a floor that was never built.',layers:4,size:11,danger:3,loot:1.4,minLv:3,pal:{wall:0x505860,floor:0x2f3438,ceil:0x23282c,trim:0x8a9aa8,light:0xd8ecff},amb:'hum',props:['desk','tank','locker','crate','pipe','cabinet']},
 {id:'funland',tex:{wall:'stripes',floor:'concrete'},name:'Funland Below',desc:'The service tunnels under a defunct amusement park. The music still plays sometimes.',layers:4,size:11,danger:3,loot:1.45,minLv:3,pal:{wall:0x6a4a70,floor:0x3a2a40,ceil:0x2a1e30,trim:0xd88ad0,light:0xffb8f0},amb:'music',props:['cart','crate','mascot','barrel','chair','shelf']},
 {id:'saltmine',tex:{wall:'stone',floor:'concrete'},name:'Saltmine Township',desc:'A company town swallowed by its own mine. Population: unlisted.',layers:5,size:12,danger:4,loot:1.7,minLv:4,pal:{wall:0x8a7d66,floor:0x4a4236,ceil:0x36302a,trim:0xbda98a,light:0xffe4b0},amb:'wind',props:['crate','barrel','pallet','cot','shelf','chair']},
 {id:'verity',name:'St. Verity Hospital',desc:'Condemned after "the incident on ward nine". Records say there were only eight wards.',layers:5,size:12,danger:4,loot:1.8,minLv:4,pal:{wall:0x7d8a86,floor:0x3f4a48,ceil:0x2c3634,trim:0xb8c8c2,light:0xe4fff6},amb:'hum',props:['bed','cart','cabinet','locker','chair','crate']},
 {id:'site9',tex:{wall:'concrete',floor:'grate'},name:'Site 9',desc:'Underground military installation. Officially a grain silo. Unofficially a very deep grain silo.',layers:6,size:13,danger:5,loot:2.1,minLv:5,pal:{wall:0x4a4f52,floor:0x26292c,ceil:0x1c1f22,trim:0x7a8286,light:0xffcaa0},amb:'hum',props:['crate','locker','tank','pipe','cabinet','barrel']},
 {id:'orbital',name:'Orbital Relay Fragment',desc:'A chunk of a relay station that came down in the desert. Gravity inside is… negotiable.',layers:6,size:13,danger:5,loot:2.4,minLv:5,pal:{wall:0x3a4650,floor:0x1f272c,ceil:0x161c20,trim:0x6fd3ff,light:0xbfeaff},amb:'space',lowG:true,wet:true,props:['crate','tank','pipe','cabinet','pallet','desk']},
 {id:'school',tex:{wall:'plaster',floor:'tiles'},name:'Ashfall Primary School',desc:'Closed after the ash fall. The attendance register is still being filled in.',layers:3,size:10,danger:2,loot:1.1,minLv:1,pal:{wall:0x8c8a6a,floor:0x5a4a3a,ceil:0x3c3a30,trim:0x6fa86a,light:0xfff6dc},amb:'wind',props:['desk','chair','locker','cabinet','shelf','crate']},
 {id:'warehouse',tex:{wall:'panel',floor:'concrete'},name:'Warehouse 44',desc:'Forty-three other warehouses were never built. This one has enough shelving for all of them.',layers:3,size:14,danger:2,loot:1.3,minLv:2,pal:{wall:0x6a6560,floor:0x3a3835,ceil:0x2a2825,trim:0xd9a441,light:0xfff2d8},amb:'hum',props:['shelf','crate','pallet','barrel','cart','locker']},
 {id:'metro',tex:{wall:'tiles',floor:'concrete'},name:'Blackreach Metro',desc:'Three stations, one line, no trains for thirty years. The announcements still run.',layers:4,size:12,danger:3,loot:1.4,minLv:2,pal:{wall:0x5a5f66,floor:0x33373b,ceil:0x24272b,trim:0xc9b04a,light:0xfff0c8},amb:'hum',props:['pipe','barrel','debris','cart','crate','chair']},
 {id:'cannery',name:'Coldharbour Cannery',desc:'The tins are still sealed. Do not open the tins.',layers:4,size:11,danger:3,loot:1.35,minLv:3,pal:{wall:0x5e7378,floor:0x2f3d40,ceil:0x22302f,trim:0x9fc0c0,light:0xd8fff0},amb:'water',wet:true,props:['tank','barrel','crate','pallet','pipe','cart']},
 {id:'bunker',tex:{wall:'concrete',floor:'concrete'},name:'Mirefield Bunker',desc:'A drowned cold-war bunker. The doors were sealed from the inside.',layers:5,size:12,danger:4,loot:1.75,minLv:4,pal:{wall:0x4c5548,floor:0x2a2f28,ceil:0x1e221c,trim:0x8a9a70,light:0xe8ffd0},amb:'water',wet:true,props:['locker','cot','tank','crate','barrel','cabinet']},
 {id:'vestry',name:'The Vestry',desc:'A sunken church, and the catacombs the church was built to keep shut.',layers:6,size:12,danger:5,loot:2.2,minLv:5,pal:{wall:0x5a4e44,floor:0x2e2722,ceil:0x1f1a17,trim:0xb08a4a,light:0xffd090},amb:'wind',props:['cot','debris','cabinet','crate','chair','barrel'],tex:{wall:'stone',floor:'stone'}},
 {id:'zoo',name:'Brightwater Nocturnal House',desc:'The animals were relocated years ago. The enclosures still get fed.',layers:3,size:10,danger:2,loot:1.15,minLv:1,pal:{wall:0x4f5a48,floor:0x33382c,ceil:0x22261e,trim:0x8fb070,light:0xd8ffd8},amb:'rain',dark:true,tex:{wall:'stone',floor:'concrete'},props:['tank','debris','crate','barrel','cot','shelf']},
 {id:'mall',name:'Larkspur Galleria',desc:'A dead mall. The fountain runs backwards after midnight and the escalators only go down.',layers:3,size:14,danger:2,loot:1.2,minLv:1,pal:{wall:0x8c8478,floor:0x5a5248,ceil:0x3a3630,trim:0xe0b0c0,light:0xfff0e8},amb:'music',tex:{wall:'plaster',floor:'tiles'},props:['shelf','cart','mascot','chair','crate','pallet']},
 {id:'lighthouse',name:'Gannet Rock Light Station',desc:'The lamp still turns. Nobody has climbed the stairs to wind it since 1987.',layers:4,size:8,danger:2,loot:1.25,minLv:2,pal:{wall:0x7a6a5a,floor:0x4a3c30,ceil:0x33291f,trim:0xd0d0c0,light:0xffe8c0},amb:'water',wet:true,tex:{wall:'brick',floor:'wood'},props:['cot','crate','barrel','desk','chair','shelf']},
 {id:'ferry',name:'MV Halcyon',desc:'A car ferry that docked with no passengers and a full manifest. Still moored. Still rocking.',layers:4,size:9,danger:3,loot:1.5,minLv:2,pal:{wall:0x6a7480,floor:0x3c3228,ceil:0x2a2e34,trim:0xc8d8e8,light:0xe8f4ff},amb:'water',wet:true,tex:{wall:'panel',floor:'wood'},props:['bed','chair','cart','cabinet','crate','barrel']},
 {id:'theatre',name:'The Regent Theatre',desc:'Every seat sold out on opening night, 1962. Nobody left. The reviews were mixed.',layers:4,size:11,danger:3,loot:1.45,minLv:2,pal:{wall:0x6a2c30,floor:0x3a2420,ceil:0x2a1818,trim:0xd8b060,light:0xffd8a0},amb:'music',tex:{wall:'plaster',floor:'wood'},props:['chair','cabinet','cart','mascot','crate','shelf']},
 {id:'studio',name:'Channel 9 Broadcast House',desc:'The station went off air mid-sentence. The sentence has been finishing itself ever since.',layers:3,size:10,danger:3,loot:1.4,minLv:3,pal:{wall:0x44505c,floor:0x2c3038,ceil:0x1e2228,trim:0xff5a5a,light:0xd8e8ff},amb:'static',tex:{wall:'panel',floor:'tiles'},props:['desk','chair','terminal','cabinet','cart','crate']},
 {id:'icelab',name:'Tern Station',desc:'Antarctic research station, towed home in pieces. The last log entry is a drawing of the crew, with one extra person.',layers:4,size:10,danger:3,loot:1.5,minLv:3,pal:{wall:0x8aa0aa,floor:0x4a5a62,ceil:0x36444a,trim:0xdff4ff,light:0xe8f8ff},amb:'wind',cold:true,tex:{wall:'panel',floor:'grate'},props:['desk','locker','crate','cot','tank','cabinet']},
 {id:'observatory',name:'Halloway Observatory',desc:'The telescope is pointed at the ground. It has been pointed at the ground for a long time.',layers:4,size:9,danger:3,loot:1.5,minLv:3,pal:{wall:0x5a5666,floor:0x38343e,ceil:0x26232c,trim:0xb8a8ff,light:0xd0c8ff},amb:'space',dark:true,tex:{wall:'plaster',floor:'wood'},props:['desk','terminal','cabinet','chair','shelf','crate']},
 {id:'prison',name:'Blackwell Correctional',desc:'Every cell is locked. Every cell is empty. The headcount still comes up one over.',layers:4,size:12,danger:4,loot:1.6,minLv:3,pal:{wall:0x6a6a66,floor:0x3a3a38,ceil:0x28282a,trim:0xe08a30,light:0xfff0d0},amb:'hum',dark:true,tex:{wall:'brick',floor:'concrete'},props:['cot','locker','cabinet','chair','crate','debris']},
 {id:'oilrig',name:'Platform Kestrel-7',desc:'A decommissioned rig towed inshore for scrap. Something below the waterline is still drilling.',layers:5,size:9,danger:4,loot:1.8,minLv:4,pal:{wall:0x6a5040,floor:0x3a3230,ceil:0x2a2220,trim:0xffb020,light:0xffe0b0},amb:'wind',wet:true,tex:{wall:'rust',floor:'grate'},props:['tank','pipe','barrel','crate','locker','pallet']},
 {id:'reactor',name:'Kettleburn Reactor B',desc:'Shut down in a hurry. The counters in the control room still climb, and the control room is empty.',layers:5,size:12,danger:5,loot:2.2,minLv:5,pal:{wall:0x505a50,floor:0x2c342c,ceil:0x1e241e,trim:0x9aff60,light:0xd8ffc0},amb:'hum',fog:1.3,tex:{wall:'rust',floor:'grate'},props:['tank','pipe','terminal','barrel','locker','crate']},
 {id:'ossuary',name:'Saint Hollow Ossuary',desc:'Bones stacked to the ceiling on the upper floors. The lower floors are where the bones came from.',layers:6,size:11,danger:5,loot:2.3,minLv:5,pal:{wall:0x6a6050,floor:0x342e26,ceil:0x221e18,trim:0xd8c8a0,light:0xffd8a0},amb:'wind',dark:true,fog:1.4,tex:{wall:'stone',floor:'stone'},props:['debris','cot','cabinet','crate','barrel','chair']},
 {id:'zero',name:'Site Zero',desc:'The first site. The company built the other twenty-eight to bury it. Four generators keep something down there awake.',layers:4,size:11,danger:5,loot:2.0,minLv:5,pal:{wall:0x3a3236,floor:0x1f1a1c,ceil:0x151113,trim:0xc03030,light:0xffd0c0},amb:'static',dark:true,fog:1.25,tex:{wall:'concrete',floor:'grate'},props:['terminal','tank','pipe','cabinet','locker','crate'],zero:true},
];
const DIFFS={easy:{n:'EASY',mult:0.8,creat:0.6,supply:1.5,time:1.3,size:-1},normal:{n:'NORMAL',mult:1,creat:1,supply:1,time:1,size:0},hard:{n:'HARD',mult:1.3,creat:1.4,supply:0.7,time:0.85,size:0},extreme:{n:'EXTREME',mult:1.8,creat:2,supply:0.4,time:0.7,size:1},nightmare:{n:'NIGHTMARE',mult:2.5,creat:2.6,supply:0.3,time:0.6,size:2}};
const RARITY=['COMMON','UNCOMMON','RARE','EPIC','EXOTIC','UNKNOWN','CLASSIFIED'];
const RAR_W=[46,26,14,7,4,2,1];
/* size: 0 pocket, 1 one-hand, 2 two-hand, 3 two-player */
const ITEMS=[
 {n:'Broken Camera',ic:'📷',v:180,r:0,sz:0,w:0.6,frag:1,geo:'box',c:0x222222},
 {n:'Sample Vial',ic:'🧪',v:260,r:0,sz:0,w:0.3,frag:2,geo:'cyl',c:0x88ccaa,sample:true},
 {n:'Company Badge',ic:'🪪',v:120,r:0,sz:0,w:0.1,geo:'box',c:0xdddddd},
 {n:'Rusted Wrench',ic:'🔧',v:90,r:0,sz:1,w:2,geo:'box',c:0x884422},
 {n:'Old Ledger',ic:'📒',v:210,r:0,sz:0,w:0.8,geo:'box',c:0x553322},
 {n:'Coffee Tin (Full)',ic:'🥫',v:140,r:0,sz:0,w:0.9,geo:'cyl',c:0xaa3333},
 {n:'Odd Toy Rabbit',ic:'🐰',v:330,r:1,sz:0,w:0.4,geo:'sph',c:0xf0e0e0},
 {n:'Field Radio Husk',ic:'📻',v:420,r:1,sz:1,w:3,frag:1,geo:'box',c:0x334455},
 {n:'Brass Sextant',ic:'🧭',v:560,r:1,sz:1,w:1.5,frag:1,geo:'box',c:0xc9a040},
 {n:'Reel of Film',ic:'🎞',v:380,r:1,sz:0,w:0.7,geo:'cyl',c:0x777777},
 {n:'Mineral Cluster',ic:'💎',v:640,r:1,sz:1,w:4,geo:'sph',c:0x88aaff},
 {n:'Typewriter',ic:'⌨',v:520,r:1,sz:2,w:9,frag:1,geo:'box',c:0x333333},
 {n:'Sealed Specimen Jar',ic:'🫙',v:900,r:2,sz:1,w:3,frag:2,geo:'cyl',c:0x99ffcc,sample:true},
 {n:'Porcelain Doll',ic:'🪆',v:820,r:2,sz:1,w:1.2,frag:3,geo:'sph',c:0xffe8e0},
 {n:'Server Blade',ic:'💽',v:1100,r:2,sz:2,w:8,frag:1,geo:'box',c:0x224466},
 {n:'Grandfather Clock',ic:'🕰',v:1450,r:2,sz:3,w:26,frag:2,geo:'box',c:0x5a3a22},
 {n:'Bronze Bust',ic:'🗿',v:1300,r:2,sz:2,w:14,frag:1,geo:'sph',c:0x8a6a3a},
 {n:'Encrypted Drive',ic:'🔐',v:1600,r:3,sz:0,w:0.3,geo:'box',c:0x111111,drive:true},
 {n:'Marble Statue',ic:'🏛',v:2400,r:3,sz:3,w:34,frag:2,geo:'sph',c:0xe8e8e8},
 {n:'Reactor Coil',ic:'⚛',v:2100,r:3,sz:2,w:12,geo:'cyl',c:0x66ffdd,glow:true},
 {n:'Painting (Unsigned)',ic:'🖼',v:1900,r:3,sz:2,w:5,frag:2,geo:'box',c:0x44322a},
 {n:'Cryo Cell',ic:'🧊',v:3200,r:4,sz:3,w:38,frag:1,geo:'box',c:0xbbeeff,glow:true},
 {n:'Meteorite Core',ic:'☄',v:2900,r:4,sz:2,w:18,geo:'sph',c:0x553333,glow:true},
 {n:'Prototype Visor',ic:'🥽',v:2600,r:4,sz:0,w:0.5,frag:1,geo:'box',c:0x22ffaa,glow:true},
 {n:'Unlabeled Organ',ic:'🫀',v:3500,r:5,sz:1,w:2,frag:2,geo:'sph',c:0x992222,pulse:true,sample:true},
 {n:'Humming Cube',ic:'🔲',v:4200,r:5,sz:1,w:6,geo:'box',c:0x111133,glow:true,hum:true},
 {n:'Folded Map of Nowhere',ic:'🗺',v:3000,r:5,sz:0,w:0.2,geo:'box',c:0xd8c8a0},
 {n:'The Quiet Egg',ic:'🥚',v:6500,r:6,sz:2,w:10,frag:3,geo:'sph',c:0xf8f8f0,quiet:true},
 {n:'Director\'s Ledger',ic:'📕',v:5200,r:6,sz:0,w:1,geo:'box',c:0x330000},
 {n:'Anchor Fragment',ic:'⚓',v:9000,r:6,sz:3,w:44,geo:'box',c:0x224422,glow:true},
 /* cursed */
 {n:'Whispering Tape',ic:'📼',v:1200,r:3,sz:0,w:0.3,geo:'box',c:0x222222,curse:'tape'},
 {n:'The Watcher\'s Camera',ic:'📹',v:1800,r:4,sz:1,w:1.5,geo:'box',c:0x111111,curse:'watcher'},
 {n:'Laughing Mask',ic:'🎭',v:1500,r:3,sz:1,w:0.8,frag:1,geo:'sph',c:0xf0f0f0,curse:'mask'},
 {n:'The Black Phone',ic:'☎',v:2200,r:4,sz:1,w:2,geo:'box',c:0x050505,curse:'phone'},
 {n:'Empty Photo',ic:'🖼',v:900,r:3,sz:0,w:0.05,geo:'box',c:0xe8e8e8,curse:'photo'},
 {n:'The Red Key',ic:'🗝',v:700,r:4,sz:0,w:0.2,geo:'box',c:0xcc1111,curse:'redkey',key:true},
];
const CURSE_DESC={tape:'It plays back. Sometimes it plays back you.',watcher:'It records on its own. Look at the footage later. Or don\'t.',mask:'You will hear laughing. Nobody else will.',phone:'It rings. Answering is optional. Consequences are not.',photo:'Blank. For now.',redkey:'Opens red doors. Something can smell it.'};
/* team gear & shop */
const SHOP=[
 {id:'flash',n:'Flashlight',ic:'🔦',max:5,cost:[0,600,1300,2200,3600],lv:['Cheap torch','Brighter beam','Long battery','Wide beam','Tactical (attracts Light Eater)'],d:'Your only friend down there. Brighter beams also attract things.'},
 {id:'pack',n:'Backpack',ic:'🎒',max:4,cost:[0,900,2000,3800],lv:['2 pockets','3 pockets','4 pockets','5 pockets'],d:'More pockets for small loot.'},
 {id:'radio',n:'Radio',ic:'📻',max:4,cost:[0,700,1600,3000],lv:['Range 40m','Range 70m','Range 110m','Deep-band (works 2 floors down)'],d:'Push R to talk. Deeper levels chew signal.'},
 {id:'boots',n:'Soft Boots',ic:'👟',max:3,cost:[0,800,2200],lv:['Normal','Quiet','Silent-ish'],d:'Less footstep noise. Creatures that hunt by sound care.'},
 {id:'armor',n:'Padded Suit',ic:'🦺',max:3,cost:[1200,2600,4200],lv:['-15% damage','-30% damage','-45% damage, slower'],d:'Absorbs hits. Heavier at level 3.'},
 {id:'medkit',n:'Medkit',ic:'🩹',max:2,cost:[500,1400],lv:['1 use','2 uses'],d:'Hold H to patch yourself or a teammate. Consumed per mission.'},
 {id:'sensor',n:'Motion Sensor',ic:'📡',max:2,cost:[1500,3200],lv:['Pings creatures in 15m','25m + direction'],d:'Beeps faster as something approaches. It does not say what.'},
 {id:'flares',n:'Flares',ic:'🧨',max:3,cost:[400,900,1500],lv:['2 flares','4 flares','6 flares'],d:'Press F. Light, noise, and most creatures hate them.'},
 {id:'batt',n:'Spare Batteries',ic:'🔋',max:3,cost:[300,700,1200],lv:['1 spare','2 spares','3 spares'],d:'Press B to swap. Applies to flashlight and radio.'},
 {id:'camera',n:'Body Camera',ic:'🎥',max:1,cost:[2000],lv:['Records anomalies'],d:'Occasionally shows you things that are not there. Or are.'},
];
const GEAR=[
 {id:'scanner',n:'Motion Scanner Post',ic:'🛰',cost:4500,d:'Deployable. Reveals creature positions in 30m on the map for the whole team.'},
 {id:'generator',n:'Portable Generator',ic:'⚡',cost:6000,d:'Restores power to the current floor for 60 seconds. Loud. Very loud.'},
 {id:'beacon',n:'Emergency Beacon',ic:'🚨',cost:5000,d:'Once per mission: forces the extraction door open for 60s from anywhere.'},
 {id:'crate',n:'Storage Crate',ic:'📦',cost:3500,d:'Van holds 30% more loot value before overflow penalties.'},
 {id:'detector',n:'Creature Detector',ic:'👁',cost:7000,d:'Tells you which creatures are in the site before you leave the van.'},
 {id:'mapper',n:'Auto-Mapper',ic:'🗺',cost:5500,d:'Map reveals rooms 2 cells ahead and resists interference.'},
];
const BASE_LV=[{n:'Basic Garage',cost:0,d:'A van and a dream.'},{n:'Equipment Room',cost:5000,d:'Unlocks Tier 2 sites and Padded Suit.'},{n:'Research Laboratory',cost:12000,d:'Unlocks Tier 3 sites and artifact appraisal (+8% loot value).'},{n:'Artifact Storage',cost:24000,d:'Unlocks Tier 4 sites, trophy wall, and team gear.'},{n:'Command Center',cost:45000,d:'Unlocks Tier 5 sites, Nightmare mode, and the Deep-band radio.'}];
const COS={head:['Round','Square','Long','Tiny'],hair:['Buzz','Mop','Ponytail','Bald','Mohawk','Beanie','Afro','Bun','Long','Braids'],face:['Neutral','Grin','Worried','Mustache','Goggles','Bandana','Gas Mask','Hockey Mask','Shades','Monocle','Clown Nose','Eyepatch','Beard','Company Mask'],outfit:['Company Coveralls','Old Explorer','Hazmat Suit','Expedition Gear','Office Casual','Pajamas','Tuxedo','Knight Armor','Hoodie','Company Suit'],helmet:['None','Hard Hat','Oversized Safety Helmet','Miner Lamp','Colander','Traffic Cone','Top Hat','Crown','Cat Ears','Devil Horns','Halo','Party Hat','Space Helmet','Viking Helm','Chef Hat','Bucket Hat'],pack:['Standard','Ridiculous Backpack','Duffel','Tiny Purse','Propane Tank','Jetpack','Coffin','Teddy Bear','Toy Rocket'],acc:['None','Glow-stick Necklace','Lanyard','Fanny Pack','Scarf','Rubber Duck','Cape','Bat Wings','Bow Tie','Medal','Gold Chain','Devil Tail','Company Badge'],color:[0xd9a441,0x4fa3d9,0xd94f4f,0x6fd96f,0xd96fd0,0xe8e8e8,0x8a6a3a,0x5fd3c4,0x1a1a1e,0xffffff,0xf07a1a,0x7a3fd9,0x2e8b57,0xc0392b,0x1f4e79,0xffd700]};
const ACH=[
 {id:'first',n:'CLOCKED IN',d:'Complete your first expedition.',i:'🕘'},
 {id:'ending',n:'PART OF US',d:'Shut The Signal down at Site Zero.',i:'◆'},
 {id:'deep',n:'ARE WE SURE?',d:'Enter the deepest floor of a site.',i:'🕳'},
 {id:'nope',n:'NOPE.',d:'Extract within 30 seconds of meeting a major creature.',i:'🏃'},
 {id:'team',n:'TEAMWORK!',d:'Complete a mission with no damage taken by anyone.',i:'🤝'},
 {id:'broke',n:'WHO BROKE THAT?',d:'Destroy an item worth over 1,500 credits.',i:'💥'},
 {id:'heard',n:'I HEARD SOMETHING.',d:'Survive an encounter with an UNKNOWN entity.',i:'👂'},
 {id:'leave',n:'WE SHOULD LEAVE.',d:'Extract with an item worth over 5,000 credits.',i:'💰'},
 {id:'onemore',n:'ONE MORE ROOM.',d:'Stay after the emergency extraction warning and still get out.',i:'🚪'},
 {id:'quiet',n:'SHHH.',d:'Extract from a site with The Echo without it ever locating you.',i:'🤫'},
 {id:'dark',n:'LIGHTS OFF.',d:'Spend 60 seconds with your flashlight off in one mission.',i:'🌑'},
 {id:'rich',n:'PAYDAY.',d:'Bank 20,000 credits in one mission.',i:'🏦'},
 {id:'revive',n:'GET UP.',d:'Revive a teammate.',i:'🩹'},
 {id:'phone',n:'HELLO?',d:'Answer the Black Phone.',i:'☎'},
 {id:'window',n:'DON\'T LOOK.',d:'Survive The Man in the Window reaching your room.',i:'🪟'},
 {id:'thrown',n:'YEET.',d:'Throw 50 objects across your career.',i:'🤾'},
 {id:'tutorial',n:'ORIENTATION',d:'Complete the training facility.',i:'📋'},
 {id:'intern',n:'THE INTERN',d:'Meet him.',i:'☕'},
 {id:'lore5',n:'READER',d:'Recover 5 different documents.',i:'📄'},
];
const LORE=[
 {id:'ferry1',t:'MV HALCYON — PURSER\'S NOTE',b:'Manifest says 212 passengers, 14 crew. Cars on deck: 61.\n\nWe have 0 passengers, 0 crew, and 61 cars with the engines running.\n\nI have turned off 60 of them. I cannot find the last one.'},
 {id:'tern1',t:'TERN STATION — CREW LOG, DAY 212',b:'Morale fine. Weather fine. Drew the crew for the wall again.\n\nSix of us. I drew seven. Pemberton says I always draw seven. Pemberton says there have always been seven.\n\nThere are six bunks.'},
 {id:'ch9',t:'CHANNEL 9 — CONTINUITY SCRIPT (FINAL)',b:'...and that is all from us tonight. Join us tomorrow at\n\n[the rest of the page is filled with the word "at", in the same handwriting, getting smaller]'},
 {id:'blackwell',t:'BLACKWELL CORRECTIONAL — NIGHT COUNT',b:'Block A: 40 / 40.\nBlock B: 40 / 40.\nBlock C: 41 / 40.\n\nRecounted C. 41 / 40.\nRecounted C with lights on. 40 / 40.\nRecounted C with lights off. 41 / 40.\n\nLeaving the lights on.'},
 {id:'memo1',t:'INTERNAL MEMO — RE: TERMINOLOGY',b:'Please stop calling them "hauntings" on the intake forms. The correct term is ENVIRONMENTAL VALUE ANOMALY. Legal has been very clear about this.\n\nAlso: the coffee machine on 3 is not "possessed". It is unplugged.\n\n— Facilities'},
 {id:'memo2',t:'CREW ROSTER — TEAM 14',b:'Delgado (lead)\nOkafor\nPruitt\nMars\n\nStatus: OVERDUE (day 12)\nEquipment recovered: 1 radio (transmitting), 0 personnel.\n\nNote from dispatch: the radio has been transmitting Pruitt\'s voice for nine days. Pruitt was not carrying the radio.'},
 {id:'memo3',t:'SAFETY BULLETIN #7',b:'If you hear a teammate calling you from a room you have not visited, confirm over radio BEFORE approaching.\n\nIf they confirm over radio, confirm again.\n\nIf they confirm a third time and you are still not sure, that is the correct feeling. Leave.'},
 {id:'memo4',t:'ACQUISITIONS — Q3 PRIORITY LIST',b:'1. Any object that hums without a power source\n2. Photographs that develop after the fact\n3. Keys (red)\n4. Anything the previous team dropped on the way out\n\nDo NOT prioritize personnel recovery over item 4. This is a business.'},
 {id:'memo5',t:'ELEVATOR INSPECTION LOG',b:'Floors serviced: B1, B2, B3.\nFloors visited by car during test: B1, B2, B3, B3, B3, B3, B3, B3, B3, B3, B3, B3, [illegible], B3.\n\nCertified safe.'},
 {id:'memo6',t:'TRANSCRIPT — CHANNEL 2 (partial)',b:'[static]\n"—found the freezer room. There\'s a guy in here."\n"Is he alive?"\n"He\'s standing up."\n"That\'s not what I asked."\n[static, 40s]\n"He\'s standing up in the next room now."\n[end of recording]'},
 {id:'memo7',t:'DEAD AIR RECOVERY SERVICES — ONBOARDING (p. 9)',b:'WHY "DEAD AIR"?\n\nOur founder noticed that in every site worth recovering, there is a frequency on which nothing is broadcast. Not silence — dead air. A carrier with no signal.\n\nWe tune to it. That\'s how we find the sites.\n\nWe do not discuss what tunes back.'},
 {id:'memo8',t:'INCIDENT REPORT — LIGHT EATER (designation L-E)',b:'Subject consumed 41 fluorescent tubes, 2 flashlights, 1 exit sign and an employee\'s watch (illuminated dial).\n\nEmployee unharmed. Employee\'s watch was on employee\'s wrist. Employee did not notice.\n\nRecommendation: darkness.'},
 {id:'memo9',t:'NOTE (handwritten, taped inside locker)',b:'if you are reading this you are on the restricted level and you should not be\n\nthe room that looks like the break room is not the break room\n\nthe vending machine is the door\n\ndo not buy anything'},
 {id:'memo10',t:'PAYROLL ADJUSTMENT',b:'Employees who return without their assigned partner will have 40% of contract value withheld pending an interview.\n\nEmployees who return with a partner who was not assigned to them should report to Screening immediately and should not remove their gloves.'},
 {id:'memo11',t:'RESEARCH SUMMARY — THE ECHO (E-1)',b:'It does not have a voice of its own. It learned Delgado\'s first. Then all of Team 14. Now it uses whoever is loudest.\n\nIt cannot mimic a voice it has not heard.\n\nWe are not sure it needs to.'},
 {id:'memo12',t:'THE LAST PAGE',b:'The company has recovered 11,406 anomalous objects.\n\nIt has never sold one.\n\nThe credits are real. The buyer is the company. The warehouse is the deepest floor of every site we send you to.\n\nWe are not recovering things. We are moving them further down.\n\n— D.'},
];
const EVENT_DEFS=[
 {id:'lightsout',w:10,minStage:2,d:'Lights fail'},
 {id:'flicker',w:14,minStage:1,d:'Flashlight flickers'},
 {id:'radio',w:12,minStage:1,d:'Unknown transmission'},
 {id:'ownvoice',w:6,minStage:2,d:'Own voice heard'},
 {id:'objmove',w:10,minStage:1,d:'Objects shift'},
 {id:'lowg',w:5,minStage:2,d:'Gravity changes'},
 {id:'fakeexit',w:5,minStage:3,d:'Fake extraction signal'},
 {id:'alarm',w:7,minStage:3,d:'Emergency alarm'},
 {id:'lockdown',w:8,minStage:2,d:'Lockdown'},
 {id:'goldroom',w:6,minStage:1,d:'Room becomes valuable'},
 {id:'mapglitch',w:7,minStage:2,d:'Map interference'},
 {id:'elevator',w:5,minStage:2,d:'Elevator moves'},
 {id:'doorslam',w:12,minStage:1,d:'Door slams'},
 {id:'distant',w:16,minStage:1,d:'Distant noise'},
 {id:'creature',w:9,minStage:2,d:'A creature appears'},
 {id:'intern',w:0.4,minStage:1,d:'The Intern'},
];
const CREATURES={
 echo:{n:'The Echo',ic:'🗣',major:true,threat:3,d:'Listens. Learns voices. Uses them.'},
 crawler:{n:'The Crawler',ic:'🕷',major:true,threat:3,d:'Lives in the vents. Hates crowds. Loves loners.'},
 lighteater:{n:'The Light Eater',ic:'🌑',major:true,threat:2,d:'Comes for the light. Turn it off. Good luck.'},
 window:{n:'The Man in the Window',ic:'🪟',major:true,threat:2,d:'Never attacks. Almost never.'},
 hound:{n:'Hollow Hound',ic:'🐕',major:false,threat:2,d:'Hunts by sound. It bites, then backs off: that pause is your window. Light in its eyes makes it run. Throw something and it chases that instead of you.'},
 stack:{n:'The Stack',ic:'📦',major:false,threat:1,d:'Looks like loot. Is not loot.'},
 drifter:{n:'Drifters',ic:'🪼',major:false,threat:1,d:'Floating spores. Blind you on contact. Throw things at them.'},
 mourner:{n:'The Mourner',ic:'😭',major:false,threat:2,d:'Kneels and weeps. Keep your distance, or everything in the building hears about it.'},
 hanger:{n:'The Hanger',ic:'🪢',major:false,threat:2,d:'Hangs from the ceiling like a sack. Walk under it and it takes you. Throw something at it.'},
 collector:{n:'The Collector',ic:'🎒',major:false,threat:1,d:'Steals loose loot and drags it to a nest. It will rob the van if nobody is watching.'},
 sleeper:{n:'The Sleeper',ic:'😴',major:true,threat:4,d:'Sleeps on a pile of treasure on the deepest floor. Noise and light wake it. Do not wake it.'},
 mimic:{n:'The Mimic',ic:'🧰',major:false,threat:2,d:'Looks like a strongbox worth a fortune. Bites the hand that grabs it, then chases. Throw something at it and it runs off to hide again.'},
 swarm:{n:'The Swarm',ic:'🪰',major:false,threat:1,d:'Gnats. Thousands. They go for the light. Switch your flashlight OFF (F) and walk away, or they will eat your battery and your eyes.'},
 burrower:{n:'The Burrower',ic:'🕳',major:true,threat:3,d:'Lives under the floor. It feels footsteps. Sprinting is a dinner bell. Stand still or crouch and it loses you.'},
 twin:{n:'The Twin',ic:'🧍',major:true,threat:4,d:'Wears your face and waves. Do not stare at it. Do not let it get close. Do not wave back. Back away.'},
 warden:{n:'The Warden',ic:'⛓',major:true,threat:5,d:'Arrives when the site collapses. Doors slow it. Nothing stops it.'},
};
/* the 34 v4 wearables are earned; originals stay free */
const COS_UNLOCK={Hair_Afro:{ach:'first'},Hair_Bun:{ach:'quiet'},Hair_Long:{ach:'lore5'},Hair_Braids:{ach:'docs'},Face_GasMask:{ach:'dark'},Face_Hockey:{ach:'broke'},Face_Clown:{ach:'phone'},Face_Eyepatch:{ach:'nope'},Face_Beard:{ach:'onemore'},Helmet_CatEars:{ach:'thrown'},Helmet_Horns:{ach:'angry'},Helmet_Party:{ach:'team'},Helmet_Viking:{ach:'doors'},Helmet_Bucket:{ach:'noflash'},Pack_Coffin:{ach:'leave'},Pack_Teddy:{ach:'tutorial'},Acc_Cape:{ach:'all'},Acc_Wings:{ach:'window'},Acc_Bowtie:{ach:'nobreak'},Acc_Medal:{ach:'heard'},
 Outfit_Tux:{cost:4000},Outfit_Knight:{cost:6000},Outfit_Hoodie:{cost:2500},Acc_Chain:{cost:3000},Helmet_TopHat:{cost:3500},Face_Shades:{cost:1500},Helmet_Chef:{cost:2000},Pack_Rocket:{cost:3000},
 Acc_Tail:{drop:true},Helmet_Halo:{drop:true},Helmet_Crown:{drop:true},Pack_Jetpack:{drop:true},Face_Monocle:{drop:true},Helmet_Astro:{drop:true},Outfit_Company:{ending:true},Face_Company:{ending:true},Acc_Badge:{ending:true}};
const PRESTIGE_TITLES=['','Veteran','Foreman','Site Lead','Director','Founder'];
const PRESTIGE_PERKS=[{n:'Second wind',d:'+15% stamina'},{n:'Company radio',d:'Your radio battery never dies'},{n:'Soft boots',d:'Your footsteps are 20% quieter'},{n:'Deep pockets',d:'+1 pocket slot'},{n:'Flare stash',d:'+2 flares every run'}];
function perk(n){return (S.prestige||0)>=n;}
const ECOSYSTEMS=[['echo','crawler'],['lighteater','echo'],['window','crawler'],['hound','stack','drifter'],['echo','hound'],['warden'],['drifter','stack','window'],['lighteater','hound'],[],['crawler','stack'],['echo','window','drifter'],['hound','drifter'],['mourner','hound'],['hanger','crawler'],['collector','echo'],['sleeper'],['collector','hanger','drifter'],['mourner','lighteater','stack'],['sleeper','collector'],['hanger','window'],['collector','hound','mourner'],['mimic','hound'],['swarm','lighteater'],['burrower','echo'],['twin','window'],['mimic','swarm','collector'],['burrower','twin'],['swarm','drifter','stack'],['mimic','hanger'],['twin','crawler'],['burrower','mimic','drifter']];
const OBJECTIVES=[
 {id:'quota',n:q=>'Recover at least '+fmt(q)+' cr of material'},
 {id:'researcher',n:()=>'Find the missing researcher (recover the tag)'},
 {id:'power',n:()=>'Restore power at the main generator'},
 {id:'artifact',n:a=>'Recover the '+a},
 {id:'drive',n:()=>'Retrieve the encrypted hard drive'},
 {id:'samples',n:()=>'Collect 3 biological samples'},
 {id:'beacon',n:()=>'Activate the extraction beacon'},
 {id:'signal',n:()=>'Shut The Signal down: four generators, in order'},
];
const OPTIONALS=[{id:'nodie',n:'Nobody goes down',b:0.25},{id:'all',n:'All players return',b:0.15},{id:'docs',n:'Recover 2 documents',b:0.12},{id:'nobreak',n:'Break nothing',b:0.1},{id:'classified',n:'Recover a CLASSIFIED item',b:0.35},{id:'deep',n:'Reach the deepest floor',b:0.2}];
const WEEKLY=[{id:'noflash',n:'Blackout Week',d:'No flashlights. Flares only.'},{id:'heavy',n:'Heavy Week',d:'Gravity +50%. Everything is heavier.'},{id:'double',n:'Double Time',d:'Double loot value, half the time.'},{id:'angry',n:'Bad Mood',d:'All creatures aggressive.'},{id:'static',n:'Static Week',d:'Radios barely work.'},{id:'doors',n:'Random Doors',d:'Doors open and close on their own.'}];
const PING_TYPES=[{k:'loc',n:'HERE',i:'📍',c:'#ffffff'},{k:'loot',n:'LOOT',i:'💰',c:'#ffb347'},{k:'monster',n:'MONSTER',i:'👹',c:'#ff4d4d'},{k:'exit',n:'EXIT',i:'🚪',c:'#7ddc7d'},{k:'danger',n:'DANGER',i:'⚠',c:'#ff8a4d'},{k:'key',n:'KEY',i:'🗝',c:'#6fb6ff'},{k:'no',n:'DO NOT GO',i:'⛔',c:'#ff4d4d'}];

