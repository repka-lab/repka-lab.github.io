"""Times the tech-week video from its voice lines: each cue runs as long as its trimmed line, GAP frames apart.

python -X utf8 -I chart/layout_tech.py assets/data/tech-week-story.json episode/out/voice/tech-week

Writes from/to on each cue (a caption stays up until the next cue), the timeline the page reads and the beats and
music score.py reads, then prints one JSON line. Lines are trimmed the way score.py trims them.
"""
import array
import json
import math
import sys
import wave
from pathlib import Path

RATE, FPS, SILENCE, KEEP = 44100, 30, 0.01, (0.02, 0.08)
START = 6  # the first line starts here
GAP = 8  # frames between two lines
END_LEAD = 6  # the end card is up this long before its line
TAIL = 24  # frames after the last line

story_path, voice_dir = Path(sys.argv[1]), Path(sys.argv[2])
story = json.loads(story_path.read_text(encoding='utf8'))


def spoken(path: Path) -> int:
    with wave.open(str(path)) as w:
        if (w.getframerate(), w.getnchannels(), w.getsampwidth()) != (RATE, 1, 2):
            raise SystemExit(f'{path}: expected {RATE} Hz mono 16-bit')
        pcm = array.array('h', w.readframes(w.getnframes()))
    loud = [i for i, v in enumerate(pcm) if abs(v) > SILENCE * 32768]
    first, last = max(0, loud[0] - int(KEEP[0] * RATE)), loud[-1] + int(KEEP[1] * RATE)
    return math.ceil((last - first) / RATE * FPS)


cues = story['voice']
lengths = [spoken(voice_dir / f'line-{i}.wav') for i in range(len(cues))]
f = START
for cue, n in zip(cues, lengths):
    if cue['id'] == 'end':
        f += END_LEAD
    cue['from'], cue['said'] = f, f + n
    f += n + GAP
for cue, nxt in zip(cues, cues[1:]):
    cue['to'] = nxt['from'] - (END_LEAD if nxt['id'] == 'end' else 0)
cues[-1]['to'] = cues[-1]['said'] + TAIL

c = {cue['id']: cue for cue in cues}
n = dict(zip([cue['id'] for cue in cues], lengths))
lands = {k: c[cue]['from'] + round(share * n[cue]) for k, (cue, share) in story['at'].items()}
end = c['end']['from'] - END_LEAD
story['timeline'] = {
    # [frame, minute name] for the time cursor; the page knows the minutes.
    # The cover holds the frame while the hook is said; the lines start drawing at the cut to the chart.
    'cover': c['monday']['from'],
    'keys': [[c['monday']['from'], 'MON'], [lands['wed'] - 4, 'WED'], [lands['thu'] - 4, 'THU'], [lands['thuClose'], 'THU_CLOSE'], [lands['weekEnd'], 'WEEK']],
    'cols': {'mon': c['monday']['from'], 'wed': lands['wed'], 'thu': lands['thu']},
    'quotes': {'wed': [lands['wed'] + 4, lands['thu'] - 2], 'thu': [lands['thu'] + 4, c['rule']['from'] + 2]},
    'rule': c['rule']['from'],
    'score': lands['score'],
    'end': end,
    'total': c['end']['to'],
}
story['beats'] = [{'id': k, 'start': c[k]['from']} for k in ('monday', 'wed', 'thu', 'rule', 'week')]
story['music'] = {'bpm': 90, 'grooveFrom': 0,
                  'chords': {'hook': 'Dm', 'monday': 'F', 'wed': 'Bb', 'thu': 'Gm', 'rule': 'A', 'week': 'Dm', 'end': 'F'},
                  'busy': ['thu'], 'hits': [lands['thu']], 'rests': []}
story_path.write_text(json.dumps(story, ensure_ascii=False, indent=1) + '\n', encoding='utf8', newline='\n')
print(json.dumps({'cues': [[cue['id'], cue['from'], cue['said'], cue['to']] for cue in cues], 'timeline': story['timeline'],
                  'seconds': round(story['timeline']['total'] / FPS, 1), 'voiceS': round(sum(lengths) / FPS, 1)}))
