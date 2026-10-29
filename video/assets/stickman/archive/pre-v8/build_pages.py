"""Build the grandpa character pages: pose sheet, old-vs-new close-up, scene size check, both scenes, walk test.

Usage: python build_pages.py <assets dir> <out dir>
Every panel gets its own copy of the figure with prefixed ids (old-head, new-head, ...);
rig.js and pages.js pose them, body[data-page] picks which page script runs.
"""
import re
import sys
from pathlib import Path

assets, out = Path(sys.argv[1]), Path(sys.argv[2])
FLOOR = 254


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def must_replace(text: str, old: str, new: str) -> str:
    if text.count(old) != 1:
        raise SystemExit(f"expected exactly one {old!r}, found {text.count(old)}")
    return text.replace(old, new)


def figure(svg: str) -> tuple[str, str]:
    style = re.search(r"<style>.*?</style>", svg, re.S).group(0)
    start = svg.index('  <g id="grandpa">')
    end = svg.index("\n  </g>", start) + len("\n  </g>")
    return style, svg[start:end]


def prefixed(svg: str, prefix: str) -> str:
    svg = re.sub(r'\bid="([^"]+)"', rf'id="{prefix}-\1"', svg)
    return svg.replace("url(#", f"url(#{prefix}-")


V2_STYLE, V2 = figure(read(assets / "stickman" / "grandpa.svg"))
# The previous look, for before/after panels. It shares the gp- classes, and styles are global, so rename them.
PREV_STYLE, PREV = figure(read(assets / "stickman" / "archive" / "grandpa-v6.svg").replace("gp-", "gpo-"))
FIGURES = {"prev": PREV, "v2": V2}


def placed(prefix: str, rig: str) -> str:
    return f'<g id="{prefix}-place"><g id="{prefix}-props"></g>{prefixed(FIGURES[rig], prefix)}</g>'


def panel(prefix: str, rig: str, label: str, view: tuple, zoom: float) -> str:
    x, y, w, h = view
    ground = (
        f'<rect x="{x}" y="{FLOOR}" width="{w}" height="{y + h - FLOOR}" fill="#0d1828"/>'
        f'<line x1="{x}" y1="{FLOOR}" x2="{x + w}" y2="{FLOOR}" stroke="#2b4365" stroke-width="2"/>'
        if y + h > FLOOR
        else ""
    )
    return (
        f'<figure><figcaption>{label}</figcaption>'
        f'<svg viewBox="{x} {y} {w} {h}" width="{w * zoom:g}" height="{h * zoom:g}">'
        f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="#13233a"/>{ground}{placed(prefix, rig)}</svg></figure>'
    )


def scene(prefix: str, label: str, svg: str, width: int) -> str:
    svg = must_replace(svg, "</style>", f"</style>\n  {V2_STYLE}")
    svg = must_replace(svg, "<!-- character -->", f'<g id="place"><g id="props"></g>{V2}</g>')
    svg = re.sub(r'\swidth="\d+" height="\d+"', f' width="{width}" height="{width * 9 // 16}"', svg, count=1)
    return f"<figure><figcaption>{label}</figcaption>{prefixed(svg, prefix)}</figure>"


def page(name: str, title: str, body: str, width: int) -> None:
    html = f"""<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<title>{title}</title>
<style>
  html, body {{ margin: 0; background: #0b1524; }}
  body {{ width: {width}px; padding: 16px; box-sizing: border-box; font: 15px 'Segoe UI', system-ui, sans-serif; color: #b9c6d8; }}
  h1 {{ margin: 0 0 12px; font-size: 20px; color: #eef2f6; }}
  .row {{ display: flex; gap: 12px; align-items: flex-end; margin-bottom: 16px; flex-wrap: wrap; }}
  figure {{ margin: 0; }}
  figcaption {{ margin-bottom: 6px; }}
  svg {{ display: block; border-radius: 6px; }}
</style>
{PREV_STYLE}
{V2_STYLE}
</head>
<body data-page="{name}">
<h1>{title}</h1>
{body}
<script src="rig.js"></script>
<script src="pages.js"></script>
</body>
</html>
"""
    (out / f"{name}.html").write_text(html, encoding="utf-8")


STAND = (0, 20, 160, 250)
sheet = (
    '<div class="row">'
    + panel("old", "prev", "Было", STAND, 2)
    + panel("new", "v2", "Стало (плечи)", STAND, 2)
    + panel("board", "v2", "У доски", (-70, 0, 240, 270), 2)
    + panel("desk", "v2", "За столом", (20, 0, 300, 270), 2)
    + '</div><div class="row">'
    + "".join(panel(f"w{k}", "v2", f"Шаг, фаза {k + 1}/8", (-10, 20, 180, 250), 1.1) for k in range(8))
    + "</div>"
)
page("sheet", "Дед v4: позы", sheet, 1840)

closeup = (
    '<div class="row">'
    + panel("old", "prev", "Было", (30, 15, 100, 150), 4.5)
    + panel("new", "v2", "Стало (плечи)", (30, 15, 100, 150), 4.5)
    + "</div>"
)
page("closeup", "Дед: голова, борода, галстук", closeup, 960)

# The figure stays at its own coordinates here (pages.js), so one view frames the shoulders in every pose.
SHOULDER_VIEW = (50, 86, 60, 34)
SHOULDER_POSES = ["стоит", "шаг: левая рука вперёд", "шаг: правая вперёд", "у доски", "за столом"]
shoulders = "".join(
    '<div class="row">'
    + "".join(panel(f"{tag}{k}", rig, f"{label}: {name}", SHOULDER_VIEW, 5.5) for k, name in enumerate(SHOULDER_POSES))
    + "</div>"
    for tag, rig, label in (("o", "prev", "Было"), ("n", "v2", "Стало"))
)
page("shoulders", "Дед: плечи", shoulders, 1780)

board = read(assets / "scenes" / "board.svg")
sizes = scene("now", "Сейчас: масштаб 1.25", board, 900) + scene("small", "Меньше: масштаб 1.0", board, 900)
page("scale", "Дед в сцене у доски: размер", f'<div class="row">{sizes}</div>', 1860)

desk = read(assets / "scenes" / "desk.svg")
both = scene("sb", "У доски: масштаб 1.0", board, 900) + scene("sd", "За столом: масштаб 1.0", desk, 900)
page("scenes", "Дед в сценах: масштаб 1.0", f'<div class="row">{both}</div>', 1860)

ticks = "".join(f'<line x1="{x}" y1="641" x2="{x}" y2="652" stroke="#2b4365" stroke-width="2"/>' for x in range(0, 1281, 40))
walk_svg = (
    '<svg viewBox="0 0 1280 720" width="1280" height="720" style="position:fixed;inset:0;border-radius:0">'
    '<rect width="1280" height="720" fill="#13233a"/><rect y="640" width="1280" height="80" fill="#0d1828"/>'
    f'<line x1="0" y1="640" x2="1280" y2="640" stroke="#2b4365" stroke-width="3"/>{ticks}'
    f'{placed("walk", "v2")}</svg>'
)
page("walk", "Дед: ходьба", walk_svg, 1280)
print("built sheet, closeup, shoulders, scale, scenes, walk in", out)
