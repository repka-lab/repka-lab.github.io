// Poses for every character page; body[data-page] picks the page.
(function () {
  const { RIGS, STANDING, SEATED, walk, walkOffset, lowestSole, hand, chalkTip, pose } = window.Rig;
  const { v2, v7 } = RIGS;
  const FLOOR = 254;
  const BOARD = {
    head: -6,
    'arm-left': -5.3,
    'arm-left-forearm': 107.2,
    'arm-right': -11.1,
    'arm-right-forearm': 62.9,
    ...STANDING,
  };
  // Seated in profile, both shoulders at x 80; the hands rest on the near half of the keyboard (arm_fit.mjs).
  const DESK = {
    head: 4,
    'arm-left': -29,
    'arm-left-forearm': -95.5,
    'arm-right': -33.5,
    'arm-right-forearm': -49.4,
    ...SEATED,
  };
  // At scale 1 the chalk sits on the Grok arrow of the re-laid board (arm_fit.mjs).
  const BOARD_1 = { ...BOARD, 'arm-left': 30.4, 'arm-left-forearm': 108 };
  // The v7 figure's poses, for the "before" panels: front torso when seated, hips and shoulders not drawn in.
  const OLD_DESK = {
    ...SEATED,
    hips: 0,
    shoulders: 0,
    head: 4,
    'arm-left': -53,
    'arm-left-forearm': -57.1,
    'arm-right': -13.1,
    'arm-right-forearm': -82.5,
  };
  const OLD_BOARD_1 = { ...BOARD, 'arm-left': 35.6, 'arm-left-forearm': 97.5 };

  const props = (prefix, markup) => {
    document.getElementById(`${prefix}-props`).innerHTML = markup;
  };

  // Poses the figure and drops it so the lower sole rests on the floor.
  function onFloor(prefix, rig, opts, x = 0, floor = FLOOR, scale = 1) {
    const parts = opts.parts ?? {};
    pose(prefix, rig, { ...opts, place: [x, floor - scale * lowestSole(rig, parts, opts.feet), scale] });
  }

  function boardProps(prefix, parts) {
    const [tx, ty] = chalkTip(v2, parts);
    props(
      prefix,
      `<rect x="-60" y="15" width="108" height="181" rx="3" fill="#1e4a3c" stroke="#b8642a" stroke-width="6"/>
       <path d="M${tx - 44} ${ty + 30} L${tx - 24} ${ty + 8} L${tx} ${ty}" fill="none" stroke="#f4f1e8"
             stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`,
    );
  }

  function deskProps(prefix, rig, parts) {
    const [lx, ly] = hand(rig, parts, 'left');
    const [rx, ry] = hand(rig, parts, 'right');
    const floor = lowestSole(rig, parts, 'right');
    const keys = Math.max(ly, ry) + 1.5;
    const top = keys + 7;
    props(
      prefix,
      `<path d="M52 166 L46 98 Q46 91 51.5 91 Q57 91 57 98 L61 164 Z" fill="#1f7a5c" stroke="#0d1828" stroke-width="2" stroke-linejoin="round"/>
       <line x1="84" y1="170" x2="84" y2="${floor - 7}" stroke="#8fa3bf" stroke-width="4" stroke-linecap="round"/>
       <line x1="66" y1="${floor - 6}" x2="102" y2="${floor - 6}" stroke="#8fa3bf" stroke-width="4" stroke-linecap="round"/>
       <circle cx="68" cy="${floor - 3}" r="3" fill="#8fa3bf"/><circle cx="100" cy="${floor - 3}" r="3" fill="#8fa3bf"/>
       <rect x="50" y="161.5" width="68" height="8" rx="3" fill="#1f7a5c" stroke="#0d1828" stroke-width="2"/>
       <rect x="152" y="${top + 4}" width="8" height="${floor - top - 4}" fill="#8a4a1f" stroke="#0d1828" stroke-width="2"/>
       <rect x="${Math.min(lx, rx) - 16}" y="${top}" width="200" height="7" rx="2" fill="#b8642a" stroke="#0d1828" stroke-width="2"/>
       <rect x="${Math.min(lx, rx) - 8}" y="${keys}" width="${Math.abs(rx - lx) + 16}" height="6" rx="2" fill="#2b4365" stroke="#8fa3bf" stroke-width="1.5"/>`,
    );
  }

  const WALK_STEPS = 8;

  function sheet() {
    onFloor('old', v7, { parts: STANDING });
    onFloor('new', v2, { parts: STANDING });
    onFloor('board', v2, { parts: BOARD, eyes: [-3, 0], chalk: true }, 10);
    boardProps('board', BOARD);
    for (const [prefix, rig, parts] of [['deskold', v7, OLD_DESK], ['desk', v2, DESK]]) {
      onFloor(prefix, rig, { parts, eyes: [3, -1], feet: 'right' }, -10);
      deskProps(prefix, rig, parts);
    }
    for (let k = 0; k < WALK_STEPS; k++) {
      const phase = -Math.PI / 2 + (k * 2 * Math.PI) / WALK_STEPS;
      onFloor(`w${k}`, v2, { parts: walk(v2, phase, 1), eyes: [2.5, 0], feet: 'right' });
    }
  }

  function closeup() {
    onFloor('old', v7, { parts: STANDING });
    onFloor('new', v2, { parts: STANDING });
  }

  // Same order as SHOULDER_POSES in build_pages.py; left arm forward is sin -1, right arm forward sin +1.
  const shoulderPoses = (rig, board, desk) => [STANDING, walk(rig, -Math.PI / 2, 1), walk(rig, Math.PI / 2, 1), board, desk];
  const SHOULDER_ROWS = [['o', v7, shoulderPoses(v7, OLD_BOARD_1, OLD_DESK)], ['n', v2, shoulderPoses(v2, BOARD_1, DESK)]];
  const CHALK_POSE = 3;

  function shoulders() {
    for (const [tag, rig, poses] of SHOULDER_ROWS) {
      poses.forEach((parts, k) => pose(`${tag}${k}`, rig, { parts, place: [0, 0, 1], chalk: k === CHALK_POSE }));
    }
  }

  // The board scene as it is now (scale 1.25) and one size down, chalk on the same spot.
  function scale() {
    const SCENE_FLOOR = 333.2;
    const SLOT = { x: 350, scale: 1.25 };
    const [tx] = chalkTip(v2, BOARD);
    for (const [prefix, s] of [['now', SLOT.scale], ['small', 1]]) {
      const x = SLOT.x + (SLOT.scale - s) * tx;
      onFloor(prefix, v2, { parts: BOARD, eyes: [-3, 0], chalk: true }, x, SCENE_FLOOR, s);
    }
  }

  // Reads "Character slot: translate(x y) scale(s)" from the scene's own comment, as build_episode.py does.
  function slot(prefix) {
    const svg = document.getElementById(`${prefix}-place`).ownerSVGElement;
    const note = [...svg.childNodes].find((n) => n.nodeType === Node.COMMENT_NODE && n.data.includes('Character slot'));
    return note.data.match(/Character slot: translate\(([-\d.]+) ([-\d.]+)\) scale\(([-\d.]+)\)/).slice(1).map(Number);
  }

  const toScene = (el) => el.ownerSVGElement.getScreenCTM().inverse().multiply(el.getScreenCTM());

  // Bounding box in the scene's own coordinates, grown by pad for stroke width.
  function box(el, pad = 0) {
    const b = el.getBBox();
    const m = toScene(el);
    const pts = [[b.x, b.y], [b.x + b.width, b.y], [b.x, b.y + b.height], [b.x + b.width, b.y + b.height]].map(([x, y]) =>
      new DOMPoint(x, y).matrixTransform(m),
    );
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    return { x0: Math.min(...xs) - pad, y0: Math.min(...ys) - pad, x1: Math.max(...xs) + pad, y1: Math.max(...ys) + pad };
  }

  // Points along a stroke every pixel or so, in scene coordinates; a box would flag text inside an L or a frame.
  function trace(el) {
    const m = toScene(el);
    const length = el.getTotalLength();
    const n = Math.ceil(length);
    return Array.from({ length: n + 1 }, (_, i) => el.getPointAtLength((i * length) / n).matrixTransform(m));
  }

  // A label's letters: the em box of a script font is far taller, so keep cap height above and descenders below the baseline.
  function ink(el) {
    const b = box(el);
    const y = Number(el.getAttribute('y'));
    const size = parseFloat(getComputedStyle(el).fontSize);
    return { ...b, y0: Math.max(b.y0, y - 0.8 * size), y1: Math.min(b.y1, y + 0.3 * size) };
  }

  const meets = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
  const covers = (b, p) => b.x0 < p.x && p.x < b.x1 && b.y0 < p.y && p.y < b.y1;
  const at = ([x, y], [sx, sy, s]) => [sx + s * x, sy + s * y].map((v) => +v.toFixed(1));
  const r1 = (v) => +v.toFixed(1);

  // Chalk tip, soles and every chalk label against its neighbours and the board edge.
  function boardReport() {
    const place = slot('sb');
    const STROKE = 1.5;
    const inner = box(document.querySelector('#sb-board rect'), -4);
    const marks = [...document.getElementById('sb-chalk-drawing').children].map((el) => {
      const text = el.tagName === 'text';
      return { el, text, box: text ? ink(el) : box(el, STROKE), points: text ? [] : trace(el) };
    });
    const name = (m) => (m.text ? `"${m.el.textContent}"` : `${m.el.tagName}@${Math.round(m.box.x0)},${Math.round(m.box.y0)}`);
    const texts = marks.filter((m) => m.text);
    const strokes = marks.filter((m) => !m.text);
    // Text against text on the same baseline, and text against every stroke it comes within STROKE of.
    const clashes = [
      ...texts.flatMap((a, i) =>
        texts
          .slice(i + 1)
          .filter((b) => a.el.getAttribute('y') === b.el.getAttribute('y') && meets(a.box, b.box))
          .map((b) => `${name(a)} x ${name(b)}`),
      ),
      ...texts.flatMap((t) => {
        const near = { x0: t.box.x0 - STROKE, y0: t.box.y0 - STROKE, x1: t.box.x1 + STROKE, y1: t.box.y1 + STROKE };
        return strokes.filter((s) => s.points.some((p) => covers(near, p))).map((s) => `${name(t)} x ${name(s)}`);
      }),
    ];
    // Gap from each label to the nearest stroke on its right, where the arrows sit.
    const gaps = texts.map((t) => {
      const right = strokes.flatMap((s) => s.points).filter((p) => p.x > t.box.x1 && p.y > t.box.y0 && p.y < t.box.y1);
      return right.length ? r1(Math.min(...right.map((p) => p.x)) - STROKE - t.box.x1) : null;
    });
    const outside = marks.filter((m) => m.box.x0 < inner.x0 || m.box.x1 > inner.x1 || m.box.y0 < inner.y0 || m.box.y1 > inner.y1);
    return [
      `board slot ${place.join(' ')}`,
      `  chalk tip ${at(chalkTip(v2, BOARD_1), place)}  (Grok arrow 410,199.5)`,
      `  soles y ${r1(place[1] + place[2] * lowestSole(v2, BOARD_1))}  (floor line 330)`,
      `  highest stroke y ${r1(Math.min(...strokes.map((m) => m.box.y0)))}`,
      ...texts.map((m, i) => `  ${name(m)} x ${r1(m.box.x0)}..${r1(m.box.x1)}${gaps[i] === null ? '' : `, stroke ${gaps[i]} px to the right`}`),
      `  clashes: ${clashes.join('; ') || 'none'}`,
      `  outside the board: ${outside.map(name).join('; ') || 'none'}`,
    ];
  }

  // Hands over the keys, soles on the floor, knees and toes clear of the front desk leg.
  function deskReport() {
    const place = slot('sd');
    const [leg, , top] = document.querySelectorAll('#sd-desk rect');
    const legs = ['left', 'right'].map((side) => box(document.getElementById(`sd-leg-${side}`)));
    const keys = box(document.getElementById('sd-keyboard'));
    return [
      `desk slot ${place.join(' ')}`,
      `  hands ${at(hand(v2, DESK, 'left'), place)} / ${at(hand(v2, DESK, 'right'), place)}  (keyboard ${r1(keys.x0)}..${r1(keys.x1)}, top y ${r1(keys.y0)})`,
      `  soles y ${r1(place[1] + place[2] * lowestSole(v2, DESK, 'right'))}  (floor line 312)`,
      `  legs reach x ${r1(Math.max(...legs.map((b) => b.x1)))}  (front desk leg from x ${r1(box(leg).x0)})`,
      `  thighs from y ${r1(Math.min(...legs.map((b) => b.y0)))}  (desk top underside y ${r1(box(top).y1)})`,
    ];
  }

  // Both episode scenes at scale 1, posed from their slot comments.
  function scenes() {
    pose('sb', v2, { place: slot('sb'), parts: BOARD_1, eyes: [-3, 0], chalk: true });
    pose('sd', v2, { place: slot('sd'), parts: DESK, eyes: [3, -1], feet: 'right' });
    window.report = [...boardReport(), ...deskReport()].join('\n');
  }

  // Walks right across the frame with the stance foot planted.
  function walkLoop() {
    const FRAMES = 240;
    const CYCLE = 36;
    const SCALE = 1.8;
    const GROUND = 640;
    const START = -260;
    window.TOTAL_FRAMES = FRAMES;
    window.renderFrame = (f) => {
      const phase = -Math.PI / 2 + (f * 2 * Math.PI) / CYCLE;
      const parts = walk(v2, phase, 1);
      const x = START + SCALE * (walkOffset(v2, phase) - walkOffset(v2, -Math.PI / 2));
      onFloor('walk', v2, { parts, eyes: [2.5, 0], feet: 'right' }, x, GROUND + 1, SCALE);
    };
    window.renderFrame(0);
  }

  const PAGES = { sheet, closeup, shoulders, scale, scenes, walk: walkLoop };
  PAGES[document.body.dataset.page]();
  window.episodeReady = Promise.resolve();
})();
