"""DEAD AIR build: concatenates src/ parts into dead_air.html and index.html, then syntax-checks the script.
Usage:  python build.py        (needs node on PATH for the syntax check; skipped if missing)
Edit the files in src/, never the assembled HTML."""
import os, shutil, subprocess, sys
ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'src')
PARTS = ['p1.html', 'p2.js', 'p2audio.js', 'p3.js', 'p4.js', 'p5.js', 'p6.js', 'p7.js']
def main():
    parts = [open(os.path.join(SRC, p), encoding='utf-8').read() for p in PARTS]
    html = ''.join(parts) + '</script>\n</body>\n</html>\n'
    out = os.path.join(ROOT, 'dead_air.html')
    open(out, 'w', encoding='utf-8').write(html)
    shutil.copy(out, os.path.join(ROOT, 'index.html'))
    js = ''.join(parts[1:])
    tmp = os.path.join(ROOT, '.build_check.js')
    open(tmp, 'w', encoding='utf-8').write(js)
    try:
        r = subprocess.run(['node', '--check', tmp], capture_output=True, text=True)
        print('SYNTAX_OK' if r.returncode == 0 else r.stderr)
        if r.returncode: sys.exit(1)
    except FileNotFoundError:
        print('node not found: syntax check skipped')
    finally:
        os.remove(tmp)
    print('built dead_air.html + index.html (%d KB)' % (len(html) // 1024))
if __name__ == '__main__':
    main()
