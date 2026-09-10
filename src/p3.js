function edgeKeyG(a,b,c,d){return a<c||(a===c&&b<d)?a+','+b+'|'+c+','+d:c+','+d+'|'+a+','+b;}
/* ================= PROCEDURAL SITE GENERATION ================= */
const CELL=6,WALL_H=3.4,LAYER_GAP=9,DOOR_W=1.1,BLAST_W=2.4;
const layerY=k=>-k*LAYER_GAP;
const T_VOID=0,T_ROOM=1,T_CORR=2,T_STAIR=3,T_YARD=4,T_ELEV=5;
const DIRS=[[1,0],[0,1],[-1,0],[0,-1]];
const ROOM_TYPES=['hall','lab','storage','office','break','freezer','archive','ward','pump','vault'];
function pickRoomType(rng,k,L){const r=rng();if(k>=L-2&&r<0.12)return 'vault';return pick(['hall','lab','storage','office','break','freezer','archive','ward','pump'],rng);}
function genMap(seed,loc,diff,opts){
  opts=opts||{};const rng=mulberry(seed);
  const W=clamp(Math.round((loc.size+(diff.size||0)+1)*1.22),12,19),H=W,L=opts.layers||loc.layers;
  const map={seed,loc,diff,W,H,L,layers:[],stairs:[],elev:null,van:null,exit:null,gen:null,hatch:null,items:[],docs:[],props:[],lights:[],vents:[],windows:[],doors:[],specials:{}};
  const idx=(x,z)=>z*W+x, inb=(x,z)=>x>=0&&z>=0&&x<W&&z<H;
  const cx=Math.floor(W/2);
  for(let k=0;k<L;k++)map.layers.push({k,cells:new Uint8Array(W*H),room:new Int16Array(W*H).fill(-1),rooms:[],req:[],walls:[],blocked:new Set(),doors:[],stairAt:{},ends:[]});
  const reserved=(k,x,z)=>map.layers[k].cells[idx(x,z)]!==T_VOID;
  /* ---- 1. reserve yard ---- */
  {const lay=map.layers[0];for(let z=H-2;z<H;z++)for(let x=Math.max(0,cx-3);x<=Math.min(W-1,cx+3);x++){lay.cells[idx(x,z)]=T_YARD;}}
  /* ---- 2. reserve stair shafts (3 cells, both layers) ---- */
  for(let k=0;k<L-1;k++){const A=map.layers[k],B=map.layers[k+1];const want=W>=13?2:1;let made=0;
    const combos=[];for(let z=1;z<H-1;z++)for(let x=1;x<W-1;x++)for(const d of DIRS)combos.push([x,z,d]);
    for(let i=combos.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));const t=combos[i];combos[i]=combos[j];combos[j]=t;}
    for(const [x,z,d] of combos){if(made>=want)break;let ok=true;const cells=[];
      for(let i=-1;i<=3&&ok;i++){const xx=x+d[0]*i,zz=z+d[1]*i;if(!inb(xx,zz)||(zz>=H-3&&k===0)){ok=false;break;}
        if(i>=0&&i<=2){if(reserved(k,xx,zz)||reserved(k+1,xx,zz)){ok=false;break;}cells.push([xx,zz]);}
        else{const ca=A.cells[idx(xx,zz)],cb=B.cells[idx(xx,zz)];if(ca===T_STAIR||ca===T_YARD||cb===T_STAIR){ok=false;break;}}}
      if(!ok)continue;
      for(const [xx,zz] of cells){for(let dz=-1;dz<=1&&ok;dz++)for(let dx=-1;dx<=1;dx++){const nx=xx+dx,nz=zz+dz;if(!inb(nx,nz))continue;if(A.cells[idx(nx,nz)]===T_STAIR||B.cells[idx(nx,nz)]===T_STAIR){ok=false;break;}}}
      if(!ok)continue;
      const st={k,x,z,dx:d[0],dz:d[1],id:'st'+map.stairs.length};
      for(const [xx,zz] of cells){A.cells[idx(xx,zz)]=T_STAIR;B.cells[idx(xx,zz)]=T_STAIR;A.stairAt[idx(xx,zz)]=st;B.stairAt[idx(xx,zz)]=st;}
      A.ends.push([x-d[0],z-d[1]]);B.ends.push([x+d[0]*3,z+d[1]*3]);map.stairs.push(st);made++;}
  }
  /* ---- 3. reserve elevator column ---- */
  if(L>=3){const combos=[];for(let z=1;z<H-4;z++)for(let x=1;x<W-3;x++)combos.push([x,z]);for(let i=combos.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));const t=combos[i];combos[i]=combos[j];combos[j]=t;}
    for(const [x,z] of combos){let ok=true;for(let k=0;k<L;k++){if(reserved(k,x,z)||reserved(k,x+1,z)){ok=false;break;}if(map.layers[k].ends.some(e=>(e[0]===x||e[0]===x+1)&&e[1]===z)){ok=false;break;}}if(!ok)continue;map.elev={x,z,wx:(x+0.5)*CELL,wz:(z+0.5)*CELL};for(let k=0;k<L;k++){map.layers[k].cells[idx(x,z)]=T_ELEV;map.layers[k].cells[idx(x+1,z)]=T_CORR;map.layers[k].ends.push([x+1,z]);}break;}}
  /* ---- 4. rooms ---- */
  for(let k=0;k<L;k++){const lay=map.layers[k];const nRooms=Math.floor(W*H/15)+1;let tries=0;
    while(lay.rooms.length<nRooms&&tries<900){tries++;
      const w=ri(rng,2,W>=13?4:3),h=ri(rng,2,3),x=ri(rng,0,W-w),z=ri(rng,0,H-h);
      if(k===0&&z+h>H-3)continue;
      let ok=true;
      for(let zz=z;zz<z+h&&ok;zz++)for(let xx=x;xx<x+w;xx++){if(lay.cells[idx(xx,zz)]!==T_VOID){ok=false;break;}}
      if(!ok)continue;
      for(let zz=z-1;zz<=z+h&&ok;zz++)for(let xx=x-1;xx<=x+w;xx++){if(!inb(xx,zz))continue;const c=lay.cells[idx(xx,zz)];if(c===T_STAIR||c===T_ELEV){ok=false;break;}}
      if(!ok)continue;
      const id=lay.rooms.length;
      lay.rooms.push({id,x,z,w,h,k,type:pickRoomType(rng,k,L),cx:(x+w/2)*CELL,cz:(z+h/2)*CELL,seen:false,gold:false});
      for(let zz=z;zz<z+h;zz++)for(let xx=x;xx<x+w;xx++){lay.cells[idx(xx,zz)]=T_ROOM;lay.room[idx(xx,zz)]=id;}
    }
    if(lay.rooms.length<2){for(let z=0;z<H-3&&lay.rooms.length<2;z++)for(let x=0;x<W-1&&lay.rooms.length<2;x++){if(lay.cells[idx(x,z)]===T_VOID&&lay.cells[idx(x+1,z)]===T_VOID){const id=lay.rooms.length;lay.rooms.push({id,x,z,w:2,h:1,k,type:'hall',cx:(x+1)*CELL,cz:(z+0.5)*CELL});lay.cells[idx(x,z)]=T_ROOM;lay.cells[idx(x+1,z)]=T_ROOM;lay.room[idx(x,z)]=id;lay.room[idx(x+1,z)]=id;}}}
  }
  /* ---- 5. corridors ---- */
  function nearestRoomCell(lay,x,z,excl){let best=null,bd=1e9;for(const r of lay.rooms){if(r===excl)continue;const rx=clamp(x,r.x,r.x+r.w-1),rz=clamp(z,r.z,r.z+r.h-1);const d=Math.abs(rx-x)+Math.abs(rz-z);if(d<bd){bd=d;best=[rx,rz];}}return best;}
  function carvePath(lay,sx,sz,tx,tz,xf){
    const pts=[];let x=sx,z=sz;const xfirst=xf===undefined?rng()<0.5:xf;
    const stepX=()=>{while(x!==tx){x+=Math.sign(tx-x);pts.push([x,z]);}},stepZ=()=>{while(z!==tz){z+=Math.sign(tz-z);pts.push([x,z]);}};
    pts.push([x,z]);if(xfirst){stepX();stepZ();}else{stepZ();stepX();}
    let px=sx,pz=sz;
    for(const [cx2,cz2] of pts){if(!inb(cx2,cz2))continue;const i=idx(cx2,cz2);const c=lay.cells[i];
      if(c===T_STAIR||c===T_ELEV||c===T_YARD){px=cx2;pz=cz2;continue;}
      if(c===T_VOID){lay.cells[i]=T_CORR;lay.room[i]=-1;}
      if(px!==cx2||pz!==cz2){const a=idx(px,pz);if(inb(px,pz)&&lay.room[a]!==lay.room[i]&&lay.cells[a]!==T_STAIR&&lay.cells[a]!==T_ELEV&&lay.cells[a]!==T_YARD)lay.req.push([px,pz,cx2,cz2]);}
      px=cx2;pz=cz2;}
  }
  for(let k=0;k<L;k++){const lay=map.layers[k];
    const order=lay.rooms.slice().sort((a,b)=>a.x-b.x);
    for(let i=0;i<order.length-1;i++){const a=order[i],b=order[i+1];carvePath(lay,ri(rng,a.x,a.x+a.w-1),ri(rng,a.z,a.z+a.h-1),ri(rng,b.x,b.x+b.w-1),ri(rng,b.z,b.z+b.h-1));}
    for(let i=0;i<Math.max(1,Math.floor(order.length/3));i++){const a=pick(order,rng),b=pick(order,rng);if(a!==b)carvePath(lay,ri(rng,a.x,a.x+a.w-1),ri(rng,a.z,a.z+a.h-1),ri(rng,b.x,b.x+b.w-1),ri(rng,b.z,b.z+b.h-1));}
    for(const [ex,ez] of lay.ends){if(!inb(ex,ez))continue;if(lay.cells[idx(ex,ez)]===T_VOID){lay.cells[idx(ex,ez)]=T_CORR;lay.room[idx(ex,ez)]=-1;}const n=nearestRoomCell(lay,ex,ez);if(n)carvePath(lay,ex,ez,n[0],n[1]);}
  }
  {const lay=map.layers[0];const ex=cx,ez=H-3;if(lay.cells[idx(ex,ez)]===T_VOID){lay.cells[idx(ex,ez)]=T_CORR;lay.room[idx(ex,ez)]=-1;}
    const n=nearestRoomCell(lay,ex,ez);carvePath(lay,ex,ez,n[0],n[1]);
    map.exit={x:(ex+0.5)*CELL,z:(ez+1)*CELL,cx:ex,cz:ez,rot:0,open:1,target:1,locked:false,blast:true,id:'exit',k:0};
    map.van={x:(cx+0.5)*CELL,z:(H-1)*CELL+1.5,rot:0};
    map.spawn={x:(cx+0.5)*CELL,z:(H-2)*CELL+1.2,k:0};}
  /* ---- 5b. connectivity repair: every room and every stair/elevator end must be reachable from the yard ---- */
  for(let iter=0;iter<14;iter++){const reach=reachFrom(map,0,map.spawn.x,map.spawn.z);let fixed=false;
    for(let k=0;k<L;k++){const lay=map.layers[k];const targets=lay.rooms.map(r=>[r.x,r.z]).concat(lay.ends.filter(e=>inb(e[0],e[1])));
      for(const [tx,tz] of targets){if(reach.has(k*W*H+idx(tx,tz)))continue;const srcs=[];
        for(let z=0;z<H;z++)for(let x=0;x<W;x++){const i=idx(x,z);const t=lay.cells[i];if(t!==T_ROOM&&t!==T_CORR)continue;if(!reach.has(k*W*H+i))continue;srcs.push([Math.abs(x-tx)+Math.abs(z-tz)+rng()*0.5,x,z]);}
        srcs.sort((a,b)=>a[0]-b[0]);const best=srcs[Math.min(srcs.length-1,Math.floor(iter/2))];
        if(best){carvePath(lay,best[1],best[2],tx,tz,iter%2===0);fixed=true;}}}
    if(!fixed)break;}
  /* ---- 6. walls, doors, windows ---- */
  let doorId=0;
  function edgeKey(a,b,c,d){return a<c||(a===c&&b<d)?a+','+b+'|'+c+','+d:c+','+d+'|'+a+','+b;}
  function addWallPieces(lay,wx,wz,rot,gap,k,kind){const side=(CELL-gap)/2;const off=side/2+gap/2;
    if(rot===1){lay.walls.push({x:wx,z:wz-off,rot,len:side,k});lay.walls.push({x:wx,z:wz+off,rot,len:side,k});if(kind==='win')lay.walls.push({x:wx,z:wz,rot,len:gap,k,win:true});}
    else{lay.walls.push({x:wx-off,z:wz,rot,len:side,k});lay.walls.push({x:wx+off,z:wz,rot,len:side,k});if(kind==='win')lay.walls.push({x:wx,z:wz,rot,len:gap,k,win:true});}}
  for(let k=0;k<L;k++){const lay=map.layers[k];
    const reqSet=new Set(lay.req.map(r=>edgeKey(r[0],r[1],r[2],r[3])));const roomDoorCount={};
    for(let z=0;z<H;z++)for(let x=0;x<W;x++){const c=lay.cells[idx(x,z)];if(c===T_VOID)continue;
      for(let d=0;d<4;d++){const nx=x+DIRS[d][0],nz=z+DIRS[d][1];const n=inb(nx,nz)?lay.cells[idx(nx,nz)]:T_VOID;
        const wx=(x+0.5+DIRS[d][0]*0.5)*CELL,wz=(z+0.5+DIRS[d][1]*0.5)*CELL,rot=d%2===0?1:0;
        const W_=()=>{lay.walls.push({x:wx,z:wz,rot,len:CELL,k});if(n!==T_VOID&&inb(nx,nz))lay.blocked.add(edgeKey(x,z,nx,nz));};
        if(c===T_STAIR||n===T_STAIR){if(c===T_STAIR&&n===T_STAIR)continue;if(n!==T_VOID&&idx(nx,nz)<idx(x,z))continue;
          const st=c===T_STAIR?lay.stairAt[idx(x,z)]:lay.stairAt[idx(nx,nz)];const ddx=c===T_STAIR?DIRS[d][0]:-DIRS[d][0],ddz=c===T_STAIR?DIRS[d][1]:-DIRS[d][1];
          const other=c===T_STAIR?n:c;const along=ddx*st.dx+ddz*st.dz;
          const open=other!==T_VOID&&other!==T_YARD&&((k===st.k&&along<0)||(k===st.k+1&&along>0));
          if(!open)W_();continue;}
        if(n===T_VOID){if(c===T_YARD)continue;
          const isWin=c===T_ROOM&&rng()<0.14;
          if(isWin){addWallPieces(lay,wx,wz,rot,1.4,k,'win');map.windows.push({x:wx,z:wz,k,nx:DIRS[d][0],nz:DIRS[d][1],rot});}else W_();continue;}
        if(c===T_YARD&&n!==T_YARD){if(x===map.exit.cx&&nz===map.exit.cz){addWallPieces(lay,wx,wz,rot,BLAST_W,k,'blast');lay.doors.push(map.exit);map.doors.push(map.exit);}else W_();continue;}
        if(n===T_YARD)continue;
        if(idx(nx,nz)<idx(x,z))continue;
        if(c===T_ELEV||n===T_ELEV){const isFront=(c===T_ELEV&&d===0)||(n===T_ELEV&&d===2);if(!isFront)W_();continue;}
        const rc=lay.room[idx(x,z)],rn=lay.room[idx(nx,nz)];
        if(rc===rn)continue;
        const key=edgeKey(x,z,nx,nz);let door=reqSet.has(key);
        const rid=rc>=0?rc:rn;
        if(!door){roomDoorCount[rid]=roomDoorCount[rid]||0;if(rng()<0.22&&roomDoorCount[rid]<3)door=true;}
        if(door){roomDoorCount[rid]=(roomDoorCount[rid]||0)+1;const room=lay.rooms[rid],room2=rn>=0&&rc>=0?lay.rooms[rn]:null;
          const locked=(room&&room.type==='vault')||(room2&&room2.type==='vault');
          const dObj={id:'d'+k+'_'+(doorId++),x:wx,z:wz,rot,k,open:locked?0:(rng()<0.35?1:0),target:0,locked:!!locked,red:!!locked,jam:false,broken:false,cells:[[x,z],[nx,nz]]};
          dObj.target=dObj.open;lay.doors.push(dObj);map.doors.push(dObj);addWallPieces(lay,wx,wz,rot,DOOR_W,k,'door');}
        else W_();
      }}
  }
  /* ---- 6b. physical connectivity: walls are real now, so search through them from the reached area to any sealed room/stair end and punch doors along the way ---- */
  const punch=(lay,k,x,z,nx,nz)=>{const d=DIRS.findIndex(v=>v[0]===nx-x&&v[1]===nz-z);if(d<0)return;const ek=edgeKey(x,z,nx,nz);if(!lay.blocked.has(ek))return;
    const wx=(x+0.5+DIRS[d][0]*0.5)*CELL,wz=(z+0.5+DIRS[d][1]*0.5)*CELL,rot=d%2===0?1:0;
    const wi=lay.walls.findIndex(w=>Math.abs(w.x-wx)<0.01&&Math.abs(w.z-wz)<0.01&&w.rot===rot&&w.len===CELL);if(wi>=0)lay.walls.splice(wi,1);
    lay.blocked.delete(ek);const dObj={id:'d'+k+'_'+(doorId++),x:wx,z:wz,rot,k,open:1,target:1,locked:false,red:false,jam:false,broken:false,cells:[[x,z],[nx,nz]]};lay.doors.push(dObj);map.doors.push(dObj);addWallPieces(lay,wx,wz,rot,DOOR_W,k,'door');};
  const plain=(lay,x,z)=>{const c=lay.cells[idx(x,z)];return c===T_ROOM||c===T_CORR;};
  for(let iter=0;iter<60;iter++){const reach=reachFrom(map,0,map.spawn.x,map.spawn.z);let fixed=false;
    for(let k=0;k<L&&!fixed;k++){const lay=map.layers[k];const isTarget=new Set();
      for(const r of lay.rooms){const i=idx(r.x,r.z);if(!reach.has(k*W*H+i))isTarget.add(i);}
      for(const e of lay.ends||[]){if(inb(e[0],e[1])){const i=idx(e[0],e[1]);if(!reach.has(k*W*H+i)&&plain(lay,e[0],e[1]))isTarget.add(i);}}
      if(!isTarget.size)continue;
      /* BFS over plain cells of this layer, starting from every reached plain cell, ignoring walls */
      const prev=new Map();const q=[];for(let z=0;z<H;z++)for(let x=0;x<W;x++){const i=idx(x,z);if(reach.has(k*W*H+i)&&plain(lay,x,z)){prev.set(i,-1);q.push(i);}}
      let hit=-1,qi=0;while(qi<q.length&&hit<0){const cur=q[qi++];const cx=cur%W,cz=Math.floor(cur/W);for(const dd of DIRS){const nx=cx+dd[0],nz=cz+dd[1];if(!inb(nx,nz)||!plain(lay,nx,nz))continue;const ni=idx(nx,nz);if(prev.has(ni))continue;prev.set(ni,cur);if(isTarget.has(ni)){hit=ni;break;}q.push(ni);}}
      if(hit<0)continue;
      let cur=hit;while(prev.get(cur)>=0){const p=prev.get(cur);punch(lay,k,p%W,Math.floor(p/W),cur%W,Math.floor(cur/W));cur=p;}fixed=true;}
    if(!fixed)break;}
  /* ---- 7. vents, lights, props, loot, docs ---- */
  _darkLoc=!!loc.dark;
  const lootMult=(diff.mult||1)*(loc.loot||1);
  for(let k=0;k<L;k++){const lay=map.layers[k];
    for(let z=0;z<H;z++)for(let x=0;x<W;x++){const c=lay.cells[idx(x,z)];if(c===T_VOID||c===T_YARD||c===T_STAIR||c===T_ELEV)continue;const wx=(x+0.5)*CELL,wz=(z+0.5)*CELL;
      if(rng()<0.09)map.vents.push({x:wx,z:wz,k,id:'v'+map.vents.length});
      if(c===T_CORR&&((x+z)%2===0))map.lights.push(mkLight(wx,wz,k,rng,false));}
    for(const r of lay.rooms){const n=r.w*r.h>=6?2:1;
      for(let i=0;i<n;i++){const lx=n===1?r.cx:(r.x+(i===0?0.5:r.w-0.5))*CELL;map.lights.push(mkLight(lx,r.cz,k,rng,r.type==='vault'));}
      const np=ri(rng,2,Math.min(5,r.w*r.h));const used=[];
      for(let i=0;i<np;i++){const pn=pick(loc.props,rng);const px=rr(rng,r.x*CELL+1.2,(r.x+r.w)*CELL-1.2),pz=rr(rng,r.z*CELL+1.2,(r.z+r.h)*CELL-1.2);if(used.some(u=>dist2(u[0],u[1],px,pz)<1.8))continue;used.push([px,pz]);map.props.push({n:pn,x:px,z:pz,k,rot:ri(rng,0,3)*Math.PI/2+rr(rng,-0.2,0.2),id:'p'+map.props.length,room:r.id});}
      const depth=L>1?k/(L-1):0;const nl=ri(rng,r.type==='vault'?3:1,r.type==='vault'?5:3);
      for(let i=0;i<nl;i++){const it=rollItem(rng,depth,r.type==='vault',lootMult);const px=rr(rng,r.x*CELL+0.8,(r.x+r.w)*CELL-0.8),pz=rr(rng,r.z*CELL+0.8,(r.z+r.h)*CELL-0.8);map.items.push({tpl:it.tpl,value:it.value,x:px,z:pz,k,id:'i'+map.items.length,room:r.id,rot:rng()*TAU});}
      if(rng()<0.3&&map.docs.length<12){const px=rr(rng,r.x*CELL+1,(r.x+r.w)*CELL-1),pz=rr(rng,r.z*CELL+1,(r.z+r.h)*CELL-1);map.docs.push({x:px,z:pz,k,id:'doc'+map.docs.length,lore:pick(LORE,rng).id});}
    }
  }
  for(const st of map.stairs){map.lights.push(mkLight((st.x-st.dx+0.5)*CELL,(st.z-st.dz+0.5)*CELL,st.k,rng,false));map.lights.push(mkLight((st.x+st.dx*3+0.5)*CELL,(st.z+st.dz*3+0.5)*CELL,st.k+1,rng,false));}
  /* ---- 8. specials ---- */
  const deepRooms=map.layers[L-1].rooms;
  const genRoom=pick(L>1?map.layers[ri(rng,1,L-1)].rooms:map.layers[0].rooms,rng);
  map.gen={x:genRoom.cx+1.5,z:genRoom.cz,k:genRoom.k,on:false,id:'gen',prog:0};
  const hatchRoom=pick(map.layers[0].rooms,rng);map.hatch={x:hatchRoom.cx-1.5,z:hatchRoom.cz-1,k:0,found:false};
  map.deepRoom=pick(deepRooms,rng);
  /* ---- final physical check: every room must be walkable-to from the yard; otherwise regenerate deterministically ---- */
  {const reach=reachFrom(map,0,map.spawn.x,map.spawn.z);let un=0;for(let k=0;k<L;k++)for(const r of map.layers[k].rooms){if(!reach.has(k*W*H+idx(r.x,r.z)))un++;}
    if(un&&(opts.retry||0)<8)return genMap(seed+7919,loc,diff,Object.assign({},opts,{retry:(opts.retry||0)+1}));map.regen=opts.retry||0;}
  for(let i=0;i<4;i++){const a=i/4*TAU+rng();const it=rollItem(rng,1,true,lootMult*1.3);map.items.push({tpl:it.tpl,value:it.value,x:map.deepRoom.cx+Math.sin(a)*2.3,z:map.deepRoom.cz+Math.cos(a)*2.3,k:map.deepRoom.k,id:'nest'+i,room:map.deepRoom.id,rot:rng()*TAU});}
  levelDesignPass(map);
  return map;
}
let _darkLoc=false;
function mkLight(x,z,k,rng,vault){const dead=_darkLoc&&!vault&&rng()<0.42;return {x,y:layerY(k)+WALL_H-0.15,z,k,on:!dead,dead,flicker:rng()<0.22,phase:rng()*10,emerg:false,id:'L'+Math.floor(rng()*1e9).toString(36)+k,vault:!!vault};}
function rollItem(rng,depth,vault,mult){
  const w=RAR_W.map((v,i)=>v*Math.pow(1+depth*2.2,i)*(vault&&i<2?0.2:1));
  const r=wpick(RARITY.map((n,i)=>i),rng,i=>w[i]);
  const cands=ITEMS.filter(it=>it.r===r&&!it.curse);const tpl=cands.length?pick(cands,rng):ITEMS[0];
  const curse=rng()<0.06?pick(ITEMS.filter(i=>i.curse),rng):null;const t=curse||tpl;
  const value=Math.round(t.v*rr(rng,0.7,1.4)*mult/10)*10;
  return {tpl:ITEMS.indexOf(t),value};
}
/* ---------- geometry helpers over the map ---------- */
function cellAt(map,k,x,z){const cx=Math.floor(x/CELL),cz=Math.floor(z/CELL);if(cx<0||cz<0||cx>=map.W||cz>=map.H||k<0||k>=map.L)return T_VOID;return map.layers[k].cells[cz*map.W+cx];}
function roomAt(map,k,x,z){const cx=Math.floor(x/CELL),cz=Math.floor(z/CELL);if(cx<0||cz<0||cx>=map.W||cz>=map.H)return -1;const r=map.layers[k].room[cz*map.W+cx];return r;}
function stairAtPos(map,k,x,z){const cx=Math.floor(x/CELL),cz=Math.floor(z/CELL);if(cx<0||cz<0||cx>=map.W||cz>=map.H||k<0||k>=map.L)return null;return map.layers[k].stairAt[cz*map.W+cx]||null;}
function groundY(map,k,x,z){const st=stairAtPos(map,k,x,z);if(!st)return layerY(k);
  const sx=st.x*CELL+(st.dx<0?CELL:0),sz=st.z*CELL+(st.dz<0?CELL:0);const t=clamp(((x-sx)*st.dx+(z-sz)*st.dz)/(3*CELL),0,1);return layerY(st.k)-LAYER_GAP*t;}
function layerOfY(y){return clamp(Math.round(-y/LAYER_GAP),0,20);}
function layerAt(map,y){return clamp(Math.round(-(y+0.5)/LAYER_GAP+0.5-0.5),0,map.L-1);}
/* AABB collision list per layer, bucketed by cell */
function buildColliders(map){
  for(let k=0;k<map.L;k++){const lay=map.layers[k];lay.col=new Map();
    const add=(b)=>{const x0=Math.floor(b.x0/CELL),x1=Math.floor(b.x1/CELL),z0=Math.floor(b.z0/CELL),z1=Math.floor(b.z1/CELL);for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++){const key=z*map.W+x;let a=lay.col.get(key);if(!a){a=[];lay.col.set(key,a);}a.push(b);}};
    for(const w of lay.walls){const t=0.12;if(w.rot===1)add({x0:w.x-t,x1:w.x+t,z0:w.z-w.len/2,z1:w.z+w.len/2,wall:true});else add({x0:w.x-w.len/2,x1:w.x+w.len/2,z0:w.z-t,z1:w.z+t,wall:true});}
    for(const d of lay.doors){const t=0.1,hw=(d.blast?BLAST_W:DOOR_W)/2;const b=d.rot===1?{x0:d.x-t,x1:d.x+t,z0:d.z-hw,z1:d.z+hw,door:d}:{x0:d.x-hw,x1:d.x+hw,z0:d.z-t,z1:d.z+t,door:d};add(b);}
    lay.addCol=add;
  }
  for(const p of map.props){const f=PROP_FOOT[p.n];if(!f)continue;const lay=map.layers[p.k];const c=Math.cos(p.rot),s=Math.sin(p.rot);const hx=Math.abs(f[0]/2*c)+Math.abs(f[1]/2*s),hz=Math.abs(f[0]/2*s)+Math.abs(f[1]/2*c);lay.addCol({x0:p.x-hx,x1:p.x+hx,z0:p.z-hz,z1:p.z+hz,prop:p,h:f[2]});}
  if(map.elev){for(let k=0;k<map.L;k++){/* elevator cab walls except front (+x) */const lay=map.layers[k],ex=map.elev.wx,ez=map.elev.wz;lay.addCol({x0:ex-1.15,x1:ex-1.0,z0:ez-1.15,z1:ez+1.15,wall:true});lay.addCol({x0:ex-1.15,x1:ex+1.15,z0:ez-1.15,z1:ez-1.0,wall:true});lay.addCol({x0:ex-1.15,x1:ex+1.15,z0:ez+1.0,z1:ez+1.15,wall:true});}}
}
const PROP_FOOT={crate:[1,1,0.9],desk:[1.6,0.8,0.75],locker:[0.6,0.5,1.9],shelf:[1.2,0.5,1.8],bed:[1,2,0.6],cart:[0.8,0.6,0.9],tank:[1,1,1.9],cabinet:[0.9,0.5,1.2],pallet:[1.2,1,0.15],cot:[0.7,1.9,0.4],mascot:[0.8,0.6,2.4],generator:[1.4,0.8,1.1],terminal:[0.6,0.5,1.2],beacon:[0.8,0.8,2.3],sample_station:[1.2,0.6,1.8],corpse:[0.6,1.4,0.3],debris:[1.2,1.0,0.4]};
const PHYS_PROPS={chair:{r:0.32,h:0.9,mass:4,noise:0.7},barrel:{r:0.32,h:0.9,mass:14,noise:0.9}};
/* colliders query */
function nearCols(map,k,x,z,out){out.length=0;const lay=map.layers[k];if(!lay||!lay.col)return out;const cx=Math.floor(x/CELL),cz=Math.floor(z/CELL);for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){const a=lay.col.get((cz+dz)*map.W+cx+dx);if(a)for(const b of a)out.push(b);}return out;}
const _cols=[];
function collideCircle(map,k,p,r,yFeet,height,opts){/* p: {x,z} mutated; returns hit info */
  let hit=null;nearCols(map,k,p.x,p.z,_cols);
  for(let it=0;it<3;it++){for(const b of _cols){
    if(b.door&&(b.door.open>0.6||b.door.broken||(opts&&opts.noDoors&&!b.door.locked&&!b.door.blast)))continue;if(b.vanLock&&!vanLocked())continue;
    if(b.prop&&yFeet>=layerY(k)+b.h-0.05)continue; /* standing on top of low props */
    const cx=clamp(p.x,b.x0,b.x1),cz=clamp(p.z,b.z0,b.z1);let dx=p.x-cx,dz=p.z-cz;let d=Math.hypot(dx,dz);
    if(d<r){if(d<1e-4){/* inside: push along smallest axis */const px=Math.min(p.x-b.x0,b.x1-p.x),pz=Math.min(p.z-b.z0,b.z1-p.z);if(px<pz){dx=(p.x-b.x0<b.x1-p.x)?-1:1;dz=0;}else{dz=(p.z-b.z0<b.z1-p.z)?-1:1;dx=0;}d=0;}else{dx/=d;dz/=d;}
      p.x+=dx*(r-d);p.z+=dz*(r-d);hit=b;}
  }}
  return hit;
}
/* segment vs walls (LOS) on one layer */
function losClear(map,k,ax,az,bx,bz){const lay=map.layers[k];if(!lay||!lay.col)return true;const steps=Math.ceil(Math.hypot(bx-ax,bz-az)/CELL)+1;const seen=new Set();
  for(let i=0;i<=steps;i++){const t=i/steps,x=ax+(bx-ax)*t,z=az+(bz-az)*t;const cx=Math.floor(x/CELL),cz=Math.floor(z/CELL);for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){const key=(cz+dz)*map.W+cx+dx;if(seen.has(key))continue;seen.add(key);const a=lay.col.get(key);if(!a)continue;for(const b of a){if(b.prop)continue;if(b.door&&(b.door.open>0.6||b.door.broken))continue;if(segAABB(ax,az,bx,bz,b))return false;}}}
  return true;}
function segAABB(ax,az,bx,bz,b){let t0=0,t1=1;const dx=bx-ax,dz=bz-az;const f=(p,d,lo,hi)=>{if(Math.abs(d)<1e-9)return p>=lo&&p<=hi;let ta=(lo-p)/d,tb=(hi-p)/d;if(ta>tb){const q=ta;ta=tb;tb=q;}t0=Math.max(t0,ta);t1=Math.min(t1,tb);return t0<=t1;};return f(ax,dx,b.x0,b.x1)&&f(az,dz,b.z0,b.z1);}
/* grid pathfinding across layers (stairs connect) */
function walkable(map,k,cx,cz){if(cx<0||cz<0||cx>=map.W||cz>=map.H)return false;const c=map.layers[k].cells[cz*map.W+cx];return c!==T_VOID&&c!==T_ELEV;}
function findPath(map,k0,x0,z0,k1,x1,z1,opts){opts=opts||{};const W=map.W;const key=(k,c)=>k*W*map.H+c;const start=key(k0,Math.floor(z0/CELL)*W+Math.floor(x0/CELL)),goal=key(k1,Math.floor(z1/CELL)*W+Math.floor(x1/CELL));
  if(start===goal)return [{x:x1,z:z1,k:k1}];
  const prev=new Map();prev.set(start,-1);const q=[start];let qi=0,found=false;
  while(qi<q.length&&qi<4000){const cur=q[qi++];if(cur===goal){found=true;break;}const k=Math.floor(cur/(W*map.H)),c=cur%(W*map.H),cx=c%W,cz=Math.floor(c/W);
    const lay=map.layers[k];const st=lay.stairAt[c];
    const push=(kk,nx,nz)=>{if(!walkable(map,kk,nx,nz))return;if(kk===k&&lay.blocked&&lay.blocked.has(edgeKeyG(cx,cz,nx,nz)))return;const nk=key(kk,nz*W+nx);if(prev.has(nk))return;const nc=map.layers[kk].cells[nz*W+nx];
      /* stair cells only enterable from their axis ends */
      const nst=map.layers[kk].stairAt[nz*W+nx];if(nst&&kk===k&&!st){const along=(nx-cx)*nst.dx+(nz-cz)*nst.dz;if(along===0)return;}
      if(st&&!nst&&kk===k){const along=(nx-cx)*st.dx+(nz-cz)*st.dz;if(along===0)return;}
      prev.set(nk,cur);q.push(nk);};
    for(const d of DIRS)push(k,cx+d[0],cz+d[1]);
    if(st){/* transition layer at shaft ends */const tk=st.k===k?k+1:k-1;if(tk>=0&&tk<map.L){for(const d of DIRS)push(tk,cx+d[0],cz+d[1]);push(tk,cx,cz);}}
  }
  if(!found)return null;
  const path=[];let cur=goal;while(cur!==-1&&cur!==undefined){const k=Math.floor(cur/(W*map.H)),c=cur%(W*map.H);path.push({x:(c%W+0.5)*CELL,z:(Math.floor(c/W)+0.5)*CELL,k});cur=prev.get(cur);}
  path.reverse();path[path.length-1]={x:x1,z:z1,k:k1};if(path.length>1)path.shift();return path;
}
/* ---- level design pass: critical path per floor, breather rooms, key placement validation ---- */
function levelDesignPass(map){try{const keyTpl=(typeof ITEMS!=='undefined')?ITEMS.findIndex(i=>i.key):-1;map.safeRooms=[];
  for(let k=0;k<map.L;k++){const lay=map.layers[k];
    /* the way in: the van on the surface, the stairs you arrive by below */let from=null;if(k===0)from={x:map.van.x,z:map.van.z-2};else{const st=map.stairs.find(s=>s.k===k-1);if(st)from={x:(st.x+st.dx*3+0.5)*CELL,z:(st.z+st.dz*3+0.5)*CELL};}
    /* the way on: the stairs down, or the deepest room on the last floor */let to=null;const dn=map.stairs.find(s=>s.k===k);if(dn)to={x:(dn.x-dn.dx+0.5)*CELL,z:(dn.z-dn.dz+0.5)*CELL};else if(map.deepRoom&&map.deepRoom.k===k)to={x:map.deepRoom.cx,z:map.deepRoom.cz};
    if(from&&to){const p=findPath(map,k,from.x,from.z,k,to.x,to.z);if(p&&p.length>1)lay.guide=[{x:from.x,z:from.z}].concat(p.map(w=>({x:w.x,z:w.z})));}
    /* breather room: the closest real room to where you arrive (not the vault, not a corridor stub) */if(from){let best=null,bd=1e9;for(const r of lay.rooms){if(r.type==='vault'||r.type==='hall'||r.w<2||r.h<2)continue;const d=dist2(r.cx,r.cz,from.x,from.z);if(d<bd){bd=d;best=r;}}if(best&&bd<26){best.safe=true;map.safeRooms.push({k,id:best.id,cx:best.cx,cz:best.cz});}}
    /* the red key must never sit behind the red door */if(keyTpl>=0)for(const it of map.items){if(it.k!==k||it.tpl!==keyTpl)continue;const rid=roomAt(map,k,it.x,it.z);const r=lay.rooms.find(q=>q.id===rid);if(r&&r.type==='vault'){const alt=lay.rooms.filter(q=>q.type!=='vault'&&q.type!=='hall');if(alt.length){const q=alt[Math.floor(alt.length/2)];it.x=q.cx+0.6;it.z=q.cz-0.4;it.room=q.id;}}}}
  /* breather rooms keep their lights: never dead, never flickering, immune to blackouts */for(const l of map.lights){const rid=roomAt(map,l.k,l.x,l.z);const r=map.layers[l.k].rooms.find(q=>q.id===rid);if(r&&r.safe){l.safe=true;l.dead=false;l.on=true;l.flicker=false;}}
  }catch(e){console.warn('levelDesignPass',e);}}
function randomWalkCell(map,k,rng){const lay=map.layers[k];for(let i=0;i<200;i++){const cx=Math.floor((rng||Math.random)()*map.W),cz=Math.floor((rng||Math.random)()*map.H);const c=lay.cells[cz*map.W+cx];if(c===T_ROOM||c===T_CORR)return {x:(cx+0.5)*CELL,z:(cz+0.5)*CELL,k};}return {x:lay.rooms[0].cx,z:lay.rooms[0].cz,k};}

/* reachable cell keys (k*W*H+cellIndex) from a world position, same movement rules as findPath */
function reachFrom(map,k0,x0,z0){const W=map.W,H=map.H;const key=(k,c)=>k*W*H+c;const start=key(k0,Math.floor(z0/CELL)*W+Math.floor(x0/CELL));const seen=new Set([start]);const q=[start];let qi=0;
  while(qi<q.length){const cur=q[qi++];const k=Math.floor(cur/(W*H)),c=cur%(W*H),cx=c%W,cz=Math.floor(c/W);const lay=map.layers[k];const st=lay.stairAt[c];
    const push=(kk,nx,nz)=>{if(!walkable(map,kk,nx,nz))return;if(kk===k&&lay.blocked&&lay.blocked.has(edgeKeyG(cx,cz,nx,nz)))return;const nk=key(kk,nz*W+nx);if(seen.has(nk))return;const nst=map.layers[kk].stairAt[nz*W+nx];if(nst&&kk===k&&!st){if((nx-cx)*nst.dx+(nz-cz)*nst.dz===0)return;}if(st&&!nst&&kk===k){if((nx-cx)*st.dx+(nz-cz)*st.dz===0)return;}seen.add(nk);q.push(nk);};
    for(const d of DIRS)push(k,cx+d[0],cz+d[1]);
    if(st){const tk=st.k===k?k+1:k-1;if(tk>=0&&tk<map.L){for(const d of DIRS)push(tk,cx+d[0],cz+d[1]);push(tk,cx,cz);}}}
  return seen;}
