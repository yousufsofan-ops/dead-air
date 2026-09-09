"""Post-processing pass: danger-driven vignette/pulse, proximity aberration + grain, hit aberration pop, split-tone grade; low presets get a DOM fallback."""
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

# ---- shader: new uniforms + danger vignette, pulse, grain scaling, split-tone grade ----
rep('p4.js', "uHurt:{value:0},uBlind:{value:0}},", "uHurt:{value:0},uBlind:{value:0},uDanger:{value:0},uPulse:{value:0},uGrain:{value:0.028},uGrade:{value:0.45}},")
rep('p4.js', "uniform float uHurt;uniform float uBlind;varying vec2 vUv;", "uniform float uHurt;uniform float uBlind;uniform float uDanger;uniform float uPulse;uniform float uGrain;uniform float uGrade;varying vec2 vUv;")
rep('p4.js', "col.rgb+=(g-0.5)*0.028;", "col.rgb+=(g-0.5)*uGrain;")
rep('p4.js', "col.rgb*=1.0-uBlind*smoothstep(0.1,0.6,vig);gl_FragColor=col;}'",
            "col.rgb*=1.0-uBlind*smoothstep(0.1,0.6,vig);float dv=uDanger*(0.42+0.14*uPulse);col.rgb*=1.0-dv*smoothstep(0.26,0.85,vig);float lum=dot(col.rgb,vec3(0.3,0.59,0.11));col.rgb=mix(col.rgb,col.rgb*vec3(0.92,1.0,1.08),uGrade*(1.0-smoothstep(0.15,0.65,lum)));col.rgb=mix(col.rgb,col.rgb*vec3(1.06,1.0,0.94),uGrade*smoothstep(0.55,1.0,lum));gl_FragColor=col;}'")
# ---- per-frame drive: nearest visible creature -> danger (smoothed), pulse, aberration, grain ----
rep('p5.js', "if(G.edgePass){const u=G.edgePass.uniforms;u.time.value=G.t;",
            "{const nd=cands.length?cands[0][0]:99;let want=Math.max(0,Math.min(1,1-nd/22));if(G.stage>=5)want=Math.max(want,0.22);if(P.dead)want=0;const dtl=G._dangerT===undefined?0.016:Math.min(0.1,G.t-G._dangerT);G._dangerT=G.t;G.fx.danger=lerp(G.fx.danger||0,want,1-Math.exp(-(want>(G.fx.danger||0)?4:1.2)*dtl));}\n  if(G.edgePass){const u=G.edgePass.uniforms;u.time.value=G.t;const dg=G.fx.danger||0;u.uDanger.value=dg;u.uPulse.value=Math.sin(G.t*(0.9+dg*1.4)*6.2832);u.uGrain.value=0.028+dg*0.045+(P.k>0?0.006:0);")
rep('p5.js', "u.uAberr.value=G.fx.glitch>0?0.012*Math.min(1,G.fx.glitch):(G.fx.shake>0.4?0.003:0);",
            "u.uAberr.value=Math.max(G.fx.glitch>0?0.012*Math.min(1,G.fx.glitch):(G.fx.shake>0.4?0.003:0),dg*0.007+Math.max(0,P.hurtT)*0.012);")
# ---- low/medium presets (no composer): drive the DOM vignette instead ----
rep('p5.js', "if(G.beam){G.beam.visible=G.flash.intensity>0&&!P.dead;",
            "if(!(G.composer&&S.set.gfx>=2)&&P.blind<=0){const dg=G.fx.danger||0;const q=Math.round(dg*8)/8;if(G._vigQ!==q){G._vigQ=q;$('vig').style.background=q>0?'radial-gradient(ellipse at center,transparent '+Math.round(45-q*14)+'%,rgba(0,0,0,'+(0.7+q*0.25).toFixed(2)+') 100%)':'';}}\n  if(G.beam){G.beam.visible=G.flash.intensity>0&&!P.dead;")
rep('p7.js', "G.fx={shake:0,blind:0,glitch:0,lightsOut:0,flicker:0,mapGlitch:0}", "G.fx={shake:0,blind:0,glitch:0,lightsOut:0,flicker:0,mapGlitch:0,danger:0}")

r = subprocess.run([sys.executable, os.path.join(ROOT, 'build.py')], capture_output=True, text=True)
print(r.stdout.strip() or r.stderr.strip())
if r.returncode: sys.exit(1)
