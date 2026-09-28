"""Builds the soundtrack for each hook variant: narration (Kokoro PT-BR TTS),
procedural lo-fi/acoustic music and synthesized ambient foley.

Usage: python3 audio/audio.py            -> writes build/audio_<variant>.wav
Needs audio/kokoro.onnx + audio/voices.bin (see README).
"""
import os, sys
import numpy as np
import soundfile as sf

SR = 48000
DUR = 18.0
N = int(SR * DUR)
HERE = os.path.dirname(os.path.abspath(__file__))
BUILD = os.path.join(HERE, '..', 'build')
os.makedirs(BUILD, exist_ok=True)
rs = np.random.RandomState(7)

# ----------------------------------------------------------------- narration
HOOKS = {
    'base': 'Comecei com um vasinho na janela...',
    'A': 'Comecei com um vasinho na janela... e agora olha isso!',
    'B': 'Eu não sabia que dava pra plantar isso dentro de casa!',
    'C': 'Esse cantinho da minha casa ficou meio fora de controle...',
}
# (start time, latest end time, text) – shared by every variant after the hook.
# Short, conversational lines so the voice can run at (almost) natural speed.
LINES = [
    (2.9, 5.3, 'Aí descobri que dava pra plantar muita coisa!'),
    (5.5, 7.25, 'E olha... é mais fácil do que parece.'),
    (7.35, 9.7, 'E nem precisa de quintal, viu?'),
    (9.85, 12.4, 'Colher o que você mesma plantou... é outra coisa.'),
    (12.55, 14.7, 'Aí eu quis saber o que mais dava pra plantar.'),
    (14.85, 17.3, 'Esse guia tem cem opções pra você começar!'),
]
HOOK_SLOT = (0.06, 2.78)
VOICE = 'pf_dora'


def resample(x, sr_in):
    if sr_in == SR:
        return x
    t_in = np.arange(len(x)) / sr_in
    t_out = np.arange(int(len(x) * SR / sr_in)) / SR
    return np.interp(t_out, t_in, x)


def trim(x, thr=0.008):
    idx = np.where(np.abs(x) > thr)[0]
    return x[max(0, idx[0] - 200): idx[-1] + 2400] if len(idx) else x


_kokoro = None
def tts(text, max_len):
    """Synthesize and pick the gentlest speed that fits the slot."""
    global _kokoro
    if _kokoro is None:
        from kokoro_onnx import Kokoro
        _kokoro = Kokoro(os.path.join(HERE, 'kokoro.onnx'), os.path.join(HERE, 'voices.bin'))
    for speed in (0.97, 1.0, 1.04, 1.08, 1.12, 1.16, 1.2, 1.25):
        s, sr = _kokoro.create(text, voice=VOICE, speed=speed, lang='pt-br')
        y = trim(resample(np.asarray(s, dtype=np.float64), sr))
        if len(y) / SR <= max_len:
            break
    print(f'  tts {len(y)/SR:.2f}s @ {speed}  {text}')
    return y


def breath(dur=0.28):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = bp_fast(rs.randn(n), 500, 3500) * np.sin(np.pi * t / dur) ** 2
    return x * 0.035


def room_ir(dur=0.35):
    n = int(dur * SR)
    t = np.arange(n) / SR
    ir = rs.randn(n) * np.exp(-t / 0.07)
    ir = lp_fast(ir, 4500)
    ir[0] = 0
    return ir / np.sqrt(np.sum(ir ** 2))


def humanize(v):
    """Warm, close-mic 'phone creator' sound: EQ, gentle compression, small room."""
    X = np.fft.rfft(v)
    f = np.fft.rfftfreq(len(v), 1 / SR)
    g = 1 + 0.35 * np.exp(-((f - 180) / 120) ** 2)          # body
    g *= 1 - 0.25 * np.exp(-((f - 3200) / 900) ** 2)         # tame synthetic harshness
    g *= 1 + 0.2 * np.exp(-((f - 6500) / 2000) ** 2)         # air
    g *= 1 / (1 + (70 / np.maximum(f, 1)) ** 4)              # rumble cut
    v = np.fft.irfft(X * g, len(v))
    # soft-knee compression
    env = np.convolve(np.abs(v), np.ones(480) / 480, mode='same')
    gain = 1 / (1 + np.maximum(0, env - 0.12) * 3.5)
    v = v * gain
    wet = np.convolve(v, room_ir())[: len(v)]
    return v + wet * 0.12


def narration(variant):
    v = np.zeros(N)
    items = [(HOOK_SLOT[0], HOOK_SLOT[1], HOOKS[variant])] + LINES
    for k, (t0, t1, text) in enumerate(items):
        y = tts(text, t1 - t0)
        y = y / (np.max(np.abs(y)) + 1e-9) * 0.9
        if k in (1, 3, 5) and t0 > 0.4:
            add(v, breath(), t0 - 0.3)
        i = int(t0 * SR)
        v[i:i + len(y)] += y[: N - i]
    return humanize(v)


# ----------------------------------------------------------------- dsp helpers
def lp(x, a):
    """one-pole low-pass, a in (0,1): smaller = darker"""
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc += a * (x[i] - acc)
        y[i] = acc
    return y


def lp_fast(x, cutoff):
    # FFT brick-ish low-pass with soft roll-off (fast for long buffers)
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    X *= 1 / (1 + (f / cutoff) ** 4)
    return np.fft.irfft(X, len(x))


def hp_fast(x, cutoff):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    X *= 1 / (1 + (cutoff / np.maximum(f, 1)) ** 4)
    return np.fft.irfft(X, len(x))


def bp_fast(x, lo, hi):
    return hp_fast(lp_fast(x, hi), lo)


def env_adsr(n, a=0.005, d=0.3, s=0.0, r=0.05):
    t = np.arange(n) / SR
    e = np.minimum(1, t / a) * (s + (1 - s) * np.exp(-t / d))
    rel = int(r * SR)
    if rel < n:
        e[-rel:] *= np.linspace(1, 0, rel)
    return e


def add(buf, sig, t, gain=1.0):
    i = int(t * SR)
    if i >= len(buf):
        return
    j = min(len(buf), i + len(sig))
    buf[i:j] += sig[: j - i] * gain


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


# ----------------------------------------------------------------- music
BEAT = 0.7  # 85.7 BPM – every cut in the video sits on this grid


def epiano(freq, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    trem = 1 + 0.08 * np.sin(2 * np.pi * 4.2 * t)
    s = (np.sin(2 * np.pi * freq * t) + 0.35 * np.sin(2 * np.pi * 2 * freq * t) * np.exp(-t / 0.25)
         + 0.08 * np.sin(2 * np.pi * 3 * freq * t) * np.exp(-t / 0.1))
    return s * env_adsr(n, 0.004, 1.6, 0.0, 0.2) * trem


def pluck(freq, dur, bright=0.5):
    """Karplus–Strong nylon-ish guitar pluck"""
    n = int(dur * SR)
    p = max(2, int(SR / freq))
    buf = rs.uniform(-1, 1, p)
    buf = lp(buf, bright)
    out = np.zeros(n)
    for i in range(n):
        out[i] = buf[i % p]
        buf[i % p] = 0.5 * (buf[i % p] + buf[(i + 1) % p]) * 0.996
    return out * env_adsr(n, 0.002, 2.0, 0.0, 0.1)


def music():
    L = np.zeros(N)
    R = np.zeros(N)
    # Fmaj7 – Em7 – Dm7 – Cmaj7 (voicings in midi)
    chords = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]]
    bass = [41, 40, 38, 36]
    bars = int(np.ceil(DUR / (4 * BEAT))) + 1
    for b in range(bars):
        t0 = b * 4 * BEAT
        ch = chords[b % 4]
        for k, m in enumerate(ch):
            s = epiano(midi(m), 4 * BEAT + 0.4) * 0.07
            add(L, s, t0 + k * 0.012, 1.0 - 0.1 * k)
            add(R, s, t0 + k * 0.012, 0.7 + 0.1 * k)
        # soft bass
        bs = epiano(midi(bass[b % 4]), 2 * BEAT) * 0.12
        add(L, bs, t0); add(R, bs, t0)
        add(L, bs * 0.7, t0 + 2.5 * BEAT); add(R, bs * 0.7, t0 + 2.5 * BEAT)
        # guitar arpeggio in swung eighths
        arp = [ch[0] + 12, ch[2] + 12, ch[1] + 12, ch[3] + 12, ch[2] + 12, ch[1] + 24, ch[3] + 12, ch[2] + 12]
        for e, m in enumerate(arp):
            swing = 0.06 if e % 2 else 0.0
            s = pluck(midi(m), 1.0, 0.7) * 0.065
            pan = 0.35 + 0.3 * ((e * 3) % 5) / 4
            add(L, s, t0 + e * BEAT / 2 + swing, 1 - pan)
            add(R, s, t0 + e * BEAT / 2 + swing, pan)
        # drums: kick on 1 & 3 (+ pickup), claps on 2 & 4, 16th shaker
        for q in range(4):
            tq = t0 + q * BEAT
            if q in (0, 2):
                n = int(0.3 * SR); t = np.arange(n) / SR
                kick = np.sin(2 * np.pi * (50 + 70 * np.exp(-t / 0.03)) * t) * np.exp(-t / 0.13) * 0.3
                add(L, kick, tq); add(R, kick, tq)
            else:
                n = int(0.18 * SR); t = np.arange(n) / SR
                clap = np.zeros(n)
                for d in (0.0, 0.009, 0.018):
                    i = int(d * SR)
                    clap[i:] += rs.randn(n - i) * np.exp(-np.arange(n - i) / SR / 0.035)
                clap = bp_fast(clap, 900, 5000) * 0.07
                add(L, clap, tq, 0.9); add(R, clap, tq, 1.0)
            for s16 in range(4):
                n = int(0.05 * SR)
                sh = hp_fast(rs.randn(n), 7000) * np.exp(-np.arange(n) / SR / 0.012) * (0.035 if s16 % 2 else 0.018)
                sw = 0.03 if s16 % 2 else 0.0
                add(L, sh, tq + s16 * BEAT / 4 + sw, 0.7); add(R, sh, tq + s16 * BEAT / 4 + sw, 1.0)
        n = int(0.3 * SR); t = np.arange(n) / SR
        kick = np.sin(2 * np.pi * (50 + 70 * np.exp(-t / 0.03)) * t) * np.exp(-t / 0.13) * 0.18
        add(L, kick, t0 + 3.5 * BEAT); add(R, kick, t0 + 3.5 * BEAT)
    # vinyl-ish bed
    crack = np.zeros(N)
    idx = rs.randint(0, N, 180)
    crack[idx] = rs.uniform(-1, 1, len(idx))
    bed = lp_fast(rs.randn(N), 2500) * 0.004 + bp_fast(crack, 1500, 7000) * 0.05
    L += bed; R += bed
    # lo-fi warmth
    L = lp_fast(L, 9000); R = lp_fast(R, 9000)
    fade = np.ones(N)
    fi = int(0.05 * SR); fo = int(1.0 * SR)
    fade[:fi] = np.linspace(0, 1, fi)
    fade[-fo:] = np.linspace(1, 0.0, fo) ** 1.5
    return L * fade, R * fade


# ----------------------------------------------------------------- foley
def water(dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = bp_fast(rs.randn(n), 1200, 6500)
    bub = np.zeros(n)
    for _ in range(int(dur * 22)):
        i = rs.randint(0, max(1, n - 3000)); f = rs.uniform(700, 1800); m = 2400
        tt = np.arange(m) / SR
        bub[i:i + m] += np.sin(2 * np.pi * f * (1 + 2 * tt) * tt) * np.exp(-tt / 0.012) * 0.5
    e = np.minimum(1, t / 0.08) * np.minimum(1, (dur - t) / 0.15)
    return (x * 0.5 + bub * 0.4) * e * (0.8 + 0.2 * np.sin(2 * np.pi * 7 * t))


def soil(dur, density=90):
    n = int(dur * SR)
    out = np.zeros(n)
    for _ in range(int(dur * density)):
        i = rs.randint(0, max(1, n - 800)); m = rs.randint(200, 800)
        out[i:i + m] += rs.randn(m) * np.exp(-np.arange(m) / m * 4) * rs.uniform(0.2, 1)
    t = np.arange(n) / SR
    return lp_fast(out, 3500) * np.minimum(1, t / 0.05) * np.minimum(1, (dur - t) / 0.1) * 0.5


def leaves(dur, density=60):
    n = int(dur * SR)
    out = np.zeros(n)
    for _ in range(int(dur * density)):
        i = rs.randint(0, max(1, n - 3000)); m = rs.randint(800, 3000)
        out[i:i + m] += rs.randn(m) * np.hanning(m) * rs.uniform(0.2, 1)
    t = np.arange(n) / SR
    return bp_fast(out, 2500, 9000) * np.minimum(1, t / 0.1) * np.minimum(1, (dur - t) / 0.2) * 0.35


def snip():
    n = int(0.09 * SR); t = np.arange(n) / SR
    s = np.zeros(n)
    for dt, f in ((0.0, 4300), (0.035, 5200)):
        i = int(dt * SR); m = n - i; tt = np.arange(m) / SR
        s[i:] += (np.sin(2 * np.pi * f * tt) * 0.6 + hp_fast(rs.randn(m), 4000) * 0.5) * np.exp(-tt / 0.01)
    return s * 0.6


def tok(freq=260, dec=0.05, g=0.5):
    n = int(0.25 * SR); t = np.arange(n) / SR
    return (np.sin(2 * np.pi * freq * t) + 0.4 * np.sin(2 * np.pi * freq * 2.7 * t)) * np.exp(-t / dec) * g


def step():
    n = int(0.12 * SR); t = np.arange(n) / SR
    return lp_fast(rs.randn(n), 900) * np.exp(-t / 0.025) * 0.35 + np.sin(2 * np.pi * 90 * t) * np.exp(-t / 0.03) * 0.2


def popb(f=900):
    n = int(0.12 * SR); t = np.arange(n) / SR
    return np.sin(2 * np.pi * f * (1 + 3 * t) * t) * np.exp(-t / 0.03) * 0.25


def whoosh(dur=0.6):
    n = int(dur * SR); t = np.arange(n) / SR
    return bp_fast(rs.randn(n), 400, 2500) * np.sin(np.pi * t / dur) ** 2 * 0.12


def glock(freq):
    n = int(0.8 * SR); t = np.arange(n) / SR
    return (np.sin(2 * np.pi * freq * t) + 0.3 * np.sin(2 * np.pi * freq * 4.1 * t) * np.exp(-t / 0.05)) * np.exp(-t / 0.3) * 0.12


def clink():
    n = int(0.5 * SR); t = np.arange(n) / SR
    return (np.sin(2 * np.pi * 2600 * t) + 0.5 * np.sin(2 * np.pi * 4100 * t)) * np.exp(-t / 0.08) * 0.08


def foley(variant):
    F = np.zeros(N)
    # -------- hook (variant-specific)
    if variant == 'base':
        for k in range(6):
            add(F, step(), 0.05 + k * 0.19, 0.8)
        add(F, soil(0.35, 60), 1.55, 0.7)
        add(F, tok(240), 1.68, 0.6)
        add(F, leaves(0.4), 1.7, 0.4)
    elif variant == 'A':
        add(F, soil(0.35, 60), 0.5, 0.7)
        add(F, tok(240), 0.66, 0.6)
        add(F, leaves(1.2), 1.45, 0.5)
    elif variant == 'B':
        add(F, water(1.9), 0.85, 0.5)
        add(F, leaves(0.8), 0.2, 0.35)
    else:
        add(F, leaves(2.4), 0.2, 0.45)
    # -------- shared body
    add(F, soil(0.5), 3.02, 1.0)            # soil poured from the scoop
    add(F, tok(420, 0.03, 0.25), 3.72)       # finger poke
    for k in range(3):
        add(F, tok(2400, 0.01, 0.12), 3.97 + k * 0.06)  # seeds
    add(F, soil(0.28, 50), 4.13, 0.8)        # cover
    add(F, water(0.62), 4.63, 0.6)           # watering
    add(F, leaves(1.7, 80), 5.3, 0.9)        # growth time-lapse
    for tp in (5.35, 5.52, 5.69, 5.85, 5.97, 6.0, 6.1):
        add(F, popb(700 + 300 * rs.rand()), tp, 0.8)
    for k in range(9):
        add(F, step(), 7.12 + k * 0.263, 0.6)  # walking across
    add(F, leaves(0.3), 10.02, 0.7)
    add(F, snip(), HARV['basil'] - 0.02)
    add(F, leaves(0.25), 10.55, 0.6)
    add(F, tok(700, 0.02, 0.2), HARV['tomato'])
    add(F, leaves(0.25), 11.08, 0.6)
    add(F, tok(620, 0.02, 0.2), HARV['straw'])
    add(F, clink(), 11.8)
    add(F, clink(), 12.2, 0.7)
    add(F, water(1.25), 13.0, 0.5)
    for w in (2.8, 9.8, 12.6, 14.72):
        add(F, whoosh(0.35), w - 0.2, 1.6)
    for tp, m in ((5.35, 84), (5.52, 88), (5.69, 91), (6.12, 96)):
        add(F, glock(midi(m)), tp, 0.9)
    add(F, popb(1200), 16.47, 0.5)
    return F


HARV = {'basil': 10.12, 'tomato': 10.63, 'straw': 11.16}


def main(variants):
    print('music…')
    mL, mR = music()
    for v in variants:
        print('variant', v)
        voice = narration(v)
        fx = foley(v)
        # duck the music under the voice (smooth envelope follower)
        envv = np.convolve(np.abs(voice), np.ones(4800) / 4800, mode='same')
        duck = 1 - 0.45 * np.clip(envv / 0.05, 0, 1)
        duck = np.convolve(duck, np.ones(9600) / 9600, mode='same')
        L = mL * duck * 1.0 + fx * 0.35 + voice * 0.7
        R = mR * duck * 1.0 + fx * 0.35 + voice * 0.7
        st = np.stack([L, R], 1)
        st /= max(1.0, np.max(np.abs(st)) / 0.95)
        sf.write(os.path.join(BUILD, f'audio_{v}.wav'), st.astype(np.float32), SR, subtype='FLOAT')
        sf.write(os.path.join(BUILD, f'voice_{v}.wav'), voice.astype(np.float32), SR, subtype='FLOAT')


if __name__ == '__main__':
    main(sys.argv[1:] or ['base', 'A', 'B', 'C'])
