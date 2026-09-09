# DEAD AIR

1-4 player co-op horror recovery sim. Play it: https://yousufsofan-ops.github.io/dead-air/

## Editing the game

The playable file `dead_air.html` (and its copy `index.html`) is **generated**. The source lives in `src/`:

| file | what it holds |
|---|---|
| `src/p1.html` | CSS + DOM |
| `src/p2.js` | data: sites, creatures codex, cosmetics, achievements, save/migrations |
| `src/p2audio.js` | audio engine + clip bank |
| `src/p3.js` | procedural map generation, pathfinding, collision |
| `src/p4.js` | renderer, assets, player, physics, doors, HUD glue |
| `src/p5.js` | creature AI, avatars, Site Zero host logic |
| `src/p6.js` | networking (PeerJS), host migration, voice chat |
| `src/p7.js` | hub, contracts, results, cinematics, input, boot |

Edit the parts, then rebuild:

```bash
python build.py
```

It concatenates the parts, writes both HTML files and runs `node --check` on the script. Commit the parts **and** the built files (GitHub Pages serves the built files from `main`).
