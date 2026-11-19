#!/usr/bin/env python3
"""compose_pieces.py — les autres ambiances musicales, et l'assemblage de assets/music.js.

  bach       Prélude en do majeur BWV 846 (J.-S. Bach, 1722, domaine public), piano.
  pachelbel  Canon en ré (J. Pachelbel, vers 1680, domaine public), violons, alto, violoncelle, clavecin.
  pop        Composition originale, pop entraînante : batterie, basse, piano électrique, guitare, vibraphone, cordes.

Utilisation :
    python3 tools/compose_pieces.py <dossier FluidR3_GM> assets
Lit aussi assets/music-western.mp3 (produit par compose_music.py) et écrit assets/music.js.
"""
import base64, os, subprocess, sys
import numpy as np
from scipy.signal import fftconvolve, butter, lfilter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from compose_music import Bank, midi_of, SR   # moteur d'échantillons commun

rng = np.random.default_rng(11)
SUSTAIN = {'violin', 'viola', 'cello', 'string_ensemble_1', 'pad_2_warm', 'lead_2_sawtooth', 'choir_aahs'}

class Score:
    def __init__(self, bpm, bars, beats=4):
        self.s16 = 60 / bpm / 4
        self.bar = beats * 4 * self.s16
        self.bars = bars
        self.loop = bars * self.bar
        self.ev = []        # (instrument, midi, t, durée, vélocité, pan)
    def note(self, inst, bar, step, name, length, vel=0.7, pan=0.0, jitter=0.006):
        m = midi_of(name) if isinstance(name, str) else name
        t = bar * self.bar + step * self.s16 + rng.uniform(-jitter, jitter)
        self.ev.append((inst, m, max(0.0, t), length * self.s16, vel * rng.uniform(0.92, 1.05), pan))
    def drum(self, kind, bar, step, vel=0.8):
        self.ev.append(('_' + kind, 0, max(0.0, bar * self.bar + step * self.s16 + rng.uniform(-0.003, 0.003)), 0, vel * rng.uniform(0.9, 1.05), 0.0))

# ---------------------------------------------------------------- batterie synthétisée (pop)
def drum_sample(kind):
    t = np.arange(int(0.45 * SR)) / SR
    if kind == 'kick':
        f = 45 + 95 * np.exp(-t * 28)
        x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9) + 0.25 * rng.standard_normal(len(t)) * np.exp(-t * 300)
    elif kind == 'snare':
        b, a = butter(2, [1200 / (SR / 2), 7000 / (SR / 2)], 'band')
        x = lfilter(b, a, rng.standard_normal(len(t))) * np.exp(-t * 18) * 1.6 + np.sin(2 * np.pi * 185 * t) * np.exp(-t * 30) * 0.6
    elif kind == 'clap':
        b, a = butter(2, [900 / (SR / 2), 4000 / (SR / 2)], 'band')
        nz = lfilter(b, a, rng.standard_normal(len(t)))
        env = sum(np.exp(-np.clip(t - d, 0, None) * 60) * (t >= d) for d in (0, 0.011, 0.023)) + np.exp(-np.clip(t - 0.03, 0, None) * 14) * (t >= 0.03) * 0.6
        x = nz * env
    else:   # charleston
        b, a = butter(2, 7000 / (SR / 2), 'high')
        x = lfilter(b, a, rng.standard_normal(len(t))) * np.exp(-t * (60 if kind == 'hat' else 14)) * 0.8
    return (x / np.max(np.abs(x))).astype(np.float32)

# ---------------------------------------------------------------- rendu commun
def render(score, bank, gain, send, rev_len=2.4, rev_amt=0.8, pluck_ring=0.9):
    total = int((score.loop + 6) * SR)
    buses, drums = {}, {}
    for inst, m, t, dur, vel, pan in score.ev:
        if inst.startswith('_'):
            k = inst[1:]
            s = drums.setdefault(k, drum_sample(k)); env = np.ones(len(s))
            key = 'drums'
        else:
            s = bank.get(inst, m); key = inst
            if inst in SUSTAIN:
                hold = int(dur * SR); rel = int(0.25 * SR); ln = min(len(s), hold + rel)
                env = np.ones(ln); att = min(ln, int(0.06 * SR)); env[:att] = np.linspace(0, 1, att)
                if ln > hold: env[hold:] = np.linspace(1, 0, ln - hold)
            else:
                ln = min(len(s), int((dur + pluck_ring) * SR))
                env = np.ones(ln); f = min(ln, int(0.3 * SR)); env[-f:] = np.linspace(1, 0, f)
            s = s[:len(env)]
        sig = s * env * vel
        i0 = int(t * SR); i1 = min(total, i0 + len(sig))
        b = buses.setdefault(key, np.zeros((2, total), dtype=np.float32))
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        b[0, i0:i1] += sig[:i1 - i0] * l; b[1, i0:i1] += sig[:i1 - i0] * r
    dry = np.zeros((2, total), dtype=np.float32); wet = np.zeros_like(dry)
    for k, b in buses.items():
        dry += b * gain.get(k, 0.5); wet += b * gain.get(k, 0.5) * send.get(k, 0.3)
    L = int(rev_len * SR); env = np.exp(-np.arange(L) / (rev_len / 4.6 * SR))
    bb, ab = butter(1, 5500 / (SR / 2))
    ir = [lfilter(bb, ab, rng.standard_normal(L)) * env for _ in range(2)]
    ir = [x / np.sqrt(np.sum(x ** 2)) for x in ir]
    mix = dry + np.stack([fftconvolve(wet[c], ir[c])[:total] for c in range(2)]) * rev_amt
    n = int(score.loop * SR); tail = mix[:, n:]
    mix = mix[:, :n].copy(); mix[:, :tail.shape[1]] += tail          # boucle sans coupure
    hb, ha = butter(2, 30 / (SR / 2), 'high'); mix = lfilter(hb, ha, mix, axis=1)
    mix /= np.max(np.abs(mix)) / 0.95
    mix = np.tanh(mix * 1.15) / np.tanh(1.15)
    return (mix * 0.93).astype(np.float32)

# ---------------------------------------------------------------- Bach, Prélude en do (BWV 846), mesures 1 à 24
BACH = ['C4 E4 G4 C5 E5', 'C4 D4 A4 D5 F5', 'B3 D4 G4 D5 F5', 'C4 E4 G4 C5 E5', 'C4 E4 A4 E5 A5', 'C4 D4 F#4 A4 D5',
        'B3 D4 G4 D5 G5', 'B3 C4 E4 G4 C5', 'A3 C4 E4 G4 C5', 'D3 A3 D4 F#4 C5', 'G3 B3 D4 G4 B4', 'G3 Bb3 E4 G4 C#5',
        'F3 A3 D4 A4 D5', 'F3 Ab3 D4 F4 B4', 'E3 G3 C4 G4 C5', 'E3 F3 A3 C4 F4', 'D3 F3 A3 C4 F4', 'G2 D3 G3 B3 F4',
        'C3 E3 G3 C4 E4', 'C3 G3 Bb3 C4 E4', 'F2 F3 A3 C4 E4', 'F#2 C3 A3 C4 Eb4', 'Ab2 F3 B3 C4 D4', 'G2 F3 G3 B3 D4']
def bach():
    sc = Score(bpm=66, bars=len(BACH))
    for b, ch in enumerate(BACH):
        n5 = ch.split()
        for half in (0, 8):
            sc.note('acoustic_grand_piano', b, half, n5[0], 8, 0.55, -0.15, 0.004)
            sc.note('acoustic_grand_piano', b, half + 1, n5[1], 7, 0.45, -0.05, 0.004)
            for k, idx in enumerate([2, 3, 4, 2, 3, 4]):
                v = 0.42 + (0.06 if idx == 4 else 0) + 0.03 * np.sin(b / 3)
                sc.note('acoustic_grand_piano', b, half + 2 + k, n5[idx], 2.5, v, 0.1 + 0.05 * idx, 0.006)
    return sc, {'acoustic_grand_piano': 0.8}, {'acoustic_grand_piano': 0.45}, dict(rev_len=3.0, rev_amt=0.9, pluck_ring=1.6)

# ---------------------------------------------------------------- Pachelbel, Canon en ré
GROUND = ['D3', 'A2', 'B2', 'F#2', 'G2', 'D2', 'G2', 'A2']
CHORDS = [['D4', 'F#4', 'A4'], ['C#4', 'E4', 'A4'], ['B3', 'D4', 'F#4'], ['C#4', 'F#4', 'A4'],
          ['B3', 'D4', 'G4'], ['A3', 'D4', 'F#4'], ['B3', 'D4', 'G4'], ['C#4', 'E4', 'A4']]
V1 = [(i * 4, n, 4) for i, n in enumerate(['F#5', 'E5', 'D5', 'C#5', 'B4', 'A4', 'B4', 'C#5'])]
V2 = [(i * 4, n, 4) for i, n in enumerate(['D5', 'C#5', 'B4', 'A4', 'G4', 'F#4', 'G4', 'E4'])]
V3 = [(i * 2, n, 2) for i, n in enumerate(['D4', 'F#4', 'A4', 'G4', 'F#4', 'D4', 'F#4', 'E4', 'D4', 'B3', 'D4', 'A4', 'G4', 'B4', 'A4', 'G4'])]
def pachelbel():
    cyc = 8                                      # un cycle de basse = 2 mesures
    sc = Score(bpm=58, bars=cyc * 2)
    up = lambda v, k: [(st, midi_of(nm) + 12 * k, ln) for st, nm, ln in v]
    plan = [[], [('violin', V1, 0)], [('violin', V2, 0), ('viola', V1, -1)], [('violin', V3, 1), ('viola', V2, 0), ('cello', V1, -2)],
            [('violin', V1, 0), ('viola', V3, 0), ('cello', V2, -1)], [('violin', V2, 1), ('viola', V1, 0), ('cello', V3, -1)],
            [('violin', V3, 1), ('viola', V2, 0), ('cello', V1, -1)], [('violin', V1, 0), ('viola', V2, -1)]]
    pans = {'violin': -0.35, 'viola': 0.3, 'cello': 0.1}
    for c in range(cyc):
        for i, g in enumerate(GROUND):          # basse continue au violoncelle, accords au clavecin
            bar, st = c * 2 + i // 4, (i % 4) * 4
            sc.note('cello', bar, st, g, 4, 0.5, 0.05, 0.004)
            for k, t in enumerate(CHORDS[i]):
                sc.note('harpsichord', bar, st + k * 0.15, t, 3, 0.28, 0.35, 0.002)
        for inst, voice, oc in plan[c]:
            for st, m, ln in up(voice, oc):
                sc.note(inst, c * 2 + st // 16, st % 16, m, ln, 0.5 if inst == 'violin' else 0.42, pans[inst], 0.008)
    return sc, {'cello': 0.7, 'violin': 0.6, 'viola': 0.55, 'harpsichord': 0.4}, {'cello': 0.35, 'violin': 0.5, 'viola': 0.45, 'harpsichord': 0.3}, dict(rev_len=3.2, rev_amt=0.95)

# ---------------------------------------------------------------- Pop : composition originale
POP_PROG = [('C', 48, ['C4', 'E4', 'G4']), ('G', 43, ['B3', 'D4', 'G4']), ('Am', 45, ['C4', 'E4', 'A4']), ('F', 41, ['C4', 'F4', 'A4'])]
VERSE = [[(0, 'E5', 3), (3, 'D5', 1), (4, 'C5', 4), (8, 'G4', 2), (10, 'C5', 2), (12, 'E5', 4)],
         [(0, 'D5', 6), (6, 'B4', 2), (8, 'G4', 4), (12, 'D5', 4)],
         [(0, 'C5', 3), (3, 'B4', 1), (4, 'A4', 4), (8, 'E5', 4), (12, 'C5', 4)],
         [(0, 'A4', 6), (6, 'C5', 2), (8, 'F5', 4), (12, 'E5', 2), (14, 'D5', 2)]]
VERSE_END = [(0, 'A4', 4), (4, 'G4', 4), (8, 'A4', 2), (10, 'C5', 6)]
CHORUS = [[(0, 'G5', 2), (3, 'G5', 2), (6, 'E5', 2), (8, 'G5', 3), (11, 'A5', 2), (13, 'G5', 3)],
          [(0, 'D5', 2), (3, 'D5', 2), (6, 'B4', 2), (8, 'D5', 3), (11, 'E5', 2), (13, 'D5', 3)],
          [(0, 'E5', 2), (3, 'E5', 2), (6, 'C5', 2), (8, 'E5', 3), (11, 'G5', 2), (13, 'A5', 3)],
          [(0, 'F5', 4), (4, 'E5', 4), (8, 'D5', 4), (12, 'C5', 4)]]
def pop():
    sc = Score(bpm=104, bars=32)
    # intro 4 | couplet 8 | refrain 8 | couplet 4 | refrain 8
    sections = [('intro', 0, 4), ('verse', 4, 8), ('chorus', 12, 8), ('verse2', 20, 4), ('chorus', 24, 8)]
    for name, start, ln in sections:
        for b in range(start, start + ln):
            ch, root, tri = POP_PROG[b % 4]
            ch_full = name == 'chorus'
            # batterie
            sc.drum('kick', b, 0, 0.9); sc.drum('kick', b, 8, 0.85)
            if ch_full: sc.drum('kick', b, 10, 0.6)
            if name != 'intro':
                sc.drum('snare', b, 4, 0.7); sc.drum('snare', b, 12, 0.7)
                if ch_full: sc.drum('clap', b, 4, 0.55); sc.drum('clap', b, 12, 0.55)
            for st in range(0, 16, 1 if ch_full else 2):
                sc.drum('hat', b, st, 0.32 if st % 4 == 0 else 0.2)
            if ch_full and b % 4 == 3: sc.drum('openhat', b, 14, 0.35)
            # basse
            if name != 'intro':
                for st, d, oc in [(0, 3, 0), (3, 1, 0), (6, 2, 12), (8, 3, 0), (11, 1, 0), (14, 2, 7)]:
                    sc.note('electric_bass_finger', b, st, root - 12 + oc, d, 0.75, 0.0, 0.004)
            # piano électrique : accords syncopés
            for st in ([0, 6, 10] if name != 'intro' else [0, 8]):
                for k, t in enumerate(tri):
                    sc.note('electric_piano_1', b, st + k * 0.08, t, 5, 0.38, -0.25, 0.003)
            # guitare en arpèges
            if name in ('verse', 'verse2', 'chorus'):
                arp = [tri[0], tri[1], tri[2], tri[1]]
                for i, st in enumerate(range(0, 16, 2)):
                    sc.note('electric_guitar_clean', b, st, midi_of(arp[i % 4]) + 12, 2, 0.28, 0.4, 0.004)
            # cordes au refrain
            if ch_full:
                for t in tri: sc.note('string_ensemble_1', b, 0, t, 16, 0.3, 0.0, 0.002)
        # mélodie
        if name.startswith('verse'):
            for i in range(ln):
                bar_mel = VERSE[i % 4] if not (i % 8 == 7) else VERSE_END
                for st, nm, d in bar_mel:
                    sc.note('vibraphone', start + i, st, nm, d, 0.62, 0.15)
                    if name == 'verse2': sc.note('electric_piano_1', start + i, st, midi_of(nm) - 12, d, 0.3, -0.1)
        if name == 'chorus':
            for i in range(ln):
                for st, nm, d in CHORUS[i % 4]:
                    sc.note('vibraphone', start + i, st, nm, d, 0.62, 0.1)
                    sc.note('lead_2_sawtooth', start + i, st, nm, d, 0.18, -0.1)
    gain = {'drums': 0.55, 'electric_bass_finger': 0.7, 'electric_piano_1': 0.5, 'electric_guitar_clean': 0.38,
            'string_ensemble_1': 0.32, 'vibraphone': 0.62, 'lead_2_sawtooth': 0.22}
    send = {'drums': 0.12, 'electric_bass_finger': 0.05, 'electric_piano_1': 0.3, 'electric_guitar_clean': 0.35,
            'string_ensemble_1': 0.5, 'vibraphone': 0.45, 'lead_2_sawtooth': 0.35}
    return sc, gain, send, dict(rev_len=1.8, rev_amt=0.6, pluck_ring=0.5)

PIECES = {'bach': bach, 'pachelbel': pachelbel, 'pop': pop}
LABELS = {'western': 'Western', 'bach': 'Classique : Bach, Prélude en do', 'pachelbel': 'Classique : Canon de Pachelbel', 'pop': 'Pop'}

def encode(mix, out):
    subprocess.run(['ffmpeg', '-y', '-v', 'quiet', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', 'pipe:0',
                    '-c:a', 'libmp3lame', '-b:a', '96k', out], input=mix.T.tobytes(), check=True)

def main():
    folder, outdir = sys.argv[1], sys.argv[2]
    only = sys.argv[3:] or list(PIECES)
    bank = Bank(folder, os.path.join(outdir, '.sample-cache'))
    loops = {'western': 80.0}
    for k in PIECES:
        sc, gain, send, opt = PIECES[k]()
        loops[k] = sc.loop
        if k in only:
            encode(render(sc, bank, gain, send, **opt), os.path.join(outdir, f'music-{k}.mp3'))
            print(f'music-{k}.mp3 : {sc.loop:.1f} s, {len(sc.ev)} notes')
    with open(os.path.join(outdir, 'music.js'), 'w') as f:
        f.write('/* music.js — généré par tools/compose_pieces.py, ne pas modifier à la main.\n'
                '   Échantillons d\'instruments FluidR3_GM (CC BY 3.0). Bach et Pachelbel sont dans le domaine public ;\n'
                '   le thème western et le morceau pop sont des compositions originales. */\nconst MUSIC_TRACKS = {\n')
        for k in ['western', 'bach', 'pachelbel', 'pop']:
            b64 = base64.b64encode(open(os.path.join(outdir, f'music-{k}.mp3'), 'rb').read()).decode()
            f.write(f'  {k}: {{ label: "{LABELS[k]}", loop: {loops[k]:.4f}, b64: "{b64}" }},\n')
        f.write('};\n')
    print('music.js', os.path.getsize(os.path.join(outdir, 'music.js')) // 1024, 'Ko')

if __name__ == '__main__':
    main()
