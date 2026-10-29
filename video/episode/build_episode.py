"""Assemble the grandpa episode preview page: hook -> board -> desk -> monitor -> end card.

Each scene gets its own unposed copy of grandpa; episode.js poses him frame by frame and
lands on the ready poses read from the scene comments, so the comments stay the single source.
All scenes share one document, so every id is prefixed per scene: s1-head, s2-head, ...
The rig (pivots, gait, floor contact) is the one the character pages use, copied next to the page.
"""
import json
import os
import re
import shutil
import sys
from pathlib import Path

assets, out_dir = Path(sys.argv[1]), Path(sys.argv[2])
RIG_JS = Path(__file__).resolve().parent.parent / "character" / "rig.js"
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

END_CARD = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360">
  <style>
    .end-kicker { fill: #f08a24; font: 700 12px 'Segoe UI', system-ui, sans-serif; letter-spacing: 2px; }
    .end-ask { fill: #fff; font: 900 36px 'Segoe UI', system-ui, sans-serif; }
    .end-reply { fill: #eef2f6; font: 700 20px 'Segoe UI', system-ui, sans-serif; }
    .end-arrow { fill: none; stroke: #f08a24; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
    .end-lead { fill: #b9c6d8; font: 14px 'Segoe UI', system-ui, sans-serif; }
    .end-muted { fill: #8193ad; font: 10px 'Segoe UI', system-ui, sans-serif; }
    .end-disclaimer { fill: #d5deea; font: 600 12px 'Segoe UI', system-ui, sans-serif; }
  </style>
  <rect width="640" height="360" fill="#13233a"/>
  <rect y="312" width="640" height="48" fill="#0d1828"/>
  <line x1="0" y1="312" x2="640" y2="312" stroke="#2b4365" stroke-width="3"/>
  <line x1="200" y1="76" x2="232" y2="76" stroke="#f08a24" stroke-width="3" stroke-linecap="round"/>
  <g id="text">
    <text class="end-kicker" x="200" y="96">AI PREDICTION LAB</text>
    <text class="end-lead" x="200" y="216">Results on Friday · follow to see them</text>
    <text class="end-muted" x="200" y="264">The host is an animated AI character, not a real person.</text>
    <text class="end-muted" x="200" y="279">Preview · sample layout · not real data</text>
    <text class="end-disclaimer" x="200" y="332">This is an experiment and documentation, not financial advice.</text>
    <text class="end-disclaimer" x="200" y="347">I do not recommend buying or selling anything.</text>
  </g>
  <!-- The call to action pops in after the rest; the arrow points down at the reply button under the video. -->
  <g id="cta">
    <text class="end-ask" x="200" y="142">Who's right by Friday?</text>
    <text class="end-reply" x="200" y="178">Reply with your pick</text>
    <path class="end-arrow" d="M404 162 C418 162 426 170 426 186 M419 180 L426 188 L433 180"/>
  </g>
  <!-- character -->
</svg>"""


# The cold open over the finished monitor: a shade for the caption band, two captions that
# episode.js writes from the ideas, a spinning coin for the 50% bar and the draft label.
HOOK_CARD = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360">
  <style>
    .hook-title { fill: #fff; font: 900 34px 'Segoe UI', system-ui, sans-serif; paint-order: stroke; stroke: #0a1526; stroke-width: 5px; stroke-linejoin: round; }
    .hook-sub { fill: #d5deea; font: 600 15px 'Segoe UI', system-ui, sans-serif; paint-order: stroke; stroke: #0a1526; stroke-width: 4px; stroke-linejoin: round; }
    .hook-up { fill: #2fc4b2; }
    .hook-down { fill: #ff6b66; }
    .hook-coin { fill: #6b4a08; font: 800 10px 'Segoe UI', system-ui, sans-serif; }
    .hook-draft { fill: #b9c6d8; font: 600 9px 'Segoe UI', system-ui, sans-serif; paint-order: stroke; stroke: #0a1526; stroke-width: 3px; }
  </style>
  <defs>
    <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0a1526" stop-opacity="0.97"/>
      <stop offset="0.17" stop-color="#0a1526" stop-opacity="0.97"/>
      <stop offset="0.24" stop-color="#0a1526" stop-opacity="0.85"/>
      <stop offset="0.36" stop-color="#0a1526" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="640" height="360" fill="url(#shade)"/>
  <g id="beats"></g>
  <g id="coin">
    <g id="coin-spin">
      <circle id="coin-face" r="17" fill="#f2c14e" stroke="#a87412" stroke-width="2.5"/>
      <circle r="12.5" fill="none" stroke="#c99428" stroke-width="1.2"/>
      <text id="coin-text" class="hook-coin" y="3.5" text-anchor="middle">50%</text>
    </g>
  </g>
  <text class="hook-draft" x="12" y="350">DRAFT · sample ideas, not real calls</text>
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
    return svg.replace("url(#", f"url(#{prefix}-")


board = read(assets / "scenes" / "board.svg")
desk = read(assets / "scenes" / "desk.svg")
monitor = read(assets / "scenes" / "monitor.svg")

layers = {
    "board": prefixed(with_figure(board), "s1"),
    "desk": prefixed(with_figure(desk), "s2"),
    "monitor": prefixed(monitor, "s3"),
    "hook": prefixed(HOOK_CARD, "s0"),
    "end": prefixed(with_figure(END_CARD), "s4"),
}
poses = {"board": pose(board), "desk": pose(desk)}
# The monitor draws real BTC candles (episode/fetch_btc.mjs) and the AI ideas over them.
btc = json.loads(read(assets / "data" / "btc-daily.json"))
ideas = json.loads(read(assets / "data" / "ideas-sample.json"))

layer_html = "\n".join(f'<div class="layer" id="layer-{name}">\n{svg}\n</div>' for name, svg in layers.items())
page = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Grandpa episode preview</title>
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
<script src="rig.js"></script>
<script src="episode.js"></script>
</body>
</html>
"""
shutil.copyfile(RIG_JS, out_dir / "rig.js")
(out_dir / "episode.html").write_text(page, encoding="utf-8")
print(json.dumps(poses))
