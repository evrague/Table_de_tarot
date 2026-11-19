#!/usr/bin/env python3
"""compose_music.py — compose et mixe hors ligne le thème western du jeu, avec de vrais instruments enregistrés.

Échantillons : FluidR3_GM (dépôt gleitz/midi-js-soundfonts, licence Creative Commons BY 3.0).
    git clone --depth 1 --filter=blob:none --sparse https://github.com/gleitz/midi-js-soundfonts.git sf
    cd sf && git sparse-checkout set --no-cone /FluidR3_GM/whistle-mp3.js ... (voir INSTRUMENTS)

Utilisation :
    python3 tools/compose_music.py <dossier FluidR3_GM> assets/music-western.mp3
Produit une boucle de 32 mesures (80 s, 96 à la noire) qui se raccorde sans coupure,
puis tools/compose_pieces.py assemble assets/music.js avec les autres morceaux.
Nécessite numpy, scipy et ffmpeg.
"""
import base64, json, os, re, subprocess, sys
import numpy as np
from scipy.signal import fftconvolve, butter, lfilter

SR = 44100
BPM = 96
S16 = 60 / BPM / 4            # double croche
BAR = 16 * S16
BARS = 32
LOOP = BARS * BAR             # 80 s
rng = np.random.default_rng(7)

INSTRUMENTS = ['whistle', 'electric_guitar_clean', 'acoustic_guitar_steel', 'acoustic_bass', 'trumpet',
               'choir_aahs', 'string_ensemble_1', 'harmonica', 'timpani', 'tubular_bells', 'woodblock']
PLUCKED = {'electric_guitar_clean', 'acoustic_guitar_steel', 'acoustic_bass', 'timpani', 'tubular_bells', 'woodblock'}

# ---------------------------------------------------------------- échantillons
NOTE = {'C': 0, 'Db': 1, 'D': 2, 'Eb': 3, 'E': 4, 'F': 5, 'Gb': 6, 'G': 7, 'Ab': 8, 'A': 9, 'Bb': 10, 'B': 11}
def midi_of(name):
    m = re.match(r'^([A-G])(#|b)?(-?\d)$', name)
    k = m.group(1) + (m.group(2) or '')
    base = {'C#': 'Db', 'D#': 'Eb', 'F#': 'Gb', 'G#': 'Ab', 'A#': 'Bb'}.get(k, k)
    return 12 * (int(m.group(3)) + 1) + NOTE[base]

class Bank:
    def __init__(self, folder, cache):
        self.folder, self.cache, self.raw, self.dec = folder, cache, {}, {}
        os.makedirs(cache, exist_ok=True)
    def _load(self, inst):
        if inst not in self.raw:
            txt = open(os.path.join(self.folder, f'{inst}-mp3.js'), encoding='utf8').read()
            self.raw[inst] = {midi_of(k): v for k, v in re.findall(r'"([A-G]b?-?\d)": "data:audio/mp3;base64,([^"]+)"', txt)}
        return self.raw[inst]
    def get(self, inst, midi):
        key = (inst, midi)
        if key in self.dec: return self.dec[key]
        path = os.path.join(self.cache, f'{inst}_{midi}.npy')
        if os.path.exists(path):
            a = np.load(path)
        else:
            mp3 = base64.b64decode(self._load(inst)[midi])
            p = subprocess.run(['ffmpeg', '-v', 'quiet', '-i', 'pipe:0', '-f', 'f32le', '-ac', '1', '-ar', str(SR), 'pipe:1'],
                               input=mp3, capture_output=True, check=True)
            a = np.frombuffer(p.stdout, dtype=np.float32).copy()
            thr = 0.02 * np.max(np.abs(a))                      # couper le silence d'attaque
            i = int(np.argmax(np.abs(a) > thr)); a = a[max(0, i - int(0.002 * SR)):]
            a /= max(1e-6, np.max(np.abs(a)))
            np.save(path, a)
        self.dec[key] = a
        return a

# ---------------------------------------------------------------- partition
def n(name): return midi_of(name)
events = []   # (instrument, midi, start s, durée s, vélocité, pan)

def note(inst, bar, step, name, length, vel=0.8, pan=0.0, jitter=0.008):
    t = bar * BAR + step * S16 + rng.uniform(-jitter, jitter)
    v = vel * rng.uniform(0.9, 1.06)
    events.append((inst, n(name) if isinstance(name, str) else name, max(0, t), length * S16, v, pan))

# Accords : fondamentale (midi de basse) et notes de l'accord
CH = {'Am': (45, ['A3', 'C4', 'E4', 'A4']), 'G': (43, ['G3', 'B3', 'D4', 'G4']), 'F': (41, ['F3', 'A3', 'C4', 'F4']),
      'E': (40, ['E3', 'G#3', 'B3', 'E4']), 'Dm': (38, ['D3', 'F3', 'A3', 'D4'])}
PROG = ['Am', 'Am', 'G', 'Am', 'F', 'G', 'E', 'Am']
PROG_END = ['Am', 'Am', 'G', 'Am', 'F', 'G', 'E', 'E']

M1 = [(0, 0, 'E5', 6), (0, 6, 'D5', 2), (0, 8, 'E5', 8), (1, 0, 'A5', 10), (1, 10, 'G5', 2), (1, 12, 'E5', 4),
      (2, 0, 'D5', 6), (2, 6, 'C5', 2), (2, 8, 'D5', 8), (3, 0, 'E5', 14),
      (4, 0, 'C5', 6), (4, 6, 'D5', 2), (4, 8, 'E5', 8), (5, 0, 'D5', 6), (5, 6, 'B4', 2), (5, 8, 'G4', 8),
      (6, 0, 'A4', 6), (6, 6, 'B4', 2), (6, 8, 'G#4', 8), (7, 0, 'A4', 14)]
M2 = [(0, 0, 'A3', 2), (0, 2, 'C4', 2), (0, 4, 'E4', 4), (0, 8, 'A4', 6), (0, 14, 'G4', 2),
      (1, 0, 'E4', 12), (1, 12, 'D4', 2), (1, 14, 'C4', 2),
      (2, 0, 'B3', 2), (2, 2, 'D4', 2), (2, 4, 'G4', 4), (2, 8, 'B4', 6), (2, 14, 'A4', 2),
      (3, 0, 'G4', 4), (3, 4, 'E4', 12),
      (4, 0, 'F4', 2), (4, 2, 'A4', 2), (4, 4, 'C5', 6), (4, 10, 'A4', 2), (4, 12, 'F4', 4),
      (5, 0, 'G4', 2), (5, 2, 'B4', 2), (5, 4, 'D5', 6), (5, 10, 'B4', 2), (5, 12, 'G4', 4),
      (6, 0, 'E4', 2), (6, 2, 'G#4', 2), (6, 4, 'B4', 6), (6, 10, 'D5', 2), (6, 12, 'B4', 4),
      (7, 0, 'A4', 12), (7, 12, 'E4', 4)]
M3 = [(0, 0, 'A5', 4), (0, 4, 'E5', 4), (0, 8, 'A5', 4), (0, 12, 'B5', 4), (1, 0, 'C6', 12), (1, 12, 'B5', 2), (1, 14, 'A5', 2),
      (2, 0, 'G5', 4), (2, 4, 'D5', 4), (2, 8, 'G5', 4), (2, 12, 'A5', 4), (3, 0, 'B5', 8), (3, 8, 'A5', 8),
      (4, 0, 'A5', 4), (4, 4, 'F5', 4), (4, 8, 'C6', 6), (4, 14, 'B5', 2), (5, 0, 'B5', 8), (5, 8, 'G5', 8),
      (6, 0, 'G#5', 8), (6, 8, 'B5', 8), (7, 0, 'B5', 4), (7, 4, 'G#5', 4), (7, 8, 'E5', 8)]
SCALE = [n(x) % 12 for x in ['A0', 'B0', 'C1', 'D1', 'E1', 'F1', 'G1']]
def third_below(m, chord):
    if chord == 'E': opts = [4, 8, 11, 2]               # E G# B D
    else: opts = SCALE
    for d in range(3, 6):
        if (m - d) % 12 in opts: return m - d
    return m - 3

def accompaniment(sec, prog, gallop_vel=0.55, strum=True, mute=False, clop=False):
    for b, ch in enumerate(prog):
        bar = sec * 8 + b
        root, tones = CH[ch]
        fifth = root + 7
        for st, m, ln in [(0, root, 3), (2, root, 1), (3, fifth, 1), (8, root, 3), (10, root, 1), (11, fifth if b % 2 else root + 12, 1)]:
            note('acoustic_bass', bar, st, m, ln, gallop_vel + (0.12 if st in (0, 8) else 0), 0.0, 0.004)
        if strum:
            for st, v in [(4, 0.5), (12, 0.5)] + ([(6, 0.25), (14, 0.25)] if mute else []):
                for i, t in enumerate(tones):
                    events.append(('acoustic_guitar_steel', n(t), bar * BAR + st * S16 + i * 0.014 + rng.uniform(-.004, .004),
                                   (1.2 if v > .3 else 0.18) * 2 * S16, v * rng.uniform(.9, 1.05), 0.35))
        if clop:
            for st, p, v in [(0, 77, .35), (3, 76, .25), (8, 77, .35), (11, 76, .25)]:
                note('woodblock', bar, st, p, 1, v, -0.4, 0.003)

def melody(inst, sec, mel, vel, pan, shift=0, harmony=False, prog=PROG):
    for b, st, nm, ln in mel:
        m = n(nm) + shift
        note(inst, sec * 8 + b, st, m, ln, vel, pan)
        if harmony:
            note(inst, sec * 8 + b, st, third_below(m, prog[b]), ln, vel * 0.75, -pan)

def pads(inst, sec, prog, vel, pan, octave=0):
    for b, ch in enumerate(prog):
        for t in CH[ch][1][:3]:
            note(inst, sec * 8 + b, 0, n(t) + 12 * octave, 16, vel, pan, 0.002)

# Section A : sifflet sur le galop, cloche
accompaniment(0, PROG, strum=True)
melody('whistle', 0, M1, 0.62, 0.0)
note('tubular_bells', 0, 0, 'A4', 16, 0.55, -0.2); note('tubular_bells', 0, 0, 'E4', 16, 0.4, 0.2)
note('tubular_bells', 4, 0, 'F4', 16, 0.4, -0.2)
for b, nm in [(3, 'A4'), (7, 'E4')]:
    note('harmonica', b, 4, nm, 12, 0.35, 0.3)

# Section B : guitare twang, harmonica, sabots
accompaniment(1, PROG, mute=True, clop=True)
melody('electric_guitar_clean', 1, M2, 0.85, -0.25)
for b, lick in [(1, [('E5', 2), ('D5', 2)]), (3, [('C5', 2), ('B4', 1), ('A4', 1)]), (5, [('D5', 2), ('B4', 2)]), (7, [('E5', 1), ('D5', 1), ('C5', 2)])]:
    st = 12
    for nm, ln in lick:
        note('harmonica', 8 + b, st, nm, ln, 0.4, 0.3); st += ln

# Section C : trompettes en tierces, chœur, cordes, timbales
accompaniment(2, PROG, mute=True)
melody('trumpet', 2, M1, 0.6, 0.15, shift=-12, harmony=True)
pads('string_ensemble_1', 2, PROG, 0.28, 0.0)
pads('choir_aahs', 2, PROG[:4], 0.22, 0.0, octave=1)
note('tubular_bells', 16, 0, 'A4', 16, 0.45, -0.2)
for b in range(0, 8, 2):
    note('timpani', 16 + b, 0, CH[PROG[b]][0] - 0 if CH[PROG[b]][0] >= 40 else CH[PROG[b]][0] + 12, 8, 0.7, 0.0, 0.002)

# Section D : sifflet aigu, chœur, roulement de timbales vers la reprise
accompaniment(3, PROG_END, mute=True, clop=True)
melody('whistle', 3, M3, 0.55, 0.0, shift=-12)
pads('choir_aahs', 3, PROG_END, 0.32, 0.0, octave=1)
pads('string_ensemble_1', 3, PROG_END, 0.3, 0.0)
for st in range(0, 32):                                  # roulement sur les deux dernières mesures
    note('timpani', 30 + st // 16, st % 16, 'E2', 1, 0.18 + 0.5 * st / 32, 0.0, 0.002)
note('tubular_bells', 31, 8, 'E4', 8, 0.4, -0.2)

# ---------------------------------------------------------------- rendu
def render(bank):
    total = int((LOOP + 6) * SR)
    buses = {}
    for inst, midi, t, dur, vel, pan in events:
        s = bank.get(inst, midi)
        if inst in PLUCKED:
            ln = min(len(s), int((dur + 0.6) * SR))
            env = np.ones(ln); fade = min(ln, int(0.25 * SR)); env[-fade:] = np.linspace(1, 0, fade)
        else:
            hold = int(dur * SR); rel = int(0.18 * SR)
            ln = min(len(s), hold + rel)
            env = np.ones(ln); att = min(ln, int(0.03 * SR)); env[:att] = np.linspace(0, 1, att)
            if ln > hold: env[hold:] = np.linspace(1, 0, ln - hold)
            else: env[-min(ln, rel):] *= np.linspace(1, 0, min(ln, rel))
        sig = s[:ln] * env * vel
        i0 = int(t * SR); i1 = min(total, i0 + ln)
        b = buses.setdefault(inst, np.zeros((2, total), dtype=np.float32))
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        b[0, i0:i1] += sig[:i1 - i0] * l; b[1, i0:i1] += sig[:i1 - i0] * r
    gain = {'whistle': 0.55, 'electric_guitar_clean': 0.5, 'acoustic_guitar_steel': 0.32, 'acoustic_bass': 0.62, 'trumpet': 0.42,
            'choir_aahs': 0.4, 'string_ensemble_1': 0.32, 'harmonica': 0.36, 'timpani': 0.55, 'tubular_bells': 0.32, 'woodblock': 0.3}
    send = {'whistle': 0.45, 'electric_guitar_clean': 0.35, 'acoustic_guitar_steel': 0.2, 'acoustic_bass': 0.08, 'trumpet': 0.4,
            'choir_aahs': 0.6, 'string_ensemble_1': 0.5, 'harmonica': 0.35, 'timpani': 0.35, 'tubular_bells': 0.55, 'woodblock': 0.15}
    t = np.arange(total) / SR
    dry = np.zeros((2, total), dtype=np.float32); wet = np.zeros_like(dry)
    for inst, b in buses.items():
        if inst == 'electric_guitar_clean':               # trémolo et écho à bande, le son des westerns
            b *= (1 - 0.28 * (0.5 + 0.5 * np.sin(2 * np.pi * 5.5 * t)))
            d = int(0.39 * SR); e = b.copy()
            for k in range(1, 4):
                e[:, d * k:] += b[:, :-d * k] * (0.38 ** k) * (1 if k % 2 else 0.8)
            b = e
        dry += b * gain[inst]; wet += b * gain[inst] * send[inst]
    # réverbération de salle (réponse impulsionnelle synthétique stéréo)
    L = int(2.6 * SR); env = np.exp(-np.arange(L) / (0.55 * SR))
    bb, ab = butter(1, 5000 / (SR / 2))
    ir = [lfilter(bb, ab, rng.standard_normal(L)) * env for _ in range(2)]
    ir = [x / np.sqrt(np.sum(x ** 2)) for x in ir]
    rev = np.stack([fftconvolve(wet[c], ir[c])[:total] for c in range(2)]) * 0.9
    mix = dry + rev
    # boucle sans coupure : la queue après la fin revient sur le début
    n_loop = int(LOOP * SR)
    tail = mix[:, n_loop:]
    mix = mix[:, :n_loop].copy(); mix[:, :tail.shape[1]] += tail
    hp_b, hp_a = butter(2, 35 / (SR / 2), 'high')
    mix = lfilter(hp_b, hp_a, mix, axis=1)
    mix /= np.max(np.abs(mix)) / 0.95
    mix = np.tanh(mix * 1.25) / np.tanh(1.25)                 # compression douce
    return (mix * 0.93).astype(np.float32)

def main():
    folder, out = sys.argv[1], sys.argv[2]
    bank = Bank(folder, os.path.join(os.path.dirname(os.path.abspath(out)), '.sample-cache'))
    mix = render(bank)
    raw = mix.T.tobytes()
    subprocess.run(['ffmpeg', '-y', '-v', 'quiet', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', 'pipe:0',
                    '-c:a', 'libmp3lame', '-b:a', '112k', out], input=raw, check=True)
    print(f'{out} : {os.path.getsize(out) / 1024:.0f} Ko, {LOOP:.1f} s, {len(events)} notes')

if __name__ == '__main__':
    main()
