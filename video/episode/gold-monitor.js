/*
 * Gold in 2025 on the monitor (assets/scenes/monitor-gold.svg), in place of the AI ideas screen.
 * Three beats, one at a time: XAUT and BTC through 2025 from the same 100, the five reasons gold rose,
 * then XAUT from the first candle to the last, the climb to the record, the fall of Jan 30, 2026 and the
 * drop since, with BTC's drop from its own top beside it. Every line, gridline and figure is drawn from
 * the candles, so the screen and the data can't disagree.
 * Loads after episode.js and uses its helpers; an IIFE, because classic scripts share one global scope.
 */
(() => {
  'use strict';

  const STORY = JSON.parse(document.getElementById('story').textContent);
  const CHARTS = Object.fromEntries((STORY.charts ?? []).map((chart) => {
    const data = document.getElementById(`candles-${chart.id}`);
    if (!data) throw new Error(`gold: no candles for the ${chart.id} chart`);
    return [chart.id, JSON.parse(data.textContent)];
  }));

  const BEAT_FADE = 6;
  const CARD_POP = 6; // frames for a card, a label or a dot to come in
  const LABEL_GAP = 48; // end labels keep at least this far apart
  const RACE = { x0: 70, x1: 490, top: 82, bottom: 270, step: 20, gold: [4, 40], btc: [35, 70] };
  const MONTHS = [['01', 'JAN'], ['04', 'APR'], ['07', 'JUL'], ['10', 'OCT']];
  const WHY_AT = [25, 60, 108, 148, 197]; // one row per reason, as the voice names it
  const RECORD = { x0: 70, x1: 450, top: 82, bottom: 270, range: [2400, 6200], grid: [3000, 4000, 5000] };
  // The line runs in legs and stops where the voice names a point: the record, the fall the day
  // after, then on to the last candle as it says how far gold fell.
  const LEGS = [['peak', 6, 70], ['jan30', 127, 10], ['last', 210, 50]]; // [stop, start, length]
  const MARKS = [{ id: 'jan30', day: '2026-01-30', label: [-12, 0] }]; // label: offset from the dot
  const MARK_LABEL_DELAY = 8;
  const PEAK_AT = 76;
  const PEAK_LABEL_AT = 84;
  const DROP_LABEL_AT = 268;
  const BTC_AT = 353;
  const BRACKET_X = 462;
  const AXIS_LABEL_X = 62;
  const AXIS_LABEL_Y = 288;

  const fixed = (v) => v.toFixed(1);
  const pathOf = (points) => points.map(([x, y], i) => `${i ? 'L' : 'M'}${fixed(x)} ${fixed(y)}`).join(' ');
  const percent = (ratio) => signed(ratio - 1, `${Math.round(Math.abs(ratio - 1) * 100)}%`);

  function popIn(node, [x, y], t, from = 0) {
    node.style.opacity = t;
    node.setAttribute('transform', `translate(${x} ${y}) scale(${lerp(from, 1, t)}) translate(${-x} ${-y})`);
  }
  // riseIn for a group placed by its transform: the rise rides on top of the placement.
  function riseAt(node, [x, y], t) {
    node.style.opacity = t;
    node.setAttribute('transform', `translate(${x} ${y + (1 - t) * 6})`);
  }

  // A plot maps an index along the series and a value onto the screen.
  function plotOf(box, count, [lo, hi]) {
    return {
      ...box,
      lo,
      hi,
      x: (i) => box.x0 + (i / (count - 1)) * (box.x1 - box.x0),
      y: (v) => box.bottom - ((v - lo) / (hi - lo)) * (box.bottom - box.top),
    };
  }
  // The point a fraction of the way along a series, between its neighbours.
  function pointAt(points, fraction) {
    const at = fraction * (points.length - 1);
    const i = Math.min(Math.floor(at), points.length - 2);
    return mix(points[i], points[i + 1], at - i);
  }
  function revealTo(rect, plot, x) {
    rect.setAttribute('x', plot.x0 - 6);
    rect.setAttribute('width', Math.max(0, x - plot.x0 + 6));
  }
  function gridLine(group, plot, value, text, className = 'gm-grid') {
    group.append(svgEl('line', { class: className, x1: plot.x0, y1: plot.y(value), x2: plot.x1, y2: plot.y(value) }));
    group.append(textEl(text, { class: 'gm-muted', x: AXIS_LABEL_X, y: plot.y(value) + 3, 'text-anchor': 'end' }));
  }
  // Two label heights pushed apart symmetrically until they are `gap` apart.
  function spread([a, b], gap) {
    const short = gap - Math.abs(a - b);
    if (short <= 0) return [a, b];
    const push = (short / 2) * (a <= b ? 1 : -1);
    return [a - push, b + push];
  }

  // 2025 only, from the year's first open: both series start at exactly 100.
  function rebased(id) {
    const year = CHARTS[id].filter(({ day }) => day.startsWith('2025-'));
    if (year.length !== 365) throw new Error(`gold: the ${id} chart has ${year.length} days of 2025, not 365`);
    const values = [year[0].open, ...year.map(({ close }) => close)];
    return { year, values: values.map((v) => (100 * v) / values[0]) };
  }

  function planRace() {
    const gold = rebased('gold');
    const btc = rebased('btc');
    const all = [...gold.values, ...btc.values];
    const range = [Math.floor(Math.min(...all) / RACE.step) * RACE.step, Math.ceil(Math.max(...all) / RACE.step) * RACE.step];
    const plot = plotOf(RACE, gold.values.length, range);
    const grid = $('s3', 'race-grid');
    for (let v = range[0]; v <= range[1]; v += RACE.step) gridLine(grid, plot, v, String(v), v === 100 ? 'gm-base' : 'gm-grid');
    MONTHS.forEach(([month, text]) => {
      const i = gold.year.findIndex(({ day }) => day.slice(5, 7) === month);
      grid.append(textEl(text, { class: 'gm-muted', x: plot.x(i), y: AXIS_LABEL_Y }));
    });
    const series = (id, values, [start, length]) => {
      const points = values.map((v, i) => [plot.x(i), plot.y(v)]);
      $('s3', `race-${id}-line`).setAttribute('d', pathOf(points));
      $('s3', `race-${id}-value`).textContent = percent(values.at(-1) / 100);
      return { points, start, length, reveal: $('s3', `race-${id}-reveal`), tip: $('s3', `race-${id}-tip`), label: $('s3', `race-${id}-label`) };
    };
    const lines = [series('gold', gold.values, RACE.gold), series('btc', btc.values, RACE.btc)];
    const labelYs = spread(lines.map(({ points }) => points.at(-1)[1]), LABEL_GAP);
    return { plot, lines: lines.map((line, i) => ({ ...line, labelAt: [plot.x1 + 12, labelYs[i]] })) };
  }

  function renderRace(plan, t) {
    plan.race.lines.forEach(({ points, start, length, reveal, tip, label, labelAt }) => {
      const drawn = ease(progress(t, start, length));
      const [x, y] = pointAt(points, drawn);
      revealTo(reveal, plan.race.plot, x);
      tip.setAttribute('cx', x);
      tip.setAttribute('cy', y);
      tip.style.opacity = t >= start ? 1 : 0;
      riseAt(label, labelAt, ease(progress(t, start + length + 2, CARD_POP)));
    });
  }

  function planWhy() {
    return WHY_AT.map((at, i) => ({ node: $('s3', `why-${i + 1}`), at }));
  }
  function renderWhy(plan, t) {
    plan.why.forEach(({ node, at }) => riseIn(node, ease(progress(t, at, CARD_POP))));
  }

  function planRecordGrid(plot, candles) {
    const grid = $('s3', 'record-grid');
    RECORD.grid.forEach((v) => gridLine(grid, plot, v, `$${dollars(v)}`));
    const firstOf2026 = candles.findIndex(({ day }) => day.startsWith('2026-'));
    const sepX = plot.x(firstOf2026);
    grid.append(svgEl('line', { class: 'gm-base', x1: sepX, y1: plot.top, x2: sepX, y2: plot.bottom, opacity: 0.5 }));
    grid.append(textEl('2025', { class: 'gm-muted', x: plot.x0 + 4, y: AXIS_LABEL_Y }));
    grid.append(textEl('2026', { class: 'gm-muted', x: sepX + 4, y: AXIS_LABEL_Y }));
  }

  function planDrop(peakPoint, lastPoint, ratio, lastCandle) {
    const [peakX, peakY] = peakPoint;
    const [, lastY] = lastPoint;
    const midY = (peakY + lastY) / 2;
    $('s3', 'record-drop-guide').setAttribute('d', `M${fixed(peakX + 8)} ${fixed(peakY)} H${BRACKET_X - 8}`);
    $('s3', 'record-drop-bracket').setAttribute('d', `M${BRACKET_X - 6} ${fixed(peakY)} H${BRACKET_X} V${fixed(lastY)} H${BRACKET_X - 6}`);
    const place = (id, text, dy) => {
      const node = $('s3', id);
      if (text !== null) node.textContent = text;
      node.setAttribute('x', BRACKET_X + 10);
      node.setAttribute('y', midY + dy);
    };
    place('record-drop-value', percent(ratio), 8);
    place('record-drop-what', null, 28);
    place('record-drop-last', `$${dollars(lastCandle.close)} · ${shortDay(dayOf(lastCandle.day)).toUpperCase()}`, 46);
  }

  // BTC's own drop, from its top close to the last candle, on the card beside the gold one.
  function planBtcDrop() {
    const candles = CHARTS.btc;
    const closes = candles.map(({ close }) => close);
    const top = closes.indexOf(Math.max(...closes));
    const { day } = candles[top];
    $('s3', 'record-btc-value').textContent = percent(closes.at(-1) / closes[top]);
    $('s3', 'record-btc-top').textContent = `TOP: ${shortDay(dayOf(day)).toUpperCase()}, ${day.slice(0, 4)}`;
    return $('s3', 'record-btc');
  }

  // A dated point on the record line: a dot and a two-line label beside it, placed by its candle.
  function planMark({ id, day, label: [dx, dy] }, candles, points) {
    const index = candles.findIndex((candle) => candle.day === day);
    if (index < 0) throw new Error(`gold: no candle on ${day} for the ${id} mark`);
    const [x, y] = points[index];
    const dot = $('s3', `record-mark-${id}-dot`);
    dot.setAttribute('cx', x);
    dot.setAttribute('cy', y);
    const [, start, length] = LEGS.find(([stop]) => stop === id);
    return { id, index, point: [x, y], labelAt: [x + dx, y + dy], at: start + length, dot, label: $('s3', `record-mark-${id}-label`) };
  }

  function planRecord() {
    const candles = CHARTS.gold;
    const closes = candles.map(({ close }) => close);
    if (Math.min(...closes) < RECORD.range[0] || Math.max(...closes) > RECORD.range[1]) throw new Error('gold: the record chart range no longer fits the candles');
    const plot = plotOf(RECORD, closes.length, RECORD.range);
    planRecordGrid(plot, candles);
    const points = closes.map((v, i) => [plot.x(i), plot.y(v)]);
    $('s3', 'record-line').setAttribute('d', pathOf(points));
    $('s3', 'record-area').setAttribute('d', `${pathOf(points)} L${fixed(plot.x1)} ${plot.bottom} L${fixed(plot.x0)} ${plot.bottom} Z`);
    const peak = closes.indexOf(Math.max(...closes));
    const [peakX, peakY] = points[peak];
    const dot = $('s3', 'record-peak-dot');
    dot.setAttribute('cx', peakX);
    dot.setAttribute('cy', peakY);
    [['record-peak-kick', -32], ['record-peak-what', -14]].forEach(([id, dy]) => {
      $('s3', id).setAttribute('x', peakX);
      $('s3', id).setAttribute('y', peakY + dy);
    });
    planDrop(points[peak], points.at(-1), closes.at(-1) / closes[peak], candles.at(-1));
    const marks = MARKS.map((mark) => planMark(mark, candles, points));
    const stops = { peak, last: closes.length - 1, ...Object.fromEntries(marks.map(({ id, index }) => [id, index])) };
    const fraction = (stop) => stops[stop] / (closes.length - 1);
    const legs = LEGS.map(([stop, start, length], i) => ({ from: i ? fraction(LEGS[i - 1][0]) : 0, to: fraction(stop), start, length }));
    return {
      plot,
      points,
      legs,
      marks,
      peakPoint: points[peak],
      reveal: $('s3', 'record-reveal'),
      tip: $('s3', 'record-tip'),
      dot,
      peakLabel: $('s3', 'record-peak-label'),
      drop: $('s3', 'record-drop'),
      btc: planBtcDrop(),
    };
  }

  function renderRecord(plan, t) {
    const record = plan.record;
    const drawn = record.legs.reduce((at, { from, to, start, length }) => (t < start ? at : lerp(from, to, ease(progress(t, start, length)))), 0);
    const [x, y] = pointAt(record.points, drawn);
    revealTo(record.reveal, record.plot, x);
    record.tip.setAttribute('cx', x);
    record.tip.setAttribute('cy', y);
    record.tip.style.opacity = t >= 0 ? 1 : 0;
    record.marks.forEach(({ dot, point, label, labelAt, at }) => {
      popIn(dot, point, ease(progress(t, at, CARD_POP)));
      riseAt(label, labelAt, ease(progress(t, at + MARK_LABEL_DELAY, CARD_POP)));
    });
    popIn(record.dot, record.peakPoint, ease(progress(t, PEAK_AT, CARD_POP)));
    riseIn(record.peakLabel, ease(progress(t, PEAK_LABEL_AT, CARD_POP)));
    riseIn(record.drop, ease(progress(t, DROP_LABEL_AT, CARD_POP)));
    riseIn(record.btc, ease(progress(t, BTC_AT, CARD_POP)));
  }

  const RENDER_BEAT = { race: renderRace, why: renderWhy, record: renderRecord };

  function planBeats() {
    return STORY.beats.map(({ id, start }, i, all) => {
      if (!RENDER_BEAT[id]) throw new Error(`gold: no beat called ${id}`);
      if (i && start <= all[i - 1].start) throw new Error(`gold: beat ${id} starts before the one ahead of it`);
      return { id, node: $('s3', `beat-${id}`), start, end: all[i + 1]?.start };
    });
  }
  // The first beat is already up when the screen comes on; the last one holds.
  function beatShown({ start, end }, t, isFirst) {
    const shown = isFirst ? 1 : progress(t, start, BEAT_FADE);
    const gone = end === undefined ? 0 : progress(t, end - BEAT_FADE, BEAT_FADE);
    return Math.min(shown, 1 - gone);
  }

  function planGoldMonitor() {
    return { beats: planBeats(), race: planRace(), why: planWhy(), record: planRecord() };
  }

  // k counts from the monitor's start; it runs negative while the camera is still on the board.
  function renderGoldMonitor(plan, k, view = FULL_VIEW) {
    setViewBox('s3', view);
    const t = Math.max(0, k);
    plan.beats.forEach((beat, i) => {
      riseIn(beat.node, ease(beatShown(beat, t, i === 0)));
      RENDER_BEAT[beat.id](plan, t - beat.start);
    });
  }

  window.STORY = { ...window.STORY, monitorFrames: STORY.monitorFrames, planMonitor: planGoldMonitor, renderMonitor: renderGoldMonitor };
})();
