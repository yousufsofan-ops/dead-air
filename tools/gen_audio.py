#!/usr/bin/env python3
"""DEAD AIR â€” ElevenLabs sound set generator.

Usage (from the dead-air folder):
    set ELEVENLABS_API_KEY=your_key      (Windows)     or    export ELEVENLABS_API_KEY=your_key
    python tools/gen_audio.py            # generates every missing clip into audio/ and writes audio/manifest.json
    python tools/gen_audio.py --only hound,warden   # regenerate a subset (substring match on clip name)
    python tools/gen_audio.py --dry     # list what would be generated
    python tools/gen_audio.py --voice   # also generate the dispatcher / intern voice lines (TTS)

The key is read from the environment only. It is never written anywhere.
"""
import os, sys, json, time, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'audio')
API = 'https://api.elevenlabs.io/v1'
VOICE_ID = 'JBFqnCBsd6RMkjVDRZzb'   # default ElevenLabs "George" voice; swap for any voice id you like

S = lambda name, prompt, dur, inf=0.65, loop=False, n=1: dict(name=name, prompt=prompt, dur=dur, inf=inf, loop=loop, n=n)
CLIPS = [
    # ---- footsteps (variants) ----
    S('step_concrete', 'single footstep of a heavy work boot on dusty concrete floor, indoor, close, dry, no reverb', 0.6, 0.7, n=3),
    S('step_metal', 'single footstep of a boot on a metal grating stair, slight ring, industrial', 0.7, 0.7, n=2),
    S('step_gravel', 'single footstep on wet gravel at night, crunch', 0.6, 0.7, n=2),
    S('step_wet', 'single footstep splashing in a shallow puddle on a concrete floor, squelch', 0.7, 0.7, n=2),
    # ---- objects ----
    S('door_creak', 'old heavy wooden door opening slowly with a long rusty hinge creak', 1.6, 0.6),
    S('door_slam', 'heavy wooden door slamming shut in an empty concrete corridor, short echo', 1.0, 0.7),
    S('door_blast', 'huge steel blast door grinding open on hydraulics, deep mechanical rumble, clunk at the end', 2.6, 0.55),
    S('impact_soft', 'medium object dropped on a concrete floor, dull thud', 0.7, 0.7, n=2),
    S('impact_metal', 'metal barrel knocked over on concrete, hollow clang and roll', 1.2, 0.65),
    S('shatter', 'porcelain object shattering on a hard floor, sharp break with scattering shards', 1.4, 0.7),
    S('pickup', 'quick soft cloth and buckle rustle of picking up an object and stashing it in a bag', 0.5, 0.6),
    S('throw_whoosh', 'short whoosh of an object thrown through the air', 0.5, 0.7),
    S('flare', 'road flare igniting with a fizzing hiss and crackle', 1.5, 0.6),
    S('generator', 'diesel generator sputtering then starting up and settling into a loud idle', 4.0, 0.5),
    # ---- ui / radio ----
    S('ui_click', 'small dry mechanical button click', 0.25, 0.8),
    S('ui_ok', 'short soft two-note electronic confirmation chime', 0.6, 0.7),
    S('ui_bad', 'short low electronic error buzz', 0.4, 0.75),
    S('ui_cash', 'cash register style register ding with coins, satisfying, short', 0.8, 0.7),
    S('radio_click', 'walkie talkie push-to-talk squelch click', 0.3, 0.8, n=2),
    S('radio_static', 'walkie talkie static burst with interference crackle', 2.0, 0.6),
    S('alarm', 'facility emergency alarm klaxon, two tone, distant through walls', 2.5, 0.6),
    # ---- stingers / music-ish ----
    S('sting_scare', 'horror jumpscare stinger, screeching strings and a huge sub impact', 2.2, 0.7),
    S('sting_hit', 'player hurt grunt with a wet impact, horror game', 0.8, 0.7),
    S('sting_down', 'slow heartbeat with a dark low drone, dying, horror', 2.5, 0.6),
    S('sting_revive', 'gasping breath in and a soft hopeful rising tone', 1.6, 0.6),
    S('heartbeat', 'single deep human heartbeat, close, two thumps', 1.0, 0.75),
    S('thunder', 'distant rolling thunder over an industrial yard at night with rain', 4.5, 0.55),
    S('scream_distant', 'distant human scream echoing through an abandoned building', 2.0, 0.65),
    S('pipe_groan', 'old metal pipes groaning and knocking in the walls of an abandoned facility', 2.2, 0.6),
    S('laugh', 'quiet unsettling laughter from another room, echoing, horror', 2.0, 0.65),
    S('phone_ring', 'old rotary telephone ringing twice, echoing in an empty room', 2.2, 0.7),
    # ---- creatures ----
    S('echo_hum', 'inhuman low humming voice imitating speech, distorted, wet breathy, horror creature', 2.5, 0.6, n=2),
    S('echo_whisper', 'creature whispering garbled words too close to the microphone, horror', 2.0, 0.6),
    S('crawler_skitter', 'many fast insect legs skittering across a metal ceiling vent', 1.5, 0.65, n=2),
    S('crawler_chitter', 'aggressive chittering hiss of a large insect creature', 1.2, 0.65),
    S('lighteater_throb', 'deep wet subsonic throbbing of a huge slow creature breathing, gurgling', 2.5, 0.55),
    S('lighteater_gurgle', 'wet gurgling slurp of a creature swallowing, disgusting', 1.5, 0.65),
    S('hound_growl', 'low guttural growl of a large hollow chested dog creature, breathing, threatening', 1.8, 0.65, n=2),
    S('hound_bark', 'sharp aggressive bark snarl of a large monstrous dog', 0.8, 0.75),
    S('amb_static', 'empty television studio room tone, faint dead-channel static hiss and electrical hum, seamless loop, no voices', 8.0, 0.4, True),
    S('stack_creak', 'wooden crate creaking and splintering as something moves inside it', 1.3, 0.6),
    S('mimic_snap', 'a wooden chest lid snapping shut with a wet bite, teeth clacking, short', 0.8, 0.7),
    S('mimic_skitter', 'a heavy box scuttling fast on many chitinous legs across a hard floor', 1.6, 0.6),
    S('swarm_buzz', 'a dense swarm of gnats buzzing close around the ears, thick droning insect cloud, seamless loop', 3.0, 0.5, True),
    S('burrower_rumble', 'low rumbling under a concrete floor, cracking tiles, something heavy moving underground', 2.0, 0.6),
    S('burrower_burst', 'floor tiles bursting upward, rubble scattering, a wet guttural roar from below', 1.5, 0.7),
    S('twin_hum', 'a person humming a tune off key, distant, wrong, slightly too slow, unsettling', 3.0, 0.6),
    S('twin_shriek', 'a human voice cracking into an inhuman shriek, sudden, terrifying, short', 1.2, 0.75),
    S('drifter_chime', 'soft eerie glassy chime shimmer, floating jellyfish creature, ethereal', 1.6, 0.5),
    S('warden_roar', 'massive armored creature roar, metallic furnace rumble, chains rattling, terrifying', 2.6, 0.65),
    S('warden_chains', 'heavy iron chains dragging and rattling on a concrete floor', 1.3, 0.7),
    S('warden_stomp', 'gigantic heavy metal footstep on concrete, shaking the room', 0.9, 0.75, n=2),
    S('mourner_sob', 'woman sobbing quietly, muffled, unsettling, in an empty room', 2.2, 0.6, n=2),
    S('mourner_scream', 'piercing inhuman female scream, horror, long, echoing through a building', 2.6, 0.7),
    S('hanger_creak', 'rope creaking slowly as a heavy sack swings from a ceiling', 1.5, 0.6),
    S('hanger_drop', 'heavy wet body-sized sack dropping from a ceiling with a fleshy thud and rope snap', 1.1, 0.7),
    S('collector_chitter', 'sneaky giggling chittering of a small thieving creature with jingling trinkets', 1.3, 0.6),
    S('sleeper_breath', 'enormous sleeping creature slow deep breathing, rumbling snore, cave', 3.0, 0.55),
    S('sleeper_roar', 'colossal creature waking with an earth shaking roar, horror, deep', 3.0, 0.65),
    S('window_ring', 'faint high pitched ringing tone in the ears, tinnitus, unsettling', 2.5, 0.5),
    # ---- ambience loops ----
    S('amb_hum', 'seamless abandoned research facility room tone, fluorescent light buzz, distant ventilation hum, dripping', 16, 0.4, loop=True),
    S('amb_wind', 'seamless wind moaning through broken windows of an empty hotel, creaking, distant', 16, 0.4, loop=True),
    S('amb_water', 'seamless flooded industrial plant ambience, water dripping and trickling, pumps humming far away', 16, 0.4, loop=True),
    S('amb_rain', 'seamless rain on a tin roof of a forest research station, wind in trees', 16, 0.4, loop=True),
    S('amb_space', 'seamless derelict space station interior hum, low electrical drone, distant metallic ticking', 16, 0.4, loop=True),
    S('amb_music', 'seamless distant broken carnival music box playing slow and off key through tunnels, eerie', 16, 0.45, loop=True),
    S('amb_yard', 'seamless night rain in an industrial yard, distant thunder, a van engine idling', 16, 0.4, loop=True),
]
VOICE = [
    ('vo_dispatch_1', 'Dead Air Recovery Services. Your contract is active. Recover what you can, and come back with all of your fingers.'),
    ('vo_dispatch_2', 'Reminder: the company is not responsible for anything that happens below the surface level.'),
    ('vo_dispatch_3', 'Vehicle departure is not negotiable. Be inside it.'),
    ('vo_intern_1', 'Oh thank god. Do you have a stapler? No? Okay. Here, take this, I found it in the vending machine.'),
    ('vo_intern_2', 'The elevator goes to a floor called B three. All of them do. Don\'t.'),
    ('vo_radio_1', 'Don\'t get off the elevator.'),
]

def req(path, body, key):
    data = json.dumps(body).encode()
    r = urllib.request.Request(API + path, data=data, headers={'xi-api-key': key, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg'})
    with urllib.request.urlopen(r, timeout=120) as resp:
        return resp.read()

def main():
    args = sys.argv[1:]
    dry = '--dry' in args; do_voice = '--voice' in args
    only = None
    if '--only' in args: only = args[args.index('--only') + 1].split(',')
    key = os.environ.get('ELEVENLABS_API_KEY', '').strip()
    print('ELEVENLABS_API_KEY=' + ('SET' if key else 'MISSING'))
    if not key and not dry:
        print('Set the key first, e.g.  setx ELEVENLABS_API_KEY "..."  then open a new terminal.'); sys.exit(2)
    os.makedirs(OUT, exist_ok=True)
    jobs = []
    for c in CLIPS:
        for i in range(c['n']):
            name = c['name'] + (('_%d' % (i + 1)) if c['n'] > 1 else '')
            jobs.append((name, c))
    if only: jobs = [j for j in jobs if any(o in j[0] for o in only)]
    made = 0; failed = []
    for name, c in jobs:
        path = os.path.join(OUT, name + '.mp3')
        if os.path.exists(path) and not only: continue
        print(('[dry] ' if dry else '') + name + '  <- ' + c['prompt'][:70] + ('...' if len(c['prompt']) > 70 else ''))
        if dry: continue
        body = {'text': c['prompt'], 'duration_seconds': max(0.5, min(30, c['dur'])), 'prompt_influence': c['inf']}
        if c['loop']: body['loop'] = True
        try:
            audio = req('/sound-generation', body, key)
            open(path, 'wb').write(audio); made += 1; time.sleep(0.3)
        except urllib.error.HTTPError as e:
            msg = e.read().decode(errors='ignore')[:200]; print('  HTTP %d: %s' % (e.code, msg)); failed.append(name)
            if e.code in (401, 402, 429): print('  stopping: key/plan/quota problem'); break
        except Exception as e:
            print('  error:', e); failed.append(name)
    if do_voice and not dry:
        for name, text in VOICE:
            path = os.path.join(OUT, name + '.mp3')
            if os.path.exists(path): continue
            print(name + '  <- "' + text + '"')
            try:
                audio = req('/text-to-speech/' + VOICE_ID + '?output_format=mp3_44100_128', {'text': text, 'model_id': 'eleven_multilingual_v2', 'voice_settings': {'stability': 0.4, 'similarity_boost': 0.8}}, key)
                open(path, 'wb').write(audio); made += 1
            except urllib.error.HTTPError as e:
                print('  HTTP %d: %s' % (e.code, e.read().decode(errors='ignore')[:200])); failed.append(name)
    # manifest: every mp3 present in audio/
    files = sorted(f[:-4] for f in os.listdir(OUT) if f.endswith('.mp3'))
    loops = {c['name'] for c in CLIPS if c['loop']}
    man = {'clips': {f: {'file': 'audio/' + f + '.mp3', 'loop': f in loops} for f in files}}
    open(os.path.join(OUT, 'manifest.json'), 'w').write(json.dumps(man, indent=1))
    print('generated %d, failed %d, manifest lists %d clips' % (made, len(failed), len(files)))
    if failed: print('failed:', ', '.join(failed))

if __name__ == '__main__':
    main()

