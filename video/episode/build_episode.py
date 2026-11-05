"""Assemble the grandpa episode preview page: hook -> board -> desk -> monitor -> end card.

Each scene gets its own unposed copy of grandpa; episode.js poses him frame by frame and
lands on the ready poses read from the scene comments, so the comments stay the single source.
All scenes share one document, so every id is prefixed per scene: s1-head, s2-head, ...
The rig (pivots, gait, floor contact) is the one the character pages use, copied next to the page.

An optional story json (assets/data/heist.json) swaps in its own hook and monitor scenes, the
scripts that play them, the end card text, and the 4h candles of its charts. It may also leave the
board or the desk out ("board": false, "desk": false) or write its own board ("boardScene", a copy of
board.svg with other chalk), lay a question over the cut from its hook ("question"), run subtitles
under the screen ("subs") and name the week's calls ("ideas").
"""
import html
import json
import os
import re
import shutil
import sys
from pathlib import Path
from string import Template

assets, out_dir = Path(sys.argv[1]), Path(sys.argv[2])
story_path = Path(sys.argv[3]) if len(sys.argv) > 3 else None
RIG_JS = Path(__file__).resolve().parent.parent / "character" / "rig.js"
# The site's model logos (LobeHub Icons, MIT, and xAI's Grok Bot mark; see the LICENSE.txt next to them);
# the cards draw them by file name.
LOGOS_DIR = Path(__file__).resolve().parents[2] / "src" / "site" / "logos"
# The board's chalk lettering: Caveat Brush (SIL OFL, licence next to it), loaded by the page from assets.
CHALK_FONT = Path(os.path.relpath(assets / "fonts" / "caveatbrush" / "CaveatBrush-Regular.ttf", out_dir)).as_posix()


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def must_replace(text: str, old: str, new: str) -> str:
    if text.count(old) != 1:
        raise SystemExit(f"expected exactly one {old!r}, found {text.count(old)}")
    return text.replace(old, new)


grandpa = read(assets / "stickman" / "grandpa.svg")
FIGURE_STYLE = re.search(r"<style>.*?</style>", grandpa, re.S).group(0)
start = grandpa.index('  <g id="grandpa">')
end = grandpa.index("\n  </g>", start) + len("\n  </g>")
FIGURE = grandpa[start:end]

# The call episode goes straight from the board to the monitor, no desk shot.
STANDARD = {
    "title": "Grandpa episode preview",
    "html": "episode.html",
    "monitor": "monitor.svg",
    # The week's calls the monitor shows, in assets/data; the sample stands in until the real ones are logged.
    "ideas": "ideas-sample.json",
    "desk": False,
    "scripts": [],
    "end": {"ledger": "Every call is logged first: repka-lab.github.io/ledger.html"},
}
END_TEXT = {
    "ask": "Who's right by Friday?",
    "reply": "Reply with your pick",
    "lead": "Results on Saturday · follow to see them",
    "ledger": "",
    "arrow": True,
}
# The line and the head are separate paths so episode.js can draw one after the other.
END_ARROW = (
    '<g id="arrow"><path id="arrow-line" class="end-arrow" pathLength="1" d="M404 162 C418 162 426 170 426 186"/>'
    '<path id="arrow-head" class="end-arrow" pathLength="1" d="M419 180 L426 188 L433 180"/></g>'
)

END_CARD = Template("""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360">
  <style>
    .end-kicker { fill: #f08a24; font: 700 12px 'Segoe UI', system-ui, sans-serif; letter-spacing: 2px; }
    .end-ask { fill: #fff; font: 900 36px 'Segoe UI', system-ui, sans-serif; }
    .end-reply { fill: #eef2f6; font: 700 20px 'Segoe UI', system-ui, sans-serif; }
    .end-arrow { fill: none; stroke: #f08a24; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
    .end-lead { fill: #b9c6d8; font: 14px 'Segoe UI', system-ui, sans-serif; }
    .end-ledger { fill: #8193ad; font: 12px 'Segoe UI', system-ui, sans-serif; }
  </style>
  <rect width="640" height="360" fill="#13233a"/>
  <rect y="312" width="640" height="48" fill="#0d1828"/>
  <line x1="0" y1="312" x2="640" y2="312" stroke="#2b4365" stroke-width="3"/>
  <line x1="200" y1="76" x2="232" y2="76" stroke="#f08a24" stroke-width="3" stroke-linecap="round"/>
  <g id="text">
    <text id="kicker" class="end-kicker" x="200" y="96">AI PREDICTION LAB</text>
    <text id="lead" class="end-lead" x="200" y="216">$lead</text>
    <text id="ledger" class="end-ledger" x="200" y="238">$ledger</text>
  </g>
  <!-- The call to action pops in after the rest; the arrow points down at the reply button under the video. -->
  <g id="cta">
    <text id="ask" class="end-ask" x="200" y="142">$ask</text>
    <text id="reply" class="end-reply" x="200" y="178">$reply</text>
    $arrow
  </g>
  <!-- character -->
</svg>""")


def end_card(text: dict) -> str:
    words = {key: html.escape(text[key], quote=False) for key in ("ask", "reply", "lead", "ledger")}
    return END_CARD.substitute(words, arrow=END_ARROW if text["arrow"] else "")


# A story's question over the cut from its hook: the ask, then its two answers, which episode.js pops in.
# Its plate hides the monitor's header and first label under it and stops short of the track below.
QUESTION_CARD = Template("""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360">
  <style>
    .q-ask { fill: #fff; font: 700 32px Bahnschrift, 'Segoe UI', sans-serif; paint-order: stroke; stroke: #0a1526; stroke-width: 5px; stroke-linejoin: round; }
    .q-answer { font: 700 18px Bahnschrift, 'Segoe UI', sans-serif; paint-order: stroke; stroke: #0a1526; stroke-width: 4px; stroke-linejoin: round; }
    .q-frozen { fill: #8fd3ff; }
    .q-out { fill: #ff4655; }
    .q-dot { fill: #b9c6d8; }
  </style>
  <rect x="20" y="10" width="600" height="82" rx="10" fill="#0a1526" stroke="#2a3d5c" stroke-width="1.5"/>
  <g id="words">
    <text id="ask" class="q-ask" x="320" y="46" text-anchor="middle">$ask</text>
    <text id="answers" class="q-answer" x="320" y="74" text-anchor="middle"><tspan class="q-frozen">$frozen</tspan><tspan class="q-dot"> · </tspan><tspan class="q-out">$out</tspan></text>
  </g>
</svg>""")


def question_card(text: dict) -> str:
    return QUESTION_CARD.substitute({key: html.escape(text[key], quote=False) for key in ("ask", "frozen", "out")})


# A story's subtitles in the band under the screen, clear of the captions on it, unless a cue sets its
# pill's top ("y") to clear something else there; a cue can also be scaled up about its middle ("scale")
# so it stands out. One group per cue, whose dark pill subtitles.js sizes to the line and which it fades
# in and out over the cue's frames.
SUB_Y = 325
SUB_CENTRE = 320
SUB_HEIGHT = 28
SUB_BASELINE = 20  # the line's baseline below the pill's top
SUBS_CARD = Template("""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360">
  <style>
    .sub { opacity: 0; }
    .sub-pill { fill: #0a1526; fill-opacity: 0.9; stroke: #2a3d5c; stroke-width: 1; }
    .sub-text { fill: #fff; font: 700 17px Bahnschrift, 'Segoe UI', sans-serif; }
  </style>
$cues
</svg>""")
SUB_CUE = Template('  <g id="sub-$i" class="sub"$transform>'
                   '<rect id="sub-$i-pill" class="sub-pill" x="20" y="$y" width="600" height="$height" rx="$radius"/>'
                   '<text id="sub-$i-text" class="sub-text" x="$centre" y="$base" text-anchor="middle">$text</text></g>')


def sub_transform(y: int, scale: float) -> str:
    if scale == 1:
        return ""
    middle = y + SUB_HEIGHT // 2
    return f' transform="translate({SUB_CENTRE} {middle}) scale({scale}) translate({-SUB_CENTRE} {-middle})"'


def sub_cue(i: int, cue: dict) -> str:
    y = cue.get("y", SUB_Y)
    return SUB_CUE.substitute(i=i, y=y, base=y + SUB_BASELINE, height=SUB_HEIGHT, radius=SUB_HEIGHT // 2,
                              centre=SUB_CENTRE, transform=sub_transform(y, cue.get("scale", 1)),
                              text=html.escape(cue["text"], quote=False))


def subs_card(cues: list) -> str:
    for before, cue in zip([None, *cues], cues):
        if cue["to"] <= cue["from"] or (before and cue["from"] < before["to"]):
            raise SystemExit(f"subtitle {cue['text']!r} must end after it starts and start after the one before ends")
    return SUBS_CARD.substitute(cues="\n".join(sub_cue(i, cue) for i, cue in enumerate(cues)))


# The cold open over the chart before the calls are drawn: a shade for the caption band, the captions
# that episode.js writes one at a time, and a spinning coin for the 50% bar.
HOOK_CARD = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360">
  <style>
    .hook-title { fill: #fff; font: 900 30px 'Segoe UI', system-ui, sans-serif; paint-order: stroke; stroke: #0a1526; stroke-width: 5px; stroke-linejoin: round; }
    .hook-up { fill: #2fc4b2; }
    .hook-down { fill: #ff6b66; }
    .hook-coin { fill: #3a2600; font: 800 14px 'Segoe UI', system-ui, sans-serif; }
  </style>
  <defs>
    <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0a1526" stop-opacity="0.97"/>
      <stop offset="0.16" stop-color="#0a1526" stop-opacity="0.97"/>
      <stop offset="0.2" stop-color="#0a1526" stop-opacity="0.85"/>
      <stop offset="0.3" stop-color="#0a1526" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="640" height="360" fill="url(#shade)"/>
  <g id="beats"></g>
  <g id="coin">
    <g id="coin-spin">
      <circle id="coin-face" r="24" fill="#f2c14e" stroke="#a87412" stroke-width="3"/>
      <circle r="18.5" fill="none" stroke="#c99428" stroke-width="1.4"/>
      <text id="coin-text" class="hook-coin" y="5" text-anchor="middle">50%</text>
    </g>
  </g>
</svg>"""


def pose(scene: str) -> dict:
    comment = re.search(r"<!--(.*?)-->", scene, re.S).group(1)
    slot = re.search(r"Character slot: translate\(([-\d.]+) ([-\d.]+)\) scale\(([-\d.]+)\)", comment)

    def numbers(args: str) -> list:
        return [float(v) for v in args.split()]

    return {
        "x": float(slot[1]),
        "y": float(slot[2]),
        "scale": float(slot[3]),
        "rotate": {gid: numbers(args)[0] for gid, args in re.findall(r"([a-z-]+) rotate\(([^)]*)\)", comment)},
        "translate": {gid: numbers(args) for gid, args in re.findall(r"([a-z-]+) translate\(([^)]*)\)", comment)},
    }


def with_figure(svg: str) -> str:
    svg = must_replace(svg, "</style>", f"</style>\n  {FIGURE_STYLE}")
    return must_replace(svg, "<!-- character -->", f'<g id="place">\n{FIGURE}\n  </g>')


def prefixed(svg: str, prefix: str) -> str:
    svg = svg.replace("<svg ", '<svg id="root" ', 1)
    svg = re.sub(r'\bid="([^"]+)"', rf'id="{prefix}-\1"', svg)
    svg = svg.replace('href="#', f'href="#{prefix}-')
    return svg.replace("url(#", f"url(#{prefix}-")


def json_script(element_id: str, data) -> str:
    return f'\n<script type="application/json" id="{element_id}">{json.dumps(data)}</script>'


# What only a story page carries: the story itself, the last 4h candles of each chart, its own scripts after episode.js.
# A chart's optional "until" pins its last candle, so a later price refresh can't move a finished episode.
# The charts sit side by side, so they must end on the same candle.
def story_extras(story: dict) -> tuple:
    if story_path is None:
        return "", ""
    data = json_script("story", story)
    ends = set()
    for chart in story.get("charts", []):
        candles = json.loads(read(assets / "data" / chart["file"]))["candles"]
        if "until" in chart:
            candles = [c for c in candles if c["time"] <= chart["until"]]
            if not candles or candles[-1]["time"] != chart["until"]:
                raise SystemExit(f"chart {chart['id']}: no candle at {chart['until']}")
        candles = candles[-chart["last"]:]
        ends.add(candles[-1]["time"])
        data += json_script(f"candles-{chart['id']}", candles)
    if len(ends) > 1:
        raise SystemExit(f"the charts end on different candles: {sorted(ends)}")
    for name in story["scripts"]:
        if not (out_dir / name).is_file():
            raise SystemExit(f"story script {name} is not in {out_dir}")
    return data, "".join(f'\n<script src="{name}"></script>' for name in story["scripts"])


story = {**STANDARD, **json.loads(read(story_path))} if story_path else STANDARD
board = read(assets / "scenes" / story.get("boardScene", "board.svg"))
desk = read(assets / "scenes" / "desk.svg")
monitor = read(assets / "scenes" / "monitor.svg")
hook = read(assets / "scenes" / story["hook"]) if "hook" in story else HOOK_CARD
# A story can put the professor into the standard cold open; he goes last, over the captions.
if story.get("hookFigure"):
    hook = with_figure(must_replace(hook, "</svg>", "  <!-- character -->\n</svg>"))

# episode.js plays whichever layers the page has, in this order.
layers = {
    **({"board": prefixed(with_figure(board), "s1")} if story.get("board", True) else {}),
    **({"desk": prefixed(with_figure(desk), "s2")} if story.get("desk", True) else {}),
    "monitor": prefixed(read(assets / "scenes" / story["monitor"]), "s3"),
    "hook": prefixed(hook, "s0"),
    **({"question": prefixed(question_card(story["question"]), "s5")} if "question" in story else {}),
    "end": prefixed(with_figure(end_card({**END_TEXT, **story["end"]})), "s4"),
    # Subtitles go over everything, the end card too.
    **({"subs": prefixed(subs_card(story["subs"]), "s6")} if "subs" in story else {}),
}
poses = {"board": pose(board), "desk": pose(desk)}
# The monitor draws real BTC candles (episode/fetch_btc.mjs) and the AI ideas over them.
btc = json.loads(read(assets / "data" / "btc-daily.json"))
ideas = json.loads(read(assets / "data" / story["ideas"]))
logos = {path.stem: read(path) for path in sorted(LOGOS_DIR.glob("*.svg"))}
story_data, story_scripts = story_extras(story)

layer_html = "\n".join(f'<div class="layer" id="layer-{name}">\n{svg}\n</div>' for name, svg in layers.items())
page = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{html.escape(story["title"])}</title>
<style>
  @font-face {{ font-family: 'Caveat Brush'; src: url('{CHALK_FONT}') format('truetype'); }}
  html, body {{ margin: 0; width: 1280px; height: 720px; overflow: hidden; background: #13233a; }}
  .layer {{ position: absolute; inset: 0; opacity: 0; }}
  .layer > svg {{ display: block; width: 1280px; height: 720px; }}
  #flash {{ background: #1e3352; }}
</style>
</head>
<body>
{layer_html}
<div class="layer" id="flash"></div>
<script type="application/json" id="poses">{json.dumps(poses)}</script>
<script type="application/json" id="btc">{json.dumps(btc)}</script>
<script type="application/json" id="ideas">{json.dumps(ideas)}</script>
<script type="application/json" id="logos">{json.dumps(logos)}</script>{story_data}
<script src="rig.js"></script>
<script src="episode.js"></script>{story_scripts}
</body>
</html>
"""
shutil.copyfile(RIG_JS, out_dir / "rig.js")
(out_dir / story["html"]).write_text(page, encoding="utf-8")
print(json.dumps(poses))
