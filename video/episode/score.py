"""Score a story episode: a synth music bed under grandpa's voice lines, muxed onto the preview video.

  python -X utf8 -I episode/score.py assets/data/heist.json episode/out/voice/heist episode/out/heist.mp4 episode/out/heist-sound.mp4
  python -X utf8 -I episode/score.py assets/data/call.json - episode/out/review.mp4 episode/out/review-sound.mp4

The music is synthesized here (stdlib only, no samples to license) from the scene cuts the page reports:
a pad holds the chord of each section ("music.chords" in the story, keyed by "hook", "board" when the page
has one, the beat ids and "end"), bass, kick and ticks pulse from the cut to the monitor (or "music.grooveFrom")
until the end card. On top of that bed, a riser swells into a low boom on every cut, a glitch crackle lands on
each frame in "music.hits", and a click on each frame the page reports in "clicks" (the monitor's arrows and
cards, the standard one's or a story's own).
The voice dir holds line-<i>.wav per subtitle cue, 44.1 kHz mono 16-bit (episode/voice.mjs writes them);
"-" scores the episode without a voice, the music alone under the subtitles. The cues are the story's "voice"
when it draws its own captions, else its "subs".
A line starts on its cue ("voiceFrom" when the subtitle shows ahead of it, else "from") unless the line before is still talking. The bed sits MUSIC_UNDER_VOICE_DB under the voice
and ducks further under every line, the hits only part of the way; both levels are compared as a phone plays them.
The voice is compressed, the master goes through a limiter at TARGET_LUFS. Prints one JSON line: "lines" are [cue from, voice start,
voice end, cue to] in frames, "late" and "overrun" the cues whose line starts after it was due or outlives the subtitle,
"bedDb" the measured bed against the voice under the lines and in the gaps between them.
"""
import array
import json
import math
import random
import subprocess
import sys
import wave
from pathlib import Path
from typing import NamedTuple

if len(sys.argv) != 5:
    raise SystemExit("usage: score.py <story.json> <voice dir | -> <video.mp4> <out.mp4>")
story_path, voice_dir, video, out = (Path(arg) for arg in sys.argv[1:])
EPISODE = Path(__file__).resolve().parent

RATE = 44100
FPS = 30
TABLE_SIZE = 4096
MASK = TABLE_SIZE - 1
SEED = 7

# Chord -> (bass note, pad notes) in MIDI numbers; the pad voicings stay around D3-Bb3 so the changes are smooth.
CHORDS = {
    "Dm": (38, (50, 53, 57)),
    "Bb": (34, (50, 53, 58)),
    "Gm": (43, (50, 55, 58)),
    "A": (45, (49, 52, 57)),
    "F": (41, (48, 53, 57)),
}
PAD_AMP, PAD_DETUNE_CENTS, PAD_ATTACK_S, PAD_RELEASE_S = 0.05, 6, 0.35, 0.5
BASS_AMP, BASS_DECAY_S, OUTRO_DECAY_S = 0.3, 0.12, 1.2
KICK_AMP, TICK_AMP, BOOM_AMP, WHOOSH_AMP, CRACK_AMP = 0.45, 0.06, 0.6, 0.5, 0.35
CRACK_TAPS, CRACK_GAP_S = 3, 0.035  # a glitch hit stutters this many crackles apart
# A click: a tap of noise over a short blip, lower and softer as an arrow starts than as its card lands.
CLICKS = {"lines": (0.18, 1250), "cards": (0.28, 1870)}  # amp, blip Hz
CLICK_TAP_S, CLICK_BLIP_S, CLICK_DECAY_S = 0.003, 0.06, 0.015
FADE_OUT_S = 0.8

VOICE_GAP_S = 0.15  # pause kept between two lines that run into each other
SILENCE = 0.01  # below this share of full scale a sample is silence when a line is trimmed
TRIM_KEEP_S = (0.02, 0.08)  # silence kept before and after a trimmed line
VOICE_RMS, VOICE_PEAK = 0.1, 0.95
# The voice compressor: above VOICE_THRESHOLD_DB over the line's RMS, loud syllables are pressed VOICE_RATIO:1.
VOICE_THRESHOLD_DB, VOICE_RATIO, VOICE_ATTACK_S, VOICE_RELEASE_S = 4, 3, 0.005, 0.08
MUSIC_UNDER_VOICE_DB = -12  # the steady bed against the voice between lines
DUCK_DB = -4  # and the extra drop while a line plays
HITS_DUCK_SHARE = 0.5  # the risers, booms and crackles duck half as far, so a cut under a line still lands
HEARD_HZ = 150  # levels are compared above this, as a phone speaker plays them; the kick and bass roots sit below
DUCK_ATTACK_S, DUCK_RELEASE_S = 0.06, 0.45
MIX_PEAK = 0.9
TARGET_LUFS = -14  # the level the feeds normalize to
# Ceiling of the master limiter, run OVERSAMPLE times over so it holds the peaks between samples too; the AAC
# encode lifts them a few tenths, which keeps the true peak under the feeds' -1 dBTP.
LIMIT_DB, OVERSAMPLE = -3, 4
LOUDNESS_TOLERANCE, MASTER_TRIES = 0.3, 4
UPMIX = "pan=stereo|c0=c0|c1=c0"  # the mono mix at full level on both channels, measured as the feeds play it


class Section(NamedTuple):
    id: str
    chord: str
    start: int  # samples
    end: int


class Line(NamedTuple):
    cue: dict
    start: int  # samples
    audio: array.array

    @property
    def end(self) -> int:
        return self.start + len(self.audio)


def samples(frame: int) -> int:
    return frame * RATE // FPS


def frame(sample: int) -> int:
    return round(sample * FPS / RATE)


def db(value: float) -> float:
    return 10 ** (value / 20)


def rms(values) -> float:
    return math.sqrt(sum(v * v for v in values) / len(values))


def zeros(n: int) -> array.array:
    return array.array("d", bytes(8 * n))


def midi_hz(note: float) -> float:
    return 440.0 * 2 ** ((note - 69) / 12)


def shape(partials: tuple) -> array.array:
    """One cycle of a waveform built from the given partial amplitudes, peak 1."""
    cycle = [
        sum(amp * math.sin(2 * math.pi * (k + 1) * i / TABLE_SIZE) for k, amp in enumerate(partials))
        for i in range(TABLE_SIZE)
    ]
    peak = max(abs(v) for v in cycle)
    return array.array("d", (v / peak for v in cycle))


PAD = shape(tuple(n ** -1.4 for n in range(1, 9)))  # a soft saw
BASS = shape((1, 0.6, 0.35, 0.15))  # the upper partials keep it audible on phone speakers
BLIP = shape((1, 0.3))


# The instruments add into one buffer: a mix is a sum, so they accumulate in place.
def tone(buf: array.array, wave_shape: array.array, hz: float, at: int, length: int, amp: float,
         attack_s: float = 0.005, release_s: float = 0.03, decay_s: float = 0.0) -> None:
    """A note: linear attack and release, and an exponential decay unless decay_s is 0."""
    length = min(length, len(buf) - at)
    attack, release = max(1, int(attack_s * RATE)), max(1, int(release_s * RATE))
    fall = math.exp(-1 / (decay_s * RATE)) if decay_s else 1.0
    step, phase, level = hz * TABLE_SIZE / RATE, 0.0, amp
    for i in range(length):
        buf[at + i] += level * min(1.0, i / attack, (length - i) / release) * wave_shape[int(phase) & MASK]
        phase += step
        level *= fall


def thump(buf: array.array, at: int, amp: float, hz_from: float, hz_to: float, drop_s: float, decay_s: float) -> None:
    """A sine whose pitch falls from hz_from to hz_to: a kick when short, a boom when long."""
    length = min(int(decay_s * 6 * RATE), len(buf) - at)
    fall, drop = math.exp(-1 / (decay_s * RATE)), math.exp(-1 / (drop_s * RATE))
    phase, level, bend = 0.0, amp, 1.0
    for i in range(length):
        phase += 2 * math.pi * (hz_to + (hz_from - hz_to) * bend) / RATE
        buf[at + i] += level * min(1.0, i / 40) * math.sin(phase)
        level *= fall
        bend *= drop


def tick(buf: array.array, at: int, amp: float, rng: random.Random, decay_s: float = 0.012) -> None:
    """A short burst of high noise: a closed hat, or a crackle when it rings longer."""
    length = min(int(decay_s * 10 / 3 * RATE), len(buf) - at)
    fall = math.exp(-1 / (decay_s * RATE))
    level, last = amp, 0.0
    for i in range(length):
        noise = rng.uniform(-1, 1)
        buf[at + i] += level * (noise - last)  # the difference keeps only the highs
        last = noise
        level *= fall


def whoosh(buf: array.array, end: int, amp: float, rng: random.Random, length_s: float = 0.5) -> None:
    """Noise that swells into `end` and stops there, its low-pass opening as it goes: a riser into a cut."""
    length = min(int(length_s * RATE), end)
    smooth = 0.0
    for i in range(length):
        rise = i / length
        smooth += (0.02 + 0.3 * rise) * (rng.uniform(-1, 1) - smooth)
        buf[end - length + i] += amp * rise ** 2 * smooth


def glitch(buf: array.array, at: int, rng: random.Random) -> None:
    """A stutter of noise crackles over a short thump, for a glitch of the picture."""
    thump(buf, at, BOOM_AMP * 0.7, 120, 40, 0.04, 0.18)
    for k in range(CRACK_TAPS):
        tick(buf, at + k * int(CRACK_GAP_S * RATE), CRACK_AMP * 0.7 ** k, rng, decay_s=0.02)


def click(buf: array.array, at: int, amp: float, hz: float, rng: random.Random) -> None:
    """A tap of noise over a short high blip, for a mark landing on the screen."""
    tick(buf, at, amp, rng, decay_s=CLICK_TAP_S)
    tone(buf, BLIP, hz, at, int(CLICK_BLIP_S * RATE), amp * 0.5, attack_s=0.001, decay_s=CLICK_DECAY_S)


def sections(story: dict, scenes: dict, total: int) -> list:
    monitor, end = scenes["monitor"][0], scenes["end"][0]
    board = [("board", scenes["board"][0])] if "board" in scenes else []
    beats = [(beat["id"], monitor + beat["start"]) for beat in story["beats"]]
    starts = [("hook", 0)] + board + beats + [("end", end)]
    chords = story["music"]["chords"]
    missing = [name for name, _ in starts if chords.get(name) not in CHORDS]
    if missing:
        raise SystemExit(f"music.chords needs one of {sorted(CHORDS)} for {missing}")
    bounds = [samples(start) for _, start in starts] + [total]
    if any(a >= b for a, b in zip(bounds, bounds[1:])):
        raise SystemExit(f"the sections are out of order: {starts}")
    return [Section(name, chords[name], bounds[i], bounds[i + 1]) for i, (name, _) in enumerate(starts)]


def pad(buf: array.array, part: Section, attack_s: float) -> None:
    length = part.end - part.start + int(PAD_RELEASE_S * RATE)  # rings over into the next chord
    for note in CHORDS[part.chord][1]:
        for cents in (-PAD_DETUNE_CENTS, PAD_DETUNE_CENTS):
            tone(buf, PAD, midi_hz(note + cents / 100), part.start, length, PAD_AMP, attack_s, PAD_RELEASE_S)


def groove(buf: array.array, part: Section, at: int, step: int, eighth: int, rng: random.Random, busy: bool) -> None:
    """One eighth of the pulse: bass every eighth, kick on beats 1 and 3, ticks on the offbeats (16ths when busy)."""
    root = CHORDS[part.chord][0] + (12 if step % 8 == 6 else 0)
    accent = 1.0 if step % 2 == 0 else 0.7
    tone(buf, BASS, midi_hz(root), at, eighth, BASS_AMP * accent * rng.uniform(0.9, 1.0), decay_s=BASS_DECAY_S)
    if step % 4 == 0:
        thump(buf, at, KICK_AMP, 110, 45, 0.03, 0.12)
    if step % 2 == 1:
        tick(buf, at, TICK_AMP, rng)
    if busy:
        tick(buf, at + eighth // 2, TICK_AMP * 0.6, rng)


def accents(buf: array.array, parts: list, hits: list, clicks: dict, rng: random.Random) -> None:
    """The opening hit with a stab of its chord, a riser into a boom on every cut, a crackle on every hit frame,
    a click on every click frame."""
    first, *cuts = parts
    thump(buf, 0, BOOM_AMP * 1.2, 80, 30, 0.12, 0.5)
    for note in CHORDS[first.chord][1]:
        tone(buf, PAD, midi_hz(note + 12), 0, int(1.2 * RATE), PAD_AMP * 2.5, decay_s=0.35)
    for part in cuts:
        whoosh(buf, part.start, WHOOSH_AMP, rng)
        thump(buf, part.start, BOOM_AMP, 70, 32, 0.1, 0.45)
    for at in hits:
        glitch(buf, samples(at), rng)
    for kind, frames in clicks.items():
        amp, hz = CLICKS[kind]
        for at in frames:
            click(buf, samples(at), amp, hz, rng)


def fade_out(buf: array.array) -> None:
    fade = int(FADE_OUT_S * RATE)
    for i in range(fade):
        buf[len(buf) - fade + i] *= 1 - i / fade


def music(story: dict, parts: list, grid: int, clicks: dict, total: int) -> tuple:
    """The steady bed (pad, pulse, outro bass) and the hits over it, apart so they can level and duck apart."""
    bed, hits = zeros(total), zeros(total)
    rng = random.Random(SEED)
    for part in parts:
        pad(bed, part, 0.02 if part.start == 0 else PAD_ATTACK_S)
    eighth = int(RATE * 30 / story["music"]["bpm"])
    busy = set(story["music"].get("busy", []))
    outro = parts[-1]
    for step, at in enumerate(range(grid, outro.start, eighth)):
        part = next(p for p in parts if p.start <= at < p.end)
        groove(bed, part, at, step, eighth, rng, part.id in busy)
    tone(bed, BASS, midi_hz(CHORDS[outro.chord][0]), outro.start, outro.end - outro.start, BASS_AMP, decay_s=OUTRO_DECAY_S)
    accents(hits, parts, story["music"].get("hits", []), clicks, rng)
    fade_out(bed)
    fade_out(hits)
    return bed, hits


def leveled(values: list, peak: float = math.inf) -> list:
    gain = min(VOICE_RMS / rms(values), peak / max(abs(v) for v in values))
    return [v * gain for v in values]


def compress(speech: list) -> list:
    """Evens out the loud syllables: a peak follower drives the gain down above the threshold."""
    threshold = VOICE_RMS * db(VOICE_THRESHOLD_DB)
    fast = 1 - math.exp(-1 / (VOICE_ATTACK_S * RATE))
    slow = 1 - math.exp(-1 / (VOICE_RELEASE_S * RATE))
    slope = 1 / VOICE_RATIO - 1
    env, pressed = 0.0, []
    for v in speech:
        env += (abs(v) - env) * (fast if abs(v) > env else slow)
        pressed.append(v * (env / threshold) ** slope if env > threshold else v)
    return pressed


def read_line(path: Path) -> array.array:
    """A voice line as floats, its silence trimmed, compressed and its loudness brought to VOICE_RMS."""
    if not path.is_file():
        raise SystemExit(f"no voice line {path}: run episode/voice.mjs first")
    with wave.open(str(path)) as w:
        if (w.getframerate(), w.getnchannels(), w.getsampwidth()) != (RATE, 1, 2):
            raise SystemExit(f"{path}: expected {RATE} Hz mono 16-bit")
        pcm = array.array("h", w.readframes(w.getnframes()))
    loud = [i for i, v in enumerate(pcm) if abs(v) > SILENCE * 32768]
    if not loud:
        raise SystemExit(f"{path} is silent")
    first = max(0, loud[0] - int(TRIM_KEEP_S[0] * RATE))
    speech = [v / 32768 for v in pcm[first:loud[-1] + int(TRIM_KEEP_S[1] * RATE)]]
    return array.array("d", leveled(compress(leveled(speech)), VOICE_PEAK))


def voice_from(cue: dict) -> int:
    return cue.get("voiceFrom", cue["from"])


def place(subs: list, total: int) -> list:
    lines, free = [], 0
    for i, cue in enumerate(subs):
        audio = read_line(voice_dir / f"line-{i}.wav")
        start = max(samples(voice_from(cue)), free)
        lines = [*lines, Line(cue, start, audio)]
        free = start + len(audio) + int(VOICE_GAP_S * RATE)
    if lines[-1].end > total:
        raise SystemExit(f"the voice runs {frame(lines[-1].end - total)} frames past the video")
    return lines


def duck(lines: list, total: int) -> array.array:
    """Music gain per sample: 1 between lines, DUCK_DB under them, eased down just ahead of each line."""
    mask = bytearray(total)
    for line in lines:
        start = max(0, line.start - int(DUCK_ATTACK_S * RATE))
        mask[start:line.end] = b"\x01" * (line.end - start)
    fast = 1 - math.exp(-3 / (DUCK_ATTACK_S * RATE))
    slow = 1 - math.exp(-3 / (DUCK_RELEASE_S * RATE))
    low, level = db(DUCK_DB), 0.0
    gains = zeros(total)
    for i, on in enumerate(mask):
        level += (on - level) * (fast if on > level else slow)
        gains[i] = 1 + (low - 1) * level
    return gains


def heard(values) -> list:
    """The values through a one-pole high-pass at HEARD_HZ, roughly what a phone speaker plays of them."""
    keep = math.exp(-2 * math.pi * HEARD_HZ / RATE)
    out, last_in, last_out = [], 0.0, 0.0
    for v in values:
        last_out = keep * (last_out + v - last_in)
        last_in = v
        out.append(last_out)
    return out


def talking(lines: list, total: int) -> bytearray:
    """1 on every sample a line plays."""
    mask = bytearray(total)
    for line in lines:
        mask[line.start:line.end] = b"\x01" * len(line.audio)
    return mask


def where(values: list, mask: bytearray, on: int, span: range) -> list:
    """The values over the span, on the samples where the mask is `on`."""
    return [values[i] for i in span if mask[i] == on]


def db_of(values: list, reference: float) -> float | None:
    return round(20 * math.log10(rms(values) / reference), 1) if values else None


def pcm16(mixed: list) -> array.array:
    scale = MIX_PEAK * 32767 / max(abs(v) for v in mixed)
    return array.array("h", (round(v * scale) for v in mixed))


def mix(bed: array.array, hits: array.array, lines: list, total: int) -> tuple:
    """The 16-bit mix, and the bed as played against the voice, under the lines and in the gaps between them.
    Without a voice the bed and the hits play as synthesized, and there is no bed level to report."""
    if not lines:
        return pcm16([b + h for b, h in zip(bed, hits)]), None
    voice = zeros(total)
    for line in lines:
        voice[line.start:line.end] = line.audio
    mask, span = talking(lines, total), range(lines[0].start, lines[-1].end)
    voice_level = rms(where(heard(voice), mask, 1, span))
    gain = voice_level * db(MUSIC_UNDER_VOICE_DB) / rms(where(heard(bed), mask, 1, span))
    ducks = duck(lines, total)
    ducked = [b * gain * d for b, d in zip(bed, ducks)]
    played = heard(ducked)
    bed_db = {"underLines": db_of(where(played, mask, 1, span), voice_level),
              "inGaps": db_of(where(played, mask, 0, span), voice_level)}
    mixed = [m + h * gain * d ** HITS_DUCK_SHARE + v for m, h, d, v in zip(ducked, hits, ducks, voice)]
    return pcm16(mixed), bed_db


def write_wav(path: Path, pcm: array.array) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(pcm.tobytes())


def run(args: list) -> str:
    done = subprocess.run(args, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if done.returncode != 0:
        raise SystemExit(f"{Path(args[0]).name} failed: {done.stderr[-500:]}")
    return done.stdout + done.stderr


def loudness(path: Path, chain: str = "anull") -> tuple:
    """Integrated loudness (LUFS) and true peak (dBTP) of the audio after the filter chain; loudnorm only measures."""
    log = run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-af", f"{chain},loudnorm=print_format=json",
               "-f", "null", "-"])
    m = json.loads(log[log.rindex("{"):log.rindex("}") + 1])
    return float(m["input_i"]), float(m["input_tp"])


def master(mix_wav: Path) -> str:
    """Gain into a peak limiter, the gain searched until the mix measures TARGET_LUFS.

    A short voice-led clip is too peaky for loudnorm's linear mode, and its dynamic mode settles too slowly for 25 s.
    """
    gain = TARGET_LUFS - loudness(mix_wav, UPMIX)[0]
    limiter = f"alimiter=limit={db(LIMIT_DB):.4f}:level=false:latency=true"
    for _ in range(MASTER_TRIES):
        chain = f"{UPMIX},volume={gain:.2f}dB,aresample={RATE * OVERSAMPLE},{limiter},aresample={RATE}"
        miss = TARGET_LUFS - loudness(mix_wav, chain)[0]
        if abs(miss) <= LOUDNESS_TOLERANCE:
            break
        gain += miss
    return chain


def mux(mix_wav: Path) -> None:
    run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(video), "-i", str(mix_wav), "-map", "0:v", "-map", "1:a",
         "-c:v", "copy", "-af", master(mix_wav), "-c:a", "aac", "-b:a", "192k",
         "-shortest", "-movflags", "+faststart", str(out)])


story = json.loads(story_path.read_text(encoding="utf-8"))
checks = json.loads(run(["node", str(EPISODE / "preview.mjs"), str(EPISODE / story["html"]), "--checks"]))
scenes = checks["scenes"]
total = samples(checks["report"]["frames"])
lines = [] if voice_dir == Path("-") else place(story.get("voice") or story["subs"], total)
clicks = checks["report"].get("clicks", {})
bed, hits = music(story, sections(story, scenes, total), samples(story["music"].get("grooveFrom", scenes["monitor"][0])), clicks, total)
pcm, bed_db = mix(bed, hits, lines, total)
mix_wav = out.with_suffix(".wav")
write_wav(mix_wav, pcm)
mux(mix_wav)
lufs, true_peak = loudness(out)
print(json.dumps({
    "out": out.as_posix(),
    "lufs": lufs,
    "truePeak": true_peak,
    "lines": [[line.cue["from"], frame(line.start), frame(line.end), line.cue["to"]] for line in lines],
    "late": [i for i, line in enumerate(lines) if frame(line.start) > voice_from(line.cue)],
    "overrun": [i for i, line in enumerate(lines) if frame(line.end) > line.cue["to"]],
    "bedDb": bed_db,
}))
