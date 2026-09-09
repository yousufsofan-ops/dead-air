"""Performance pass (measured first): pooled item glow lights, no shadows from ceiling fixtures, per-floor group culling, LOW preset pixel ratio."""
import os, re, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'src')
def rd(f): return open(os.path.join(SRC, f), encoding='utf-8').read()
def wr(f, s): open(os.path.join(SRC, f), 'w', encoding='utf-8').write(s)
def rep(fn, a, b):
    s = rd(fn)
    if b in s: print('already', fn, a[:40]); return
    if a not in s: raise SystemExit('MISSING in ' + fn + ': ' + a[:90])
    wr(fn, s.replace(a, b, 1))

# safety: any other code touching o.glow as a light?
for fn in ('p4.js', 'p5.js', 'p6.js', 'p7.js'):
    hits = [m.start() for m in re.finditer(r'\bo\.glow\b', rd(fn))]
    print(fn, 'o.glow refs:', len(hits))

# ---- 1. item glow: one pooled set of 6 lights follows the nearest glowing loot, instead of a light per item ----
rep('p4.js', "const pl=new THREE.PointLight(c,0.5,4,2);pl.position.y=o.h/2;o.mesh.add(pl);o.glow=pl;}",
            "o.glowC=c;o.glowOn=true;o.glowPulse=!!ITEMS[d.tpl].pulse;}")
rep('p4.js', "G.crLights=[];for(let i=0;i<4;i++){const pl=new THREE.PointLight(0xffffff,0,6,2);sc.add(pl);G.crLights.push(pl);}",
            "G.crLights=[];for(let i=0;i<4;i++){const pl=new THREE.PointLight(0xffffff,0,6,2);sc.add(pl);G.crLights.push(pl);}G.glowPool=[];for(let i=0;i<(S.set.gfx>=2?6:4);i++){const pl=new THREE.PointLight(0xffffff,0,4,2);sc.add(pl);G.glowPool.push(pl);}")
rep('p5.js', "function updateLights(dt){const pal=G.map.loc.pal;",
"""function updateGlowPool(){const pool=G.glowPool;if(!pool)return;const c=[];for(const o of G.objs){if(!o.glowOn||o.broken||o.k!==P.k||o.inVan||!o.mesh||!o.mesh.visible)continue;const d=dist2(o.p.x,o.p.z,P.pos.x,P.pos.z);if(d<14)c.push([d,o]);}c.sort((a,b)=>a[0]-b[0]);
  for(let i=0;i<pool.length;i++){const pl=pool[i];const e=c[i];if(!e){pl.intensity=0;continue;}const o=e[1];pl.position.set(o.p.x,o.p.y+o.h*0.5,o.p.z);pl.color.setHex(o.glowC);pl.intensity=o.glowPulse?0.5*(0.55+0.45*Math.sin(G.t*4+o.p.x)):0.5;}}
function updateFloorCulling(){const m=G.map;if(!m||!m.layers)return;const sp=P.dead&&P.spectate&&G.avatars[P.spectate];const vk=sp?sp.k:P.k;for(let k=0;k<m.layers.length;k++){const g=m.layers[k].grp;if(!g)continue;const v=Math.abs(k-vk)<=1;if(g.visible!==v)g.visible=v;}}
function updateLights(dt){updateFloorCulling();if(frame%2===0)updateGlowPool();const pal=G.map.loc.pal;""")
# ---- 2. shadows: ceiling fixtures and frames never cast (they were 40% of the shadow pass) ----
rep('p4.js', "if(name!=='Door_L'&&name!=='Door_R')c.rotation.set(0,0,0);c.traverse(m=>{if(m.isMesh){m.castShadow=true;m.receiveShadow=true;}});return c;},",
            "if(name!=='Door_L'&&name!=='Door_R')c.rotation.set(0,0,0);const noCast=lib==='props'&&/^(lamp|lamp_emergency|vent|doorframe|window_frame|beacon|lamppost|sample_station)$/.test(name);c.traverse(m=>{if(m.isMesh){m.castShadow=!noCast;m.receiveShadow=true;}});return c;},")
# ---- 3. LOW preset renders at 0.75x pixel ratio ----
rep('p4.js', "ren.setPixelRatio(Math.min(devicePixelRatio,S.set.gfx>=3?2:S.set.gfx>=1?1.5:1));",
            "ren.setPixelRatio(Math.min(devicePixelRatio,S.set.gfx>=3?2:S.set.gfx>=2?1.5:S.set.gfx>=1?1:0.75));")

r = subprocess.run([sys.executable, os.path.join(ROOT, 'build.py')], capture_output=True, text=True)
print(r.stdout.strip() or r.stderr.strip())
if r.returncode: sys.exit(1)
