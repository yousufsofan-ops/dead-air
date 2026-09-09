"""Game-feel + audio-design pass: trauma shake, hit-stop, ducking, perceptual volume, value pops, slam/landing impact."""
import os, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'src')
def rd(f): return open(os.path.join(SRC, f), encoding='utf-8').read()
def wr(f, s): open(os.path.join(SRC, f), 'w', encoding='utf-8').write(s)
def rep(fn, a, b, count=1):
    s = rd(fn)
    if b in s: print('already', fn, a[:40]); return
    if a not in s: raise SystemExit('MISSING in ' + fn + ': ' + a[:90])
    wr(fn, s.replace(a, b, count))

# ---- 1. screen shake: decaying trauma, quadratic response, sampled sine noise (no per-frame random buzz) ----
rep('p4.js', "if(G.fx.shake>0){cam.position.y+=(Math.random()-0.5)*G.fx.shake*0.08*S.set.shake;G.fx.shake=Math.max(0,G.fx.shake-dt*1.5);}",
            "if(G.fx.shake>0){const tr=Math.min(1,G.fx.shake);const sh=tr*tr*S.set.shake;G.fx.shT=(G.fx.shT||0)+dt*30;cam.position.y+=Math.sin(G.fx.shT*2.3)*sh*0.07;cam.position.x+=Math.sin(G.fx.shT*1.7)*sh*0.045;cam.position.z+=Math.sin(G.fx.shT*1.3)*sh*0.045;G.fx.shake=Math.max(0,G.fx.shake-dt*1.6);}")
rep('p4.js', "+(G.fx.shake>0?(Math.random()-0.5)*G.fx.shake*0.05*S.set.shake:0)",
            "+(G.fx.shake>0?Math.sin((G.fx.shT||0)*1.1)*Math.min(1,G.fx.shake)*Math.min(1,G.fx.shake)*0.04*S.set.shake:0)")
# ---- 2. hit-stop: a few real-time frames of near-freeze when you take a real hit ----
rep('p7.js', "if(G.paused!==true&&G.paused!=='doc'||MP.on)tick(dt);renderFrame();",
            "const sdt=(G.hitStop>0)?dt*0.06:dt;if(G.hitStop>0)G.hitStop-=rawDt;if(G.paused!==true&&G.paused!=='doc'||MP.on)tick(sdt);renderFrame();")
rep('p4.js', "P.hurtT=1;P.kick=1;G.fx.shake+=Math.min(1.5,amt/30);Aud.sting('hit');",
            "P.hurtT=1;P.kick=1;G.fx.shake+=Math.min(1.5,amt/30);if(amt>=12&&S.set.hitstop!==false)G.hitStop=Math.min(0.09,0.045+amt/500);Aud.sting('hit');")
rep('p7.js', "['Screen shake','shake','range',0,1.5,0.1]", "['Screen shake','shake','range',0,1.5,0.1],['Hit pause on damage','hitstop','toggle']")
rep('p2.js', "if(S.set.skipHome===undefined)S.set.skipHome=false;", "if(S.set.skipHome===undefined)S.set.skipHome=false;if(S.set.hitstop===undefined)S.set.hitstop=true;")
# ---- 3. ducking: music + ambience dip under stings, loud creatures and voice lines, then recover ----
rep('p2audio.js', " sting(kind,pos){",
""" vcurve(s){s=Math.max(0,Math.min(1,+s||0));return s*s;},
 duck(amt,hold){const c=this.ctx;if(!c||!this.mus)return;const now=c.currentTime;const mt=this.vcurve(S.set.music);const g=this.mus.gain;g.cancelScheduledValues(now);g.setTargetAtTime(mt*(1-amt),now,0.03);g.setTargetAtTime(mt,now+(hold||1),0.45);
   if(this.ambGain){const a=this.ambGain.gain;const av=a.value;a.cancelScheduledValues(now);a.setTargetAtTime(av*(1-amt*0.6),now,0.03);a.setTargetAtTime(av,now+(hold||1),0.6);}},
 sting(kind,pos){this.duck(kind==='hit'?0.45:0.6,kind==='hit'?0.8:1.6);""")
rep('p2audio.js', " creature(kind,pos,i){i=i||1;", " creature(kind,pos,i){i=i||1;if(i>=1.2)this.duck(0.4,0.9);")
rep('p7.js', "Aud.play(S.ending?'vo_dispatch_after':'vo_dispatch_'", "Aud.duck(0.4,7);Aud.play(S.ending?'vo_dispatch_after':'vo_dispatch_'")
rep('p7.js', "Aud.play(S.ending?'vo_home_after':'vo_home',null,1,{noVar:true})", "{Aud.duck(0.4,7);Aud.play(S.ending?'vo_home_after':'vo_home',null,1,{noVar:true});}")
# ---- 4. perceptual volume: slider -> gain through a square curve (half the slider ≈ -12 dB, not -6) ----
rep('p2audio.js', "this.master=c.createGain();this.master.gain.value=S.set.vol;", "this.master=c.createGain();this.master.gain.value=this.vcurve(S.set.vol);")
rep('p2audio.js', "this.mus=c.createGain();this.mus.gain.value=S.set.music;", "this.mus=c.createGain();this.mus.gain.value=this.vcurve(S.set.music);")
rep('p2audio.js', " setVol(){if(!this.ctx)return;this.master.gain.value=S.set.vol;this.mus.gain.value=S.set.music;",
                  " setVol(){if(!this.ctx)return;this.master.gain.value=this.vcurve(S.set.vol);{const g=this.mus.gain;g.cancelScheduledValues(this.ctx.currentTime);g.value=this.vcurve(S.set.music);}")
# ---- 5. value pops: floating text at the reticle for pickups and breakage ----
rep('p1.html', '<div id="toasts"', '<div id="floats"></div>\n<div id="toasts"')
rep('p1.html', "#fade{", "#floats{position:fixed;left:50%;top:54%;width:0;pointer-events:none;z-index:6}\n.flt{position:absolute;left:0;transform:translateX(-50%);white-space:nowrap;font-weight:bold;font-size:18px;letter-spacing:.04em;text-shadow:0 2px 8px #000,0 0 12px rgba(0,0,0,.8);animation:fltUp 1.15s cubic-bezier(.2,.8,.3,1) forwards}\n.flt.gold{color:var(--amber)}.flt.red{color:var(--red)}.flt.grn{color:var(--grn)}.flt.dim{color:#c8cfd6;font-size:14px}\n@keyframes fltUp{0%{opacity:0;transform:translate(-50%,14px) scale(.7)}18%{opacity:1;transform:translate(-50%,0) scale(1.18)}30%{transform:translate(-50%,-4px) scale(1)}100%{opacity:0;transform:translate(-50%,-64px) scale(.95)}}\n#fade{")
rep('p7.js', "function toast(s,cls){",
            "function floatText(s,cls){const box=$('floats');if(!box||G.state!=='play')return;const el=document.createElement('div');el.className='flt '+(cls||'');el.textContent=s;el.style.top=(box.children.length%3)*22+'px';box.appendChild(el);setTimeout(()=>el.remove(),1200);while(box.children.length>4)box.firstChild.remove();}\nfunction toast(s,cls){")
rep('p4.js', "else sendAct({k:'grab',id:o.id,pocket:true});onPickup(o);return;}",
            "else sendAct({k:'grab',id:o.id,pocket:true});onPickup(o);if(o.value>0)floatText('+'+fmt(o.value)+' cr','gold');return;}")
rep('p4.js', "else sendAct({k:'grab',id:o.id});onPickup(o);",
            "else sendAct({k:'grab',id:o.id});onPickup(o);if(o.value>0)floatText('+'+fmt(o.value)+' cr'+(o.frag?'  ·  fragile':''),o.frag?'red':'gold');")
s = rd('p4.js'); i = s.find('function breakObj(o){')
assert i > 0
if 'BROKEN' not in s[i:i+400]:
    j = i + len('function breakObj(o){')
    s = s[:j] + "if(o.value>0&&o.k===P.k&&!o.broken&&dist2(o.p.x,o.p.z,P.pos.x,P.pos.z)<9){floatText('BROKEN  -'+fmt(o.value)+' cr','red');G.fx.shake+=0.15;}" + s[j:]
    wr('p4.js', s); print('breakObj pop added')
# ---- 6. impact: door slams and hard landings shake the camera a little ----
rep('p4.js', "function updateDoors(dt){", "function doorSlamFeel(d){if(!d||d.k!==P.k)return;const dd=dist2(P.pos.x,P.pos.z,d.x,d.z);if(dd<8)G.fx.shake+=0.4*(1-dd/8);}\nfunction updateDoors(dt){")
for fn in ('p4.js', 'p5.js'):
    s = rd(fn)
    if 'if(slam)doorSlamFeel(d);' not in s:
        s = s.replace("Aud.door(p,slam);", "Aud.door(p,slam);if(slam)doorSlamFeel(d);")
        wr(fn, s)
rep('p6.js', "Aud.door(new THREE.Vector3(dd.x,layerY(dd.k)+1,dd.z),d.slam);}break;}", "Aud.door(new THREE.Vector3(dd.x,layerY(dd.k)+1,dd.z),d.slam);if(d.slam)doorSlamFeel(dd);}break;}")
rep('p4.js', "else if(P.vel.y<-4){Aud.drop(0.3,null);P.landT=0.3;}", "else if(P.vel.y<-4){Aud.drop(0.3,null);P.landT=0.3;G.fx.shake+=0.18;}")

r = subprocess.run([sys.executable, os.path.join(ROOT, 'build.py')], capture_output=True, text=True)
print(r.stdout.strip() or r.stderr.strip())
if r.returncode: sys.exit(1)
