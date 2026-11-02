/*
 * The gold in 2025 cold open (assets/scenes/hook-gold.svg), in place of the standard hook.
 * Gold's and bitcoin's 2025 changes stand side by side from the first frame; their 2025 lines draw in faintly
 * behind them on one scale, a light band sweeps once across gold's number, the sparks twinkle and the camera
 * pushes in a little. The changes and the lines come from the candles, so the hook and the monitor can't disagree.
 * Loads after episode.js and uses its helpers; an IIFE, because classic scripts share one global scope.
 */
(() => {
  'use strict';

  const STORY = JSON.parse(document.getElementById('story').textContent);

  const ROWS = [
    { mark: 'who-mark', word: 'who-word', width: 34, centre: 180 },
    { mark: 'btc-mark', word: 'btc-word', width: 20, centre: 460 },
  ];
  const ROW = { markHeight: 20, gap: 12, wordSpacing: 5, mid: 107.5 };
  const TREND_X = { gold: [40, 300], btc: [340, 600] }; // each line under its own column
  const TREND = { top: 104, bottom: 318, pad: 8 };
  const TREND_DRAW = 0.8; // share of the hook the lines take to draw
  const SHINE = { start: 8, length: 24, from: 0, to: 300 }; // px the band slides, left to right
  const TWINKLE = 0.22; // radians per frame
  const PUSH_IN = 0.05; // the camera closes in this much over the hook
  const CENTRE = [320, 180];
  const ASK_RIGHT = 624; // the end card's right margin

  // 2025 only, from the year's first open to its last close: the same span the race on the monitor uses.
  function year2025(id) {
    const data = document.getElementById(`candles-${id}`);
    if (!data) throw new Error(`gold: no candles for the ${id} chart`);
    const year = JSON.parse(data.textContent).filter(({ day }) => day.startsWith('2025-'));
    if (year.length !== 365) throw new Error(`gold: the ${id} chart has ${year.length} days of 2025, not 365`);
    return [year[0].open, ...year.map(({ close }) => close)];
  }

  // A mark and its word, centred as one row over the column; letter-spacing trails the last letter.
  function layoutRow({ mark, word, width, centre }) {
    const text = $('s0', word);
    const wordWidth = text.getComputedTextLength() - ROW.wordSpacing;
    const x0 = centre - (width + ROW.gap + wordWidth) / 2;
    $('s0', mark).setAttribute('transform', `translate(${x0} ${ROW.mid - ROW.markHeight / 2})`);
    text.setAttribute('x', x0 + width + ROW.gap);
  }

  // Both lines rebased to 100 on one scale, so even the faint shapes behind the numbers compare fairly.
  function planTrends(years) {
    const rebased = Object.entries(years).map(([id, values]) => [id, values.map((v) => (100 * v) / values[0])]);
    const all = rebased.flatMap(([, values]) => values);
    const lo = Math.min(...all);
    const hi = Math.max(...all);
    for (const [id, values] of rebased) {
      const [x0, x1] = TREND_X[id];
      const points = values.map((v, i) => [
        x0 + (i / (values.length - 1)) * (x1 - x0),
        TREND.bottom - ((v - lo) / (hi - lo)) * (TREND.bottom - TREND.top),
      ]);
      const line = points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
      $('s0', `trend-${id}-line`).setAttribute('d', line);
      $('s0', `trend-${id}-area`).setAttribute('d', `${line} L${x1} 360 L${x0} 360 Z`);
    }
  }

  function change(values) {
    const delta = values.at(-1) / values[0] - 1;
    return signed(delta, `${Math.round(Math.abs(delta) * 100)}%`);
  }

  // The end's question lands from BEAT_POP larger, scaled about its left edge; a long one shrinks so it stays in frame.
  function fitAsk() {
    const ask = $('s4', 'ask');
    const room = (ASK_RIGHT - CTA.x) / (1 + BEAT_POP);
    const width = ask.getComputedTextLength();
    if (width > room) ask.style.fontSize = `${(parseFloat(getComputedStyle(ask).fontSize) * room) / width}px`;
  }

  function planGoldHook() {
    fitAsk();
    ROWS.forEach(layoutRow);
    const years = { gold: year2025('gold'), btc: year2025('btc') };
    planTrends(years);
    const gold = change(years.gold);
    [...$('s0', 'big').querySelectorAll('text'), $('s0', 'big-clip-text')].forEach((node) => (node.textContent = gold));
    $('s0', 'big-btc').textContent = change(years.btc);
    return {
      reveals: Object.entries(TREND_X).map(([id, span]) => ({ node: $('s0', `trend-${id}-reveal`), span })),
      shine: $('s0', 'shine'),
      sparks: [...$('s0', 'sparks').querySelectorAll('.gh-spark')].map((node, i) => ({
        node,
        at: node.getAttribute('transform'),
        phase: i * 1.7,
      })),
    };
  }

  function renderGoldHook(plan, h) {
    const drawn = ease(progress(h, 0, STORY.hookFrames * TREND_DRAW));
    plan.reveals.forEach(({ node, span: [x0, x1] }) => {
      node.setAttribute('x', x0 - TREND.pad);
      node.setAttribute('width', (x1 - x0 + 2 * TREND.pad) * drawn);
    });
    const sweep = progress(h, SHINE.start, SHINE.length);
    plan.shine.style.opacity = sweep > 0 && sweep < 1 ? 1 : 0;
    plan.shine.setAttribute('transform', `translate(${lerp(SHINE.from, SHINE.to, ease(sweep))} 0) skewX(-18)`);
    plan.sparks.forEach(({ node, at, phase }) => {
      const glint = 0.5 + 0.5 * Math.sin(h * TWINKLE + phase);
      node.style.opacity = lerp(0.15, 0.9, glint);
      node.setAttribute('transform', `${at} scale(${lerp(0.6, 1.1, glint)})`);
    });
    const zoom = 1 + PUSH_IN * (h / STORY.hookFrames);
    setViewBox('s0', [CENTRE[0] - CENTRE[0] / zoom, CENTRE[1] - CENTRE[1] / zoom, 640 / zoom, 360 / zoom]);
  }

  // The end builds line by line, like a call episode's, so the last seconds never sit still.
  window.STORY = {
    ...window.STORY,
    hookFrames: STORY.hookFrames,
    planHook: planGoldHook,
    renderHook: renderGoldHook,
    renderHookScreen: null,
    renderEnd,
  };
})();
