"""Camera-systems pass: third-person spring arm with fine march + eased pull-in/extend, shoulder swap, look-ahead; spectate arm + smoothing; frame-rate-independent easing on hub/home cameras; snap after teleports."""
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

# ---- spring arm helper: march from the head toward the wanted camera spot, stop short of walls ----
rep('p4.js', "function updateSelfAvatar(dt){",
"""/* how far back a camera can sit along (-fx,-fz) from (px,pz) on floor k before a wall; 0.1 m march, 0.28 m margin */
function camArm(k,px,pz,fx,fz,maxD){let free=maxD;for(let d=0.15;d<=maxD;d+=0.1){const cx=px-fx*d,cz=pz-fz*d;if(!losClear(G.map,k,px,pz,cx,cz)){free=d-0.1;break;}}return Math.max(0.3,free-0.28);}
function updateSelfAvatar(dt){""")
# ---- third person: eased arm (fast pull-in, slow extend), shoulder swap when the right side is blocked, look-ahead ----
rep('p4.js', "/* third person */if(S.set.tp&&!P.dead){const fx=-Math.sin(P.yaw)*Math.cos(P.pitch),fy=Math.sin(P.pitch),fz=-Math.cos(P.yaw)*Math.cos(P.pitch);const rx=Math.cos(P.yaw),rz=-Math.sin(P.yaw);const px=P.pos.x+rx*0.45,py=P.pos.y+P.eye+0.15,pz=P.pos.z+rz*0.45;let dist=2.4;for(let d=0.4;d<=2.4;d+=0.3){const cx=px-fx*d,cz=pz-fz*d;if(!losClear(G.map,P.k,P.pos.x,P.pos.z,cx,cz)){dist=Math.max(0.4,d-0.3);break;}}cam.position.set(px-fx*dist,py-fy*dist,pz-fz*dist);}",
"""/* third person: over-the-shoulder spring arm */if(S.set.tp&&!P.dead){const fx=-Math.sin(P.yaw)*Math.cos(P.pitch),fy=Math.sin(P.pitch),fz=-Math.cos(P.yaw)*Math.cos(P.pitch);const rx=Math.cos(P.yaw),rz=-Math.sin(P.yaw);
    /* shoulder: prefer right; swap to left when the right side has no room */const hx=P.pos.x,hz=P.pos.z;const roomR=losClear(G.map,P.k,hx,hz,hx+rx*0.7,hz+rz*0.7),roomL=losClear(G.map,P.k,hx,hz,hx-rx*0.7,hz-rz*0.7);const wantSide=(roomR||!roomL)?1:-1;P.tpSide=P.camSnap?wantSide:lerp(P.tpSide===undefined?1:P.tpSide,wantSide,1-Math.exp(-5*dt));
    /* look-ahead: lead the camera a little into the direction you move */const lvx=P.vel.x,lvz=P.vel.z;const lsp=Math.hypot(lvx,lvz);const lead=lsp>0.5?Math.min(0.35,lsp*0.06):0;const lx=lsp>0.5?lvx/lsp*lead:0,lz=lsp>0.5?lvz/lsp*lead:0;P.tpLx=P.camSnap?lx:lerp(P.tpLx||0,lx,1-Math.exp(-3*dt));P.tpLz=P.camSnap?lz:lerp(P.tpLz||0,lz,1-Math.exp(-3*dt));
    const px=P.pos.x+rx*0.45*P.tpSide+P.tpLx,py=P.pos.y+P.eye+0.15,pz=P.pos.z+rz*0.45*P.tpSide+P.tpLz;
    const want=camArm(P.k,px,pz,fx,fz,2.4);const cur=P.tpDist===undefined||P.camSnap?want:P.tpDist;P.tpDist=want<cur?lerp(cur,want,1-Math.exp(-16*dt)):lerp(cur,want,1-Math.exp(-3.5*dt));
    cam.position.set(px-fx*P.tpDist,py-fy*P.tpDist,pz-fz*P.tpDist);P.camSnap=false;}""")
# clamp pitch a little tighter in third person so the arm never dives under the floor
rep('p4.js', "P.pitch=clamp(P.pitch,-1.5,1.5)", "P.pitch=clamp(P.pitch,S.set.tp?-1.15:-1.5,S.set.tp?1.25:1.5)")
# ---- teleports snap the camera instead of whipping across the map ----
rep('p4.js', "function unstick(){const m=G.map;if(!m||G.state!=='play')return;", "function unstick(){const m=G.map;if(!m||G.state!=='play')return;P.camSnap=true;")
# ---- spectate: eased follow with a spring arm and a smoothed look target ----
rep('p4.js', "const back=new THREE.Vector3(Math.sin(a.yaw)*3,2,Math.cos(a.yaw)*3);G.cam.position.lerp(a.pos.clone().add(back),dt*4);G.cam.lookAt(a.pos.x,a.pos.y+1.2,a.pos.z);P.pos.copy(a.pos);P.k=a.k;",
            "const bfx=-Math.sin(a.yaw),bfz=-Math.cos(a.yaw);const arm=camArm(a.k,a.pos.x,a.pos.z,bfx,bfz,3.2);const tgt=new THREE.Vector3(a.pos.x-bfx*arm,a.pos.y+1.6+arm*0.25,a.pos.z-bfz*arm);if(P.k!==a.k||!P.specLook){G.cam.position.copy(tgt);P.specLook=new THREE.Vector3(a.pos.x,a.pos.y+1.2,a.pos.z);}else G.cam.position.lerp(tgt,1-Math.exp(-6*dt));P.specLook.lerp(new THREE.Vector3(a.pos.x,a.pos.y+1.2,a.pos.z),1-Math.exp(-10*dt));G.cam.lookAt(P.specLook);P.pos.copy(a.pos);P.k=a.k;")
# ---- hub + home cameras: frame-rate independent easing ----
rep('p7.js', "G.cam.position.lerp(camP,Math.min(1,dt*3));", "G.cam.position.lerp(camP,1-Math.exp(-3*dt));")
rep('p7.js', "G.cam.position.lerp(new THREE.Vector3(Math.sin(h.t*0.08)*1.5,2.2,6.5),dt);", "G.cam.position.lerp(new THREE.Vector3(Math.sin(h.t*0.08)*1.5,2.2,6.5),1-Math.exp(-1.2*dt));")
rep('p7.js', "G.cam.position.lerp(H.camA,Math.min(1,dt*1.5));", "G.cam.position.lerp(H.camA,1-Math.exp(-1.5*dt));")

r = subprocess.run([sys.executable, os.path.join(ROOT, 'build.py')], capture_output=True, text=True)
print(r.stdout.strip() or r.stderr.strip())
if r.returncode: sys.exit(1)
