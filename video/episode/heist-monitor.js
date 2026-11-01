/*
 * The Binance hack on the monitor (assets/scenes/monitor-heist.svg), in place of the standard monitor.
 * Five beats cross-fade on the screen, each on its own clock from heist.json: how it started, the drain,
 * who analysts link it to and what was taken, the laundering, and the market after, with each chart's
 * 4h candles around the hack read from its candles-<id> tag. The header clock runs through the drain
 * and fades once it is over. Loads after episode.js and uses its helpers; an IIFE, because classic
 * scripts share one global scope.
 */
(() => {
  'use strict';

  const STORY = JSON.parse(document.getElementById('story').textContent);
  const CHARTS = (STORY.charts ?? []).map((chart) => {
    const data = document.getElementById(`candles-${chart.id}`);
    if (!data) throw new Error(`heist: no candles for the ${chart.id} chart`);
    return { ...chart, candles: JSON.parse(data.textContent) };
  });

  const BEAT_FADE = 6;
  const GOLD = '#f0b90b';
  const RED = '#ff4655';
  const BTC_ORANGE = '#f7931a';
  const SAFE_EDGE = [[240, 185, 11], [255, 70, 85]]; // gold while full, red once drained
  // The drain, 20:05-20:23 UTC Oct 29 (TRM Labs): the clock runs through it while the coins fly.
  const CLOCK = { hour: 20, from: 5, to: 23, start: 10, length: 110, blink: 8, dim: 0.25 };
  const SAFE = { count: 10, perRow: 5, x: 50, rows: [98, 136], step: 38, size: 30, coins: [9, 15, 21], coinY: 22 };
  const DRAIN = { start: 14, stagger: 3, flight: 22, redden: 82, rise: 60, wallet: [505, 125], wallBottom: 160 };
  // The gold line reaches each step as its card rises; each card's icon acts `detail` frames later.
  const PREP = { cards: 4, start: 18, stagger: 14, detail: 8, sign: 16, callout: 78, track: [116, 524] };
  const ALERT = { period: 24, r: 7, grow: 6, opacity: 0.4 };
  const DROP = { coins: 3, gap: 8, period: 24, from: 134, to: 160, x: 388, r: 3.5, fadeIn: 0.2 };
  const TICK_GAP = 6;
  const FLAG = { at: 4, from: 0.6 };
  const WHO_REVEALS = [['who-name', 12], ['who-group', 18], ['who-trm', 26], ['who-chain', 30], ['who-binance', 34], ['who-bybit', 44], ['who-note', 70]];
  const BARS = { x: 368, top: 96, step: 26, height: 16, width: 150, min: 2, start: 16, stagger: 8, grow: 30, labelGap: 8, valueGap: 6 };
  const LAUNDER = { rows: ['launder-swap', 'launder-peel', 'launder-fan'], start: 8, stagger: 20 };
  const LAUNDER_REVEALS = [['launder-frozen', 70], ['launder-held', 78]];
  const SWAP = { trip: 36, coins: 3, r: 3.5, colours: [[38, 161, 123], [98, 126, 234]], turn: [0.4, 0.2] }; // USDT green into ETH blue
  const PEEL = { xs: [98, 126, 150, 172, 192, 210, 226], r: [8, 7, 6, 5, 4.5, 4, 3.5], y: 170, off: [6, 12], crumb: 2, delay: 6, step: 5 };
  const FAN = { from: [64, 224], cols: 4, rows: 4, x: 130, colStep: 30, shift: 12, y: 206, rowStep: 12, dot: 2.5, hop: 5, gap: 2, delay: 6 };
  const CHART = { width: 230, top: 146, bottom: 240, candles: 8, sweep: 30, rise: 6, mark: 44 };
  const LOW_MARK = { r: 2.5, gap: 5, drop: 3 };
  const AFTER = { charts: 6, stagger: 10, status: 70 };

  const loop = (v, span) => ((v % span) + span) % span;
  const pad = (n) => String(n).padStart(2, '0');
  const rgb = (c) => `rgb(${c.map(Math.round).join(',')})`;
  const billions = (b) => `$${b.toFixed(1)}B`;
  const dollars = (m) => (m >= 1000 ? `$${(m / 1000).toFixed(2)}B` : `$${Math.round(m)}M`);
  const priceText = (p) => (p >= 10_000 ? `$${(p / 1000).toFixed(1)}k` : `$${Math.round(p)}`);
  const quad = (a, c, b, p) => a.map((v, i) => (1 - p) ** 2 * v + 2 * (1 - p) * p * c[i] + p ** 2 * b[i]);
  const reveals = (list) => list.map(([id, at]) => ({ node: $('s3', id), at }));

  // Fades the node in while it grows from `from` to full size about [x, y].
  function popIn(node, [x, y], t, from = 0) {
    node.style.opacity = t;
    node.setAttribute('transform', `translate(${x} ${y}) scale(${lerp(from, 1, t)}) translate(${-x} ${-y})`);
  }

  function centreOf(node) {
    const { x, y, width, height } = node.getBBox();
    return [x + width / 2, y + height / 2];
  }

  // ---------------------------------------------------------------- prep

  function planPrep() {
    const sign = $('s3', 'prep-sign');
    const length = sign.getTotalLength();
    sign.setAttribute('stroke-dasharray', length);
    const coins = Array.from({ length: DROP.coins }, () => svgEl('circle', { cx: DROP.x, cy: DROP.from, r: DROP.r, fill: GOLD, opacity: 0 }));
    $('s3', 'prep-coins').append(...coins);
    const [alert, callout] = [$('s3', 'prep-alert'), $('s3', 'prep-callout')];
    return {
      line: $('s3', 'prep-line'),
      cards: Array.from({ length: PREP.cards }, (_, i) => ({ node: $('s3', `prep-${i + 1}`), start: PREP.start + i * PREP.stagger })),
      alert: { node: alert, at: centreOf(alert) },
      halo: $('s3', 'prep-halo'),
      sign: { node: sign, length },
      coins,
      ticks: [...$('s3', 'prep-ticks').children].map((node) => ({ node, at: centreOf(node) })),
      callout: { node: callout, at: centreOf(callout) },
    };
  }

  function renderAlert({ alert, halo }, d) {
    popIn(alert.node, alert.at, ease(progress(d, 0, POP)));
    const u = loop(d, ALERT.period) / ALERT.period;
    halo.setAttribute('r', ALERT.r + ALERT.grow * u);
    halo.style.opacity = d < 0 ? 0 : ALERT.opacity * (1 - u);
  }

  // Coins keep dropping out of the mixer; the wallet is drawn over them, so they vanish into it.
  function renderDrop(coins, d) {
    coins.forEach((node, j) => {
      const since = d - j * DROP.gap;
      const u = loop(since, DROP.period) / DROP.period;
      node.setAttribute('cy', lerp(DROP.from, DROP.to, u * u));
      node.style.opacity = since < 0 ? 0 : Math.min(1, u / DROP.fadeIn);
    });
  }

  function renderPrep({ prep }, p) {
    prep.line.setAttribute('x2', lerp(...PREP.track, progress(p, PREP.start, (PREP.cards - 1) * PREP.stagger)));
    prep.cards.forEach(({ node, start }) => riseIn(node, ease(progress(p, start, FADE))));
    const detail = (i) => p - prep.cards[i].start - PREP.detail;
    renderAlert(prep, detail(0));
    prep.sign.node.setAttribute('stroke-dashoffset', prep.sign.length * (1 - ease(progress(detail(1), 0, PREP.sign))));
    renderDrop(prep.coins, detail(2));
    prep.ticks.forEach(({ node, at }, j) => popIn(node, at, ease(progress(detail(3), j * TICK_GAP, POP))));
    popIn(prep.callout.node, prep.callout.at, ease(progress(p, PREP.callout, POP)), 1 + BEAT_POP);
  }

  // ---------------------------------------------------------------- drain

  function drawSafes(root) {
    return Array.from({ length: SAFE.count }, (_, i) => {
      const x = SAFE.x + (i % SAFE.perRow) * SAFE.step;
      const y = SAFE.rows[Math.floor(i / SAFE.perRow)];
      const box = svgEl('rect', { x, y, width: SAFE.size, height: SAFE.size, rx: 3, fill: '#0f1d33', 'stroke-width': 1.5 });
      const dial = svgEl('circle', { cx: x + SAFE.size / 2, cy: y + 11, r: 5, fill: 'none', stroke: '#4a6890', 'stroke-width': 1.2 });
      const coins = SAFE.coins.map((dx) => ({ node: svgEl('circle', { cx: x + dx, cy: y + SAFE.coinY, r: 3, fill: GOLD }), at: [x + dx, y + SAFE.coinY] }));
      root.append(box, dial, ...coins.map(({ node }) => node));
      return { box, coins, start: DRAIN.start + i * DRAIN.stagger };
    });
  }

  // Coin j leaves safe j % 10, its coins in turn, and arcs into the attacker's wallet.
  function drawFlying(safes, root) {
    return Array.from({ length: SAFE.count * SAFE.coins.length }, (_, j) => {
      const { node: inSafe, at } = safes[j % SAFE.count].coins[Math.floor(j / SAFE.count)];
      const [to, top] = [DRAIN.wallet, Math.min(at[1], DRAIN.wallet[1]) - DRAIN.rise];
      const node = svgEl('circle', { r: j % 2 ? 4 : 4.5, fill: GOLD, stroke: '#8a6a08', 'stroke-width': 1, opacity: 0 });
      root.append(node);
      return { node, inSafe, from: at, control: [(at[0] + to[0]) / 2, top], start: DRAIN.start + j * DRAIN.stagger };
    });
  }

  // Returns how far the coin has flown, 0-1.
  function flyCoin({ node, inSafe, from, control, start }, t) {
    const p = ease(progress(t, start, DRAIN.flight));
    const [x, y] = quad(from, control, DRAIN.wallet, p);
    inSafe.style.opacity = p > 0 ? 0 : 1;
    node.style.opacity = p > 0 && p < 1 ? 1 : 0;
    node.setAttribute('cx', x);
    node.setAttribute('cy', y);
    return p;
  }

  function renderDrain(plan, t) {
    plan.safes.forEach(({ box, start }) => box.setAttribute('stroke', rgb(mix(...SAFE_EDGE, progress(t, start, DRAIN.redden)))));
    const flown = plan.flying.map((coin) => flyCoin(coin, t));
    const share = flown.reduce((sum, p) => sum + p, 0) / flown.length;
    const height = SAFE.size * 2 * share;
    plan.walletFill.setAttribute('y', DRAIN.wallBottom - height);
    plan.walletFill.setAttribute('height', height);
    plan.counter.textContent = billions(STORY.stolenB * share);
  }

  // The clock keeps the drain's own time: hidden before it, and gone once it is over.
  function renderClock(plan, t) {
    const d = t - plan.drain.start;
    const minute = CLOCK.from + Math.round((CLOCK.to - CLOCK.from) * progress(d, CLOCK.start, CLOCK.length));
    plan.clockTime.textContent = `${CLOCK.hour}:${pad(minute)} UTC`;
    plan.clockDot.style.opacity = Math.floor(Math.max(0, d) / CLOCK.blink) % 2 ? CLOCK.dim : 1;
    const done = progress(t, plan.drain.end ?? Infinity, FADE);
    plan.clock.style.opacity = Math.min(progress(d, 0, FADE), 1 - done);
  }

  // ---------------------------------------------------------------- who

  function checkChains() {
    if (!STORY.chains?.length) throw new Error('heist: no chains to show what was taken');
    STORY.chains.forEach(({ label, usdM }) => {
      if (!(Number.isFinite(usdM) && usdM > 0)) throw new Error(`heist: chain ${label} has a bad sum`);
    });
  }

  function drawChains(root) {
    const most = Math.max(...STORY.chains.map(({ usdM }) => usdM));
    return STORY.chains.map(({ label, usdM }, i) => {
      const y = BARS.top + i * BARS.step;
      const bar = svgEl('rect', { x: BARS.x, y, width: 0, height: BARS.height, rx: 2, fill: GOLD });
      const value = textEl('', { class: 'hm-value', y: y + 12 });
      root.append(textEl(label, { class: 'hm-what', x: BARS.x - BARS.labelGap, y: y + 12, 'text-anchor': 'end' }), bar, value);
      return { bar, value, usdM, width: Math.max(BARS.min, (BARS.width * usdM) / most), start: BARS.start + i * BARS.stagger };
    });
  }

  function planWho() {
    const flag = $('s3', 'who-flag');
    return { flag: { node: flag, at: centreOf(flag) }, reveals: reveals(WHO_REVEALS), bars: drawChains($('s3', 'chains')) };
  }

  function renderWho({ who }, w) {
    popIn(who.flag.node, who.flag.at, ease(progress(w, FLAG.at, POP)), FLAG.from);
    who.reveals.forEach(({ node, at }) => riseIn(node, ease(progress(w, at, FADE))));
    who.bars.forEach(({ bar, value, usdM, width, start }) => {
      const grown = ease(progress(w, start, BARS.grow));
      bar.setAttribute('width', width * grown);
      value.setAttribute('x', BARS.x + width * grown + BARS.valueGap);
      value.textContent = dollars(usdM * grown);
      value.style.opacity = grown;
    });
  }

  // ---------------------------------------------------------------- launder

  function drawSwap(root) {
    const path = $('s3', 'swap-route');
    const coins = Array.from({ length: SWAP.coins }, () => svgEl('circle', { r: SWAP.r }));
    root.append(...coins);
    return { path, length: path.getTotalLength(), coins };
  }

  // Each hop peels a small piece off to a side address and passes the rest on, smaller every time.
  function drawPeel(root) {
    return PEEL.xs.map((x, i) => {
      const [cx, cy] = [x + PEEL.off[0], PEEL.y + (i % 2 ? 1 : -1) * PEEL.off[1]];
      const node = svgEl('g');
      node.append(
        svgEl('line', { x1: x, y1: PEEL.y, x2: cx, y2: cy, stroke: '#4a6890', 'stroke-width': 1 }),
        svgEl('circle', { cx, cy, r: PEEL.crumb, fill: BTC_ORANGE }),
        svgEl('circle', { cx: x, cy: PEEL.y, r: PEEL.r[i], fill: BTC_ORANGE }),
      );
      root.append(node);
      return { node, at: [x, PEEL.y], start: PEEL.delay + i * PEEL.step };
    });
  }

  // The fresh addresses light up out of order (i * hop mod n), the way scripted transfers land.
  function drawFan(root) {
    const count = FAN.cols * FAN.rows;
    const dots = Array.from({ length: count }, (_, i) => {
      const [col, row] = [i % FAN.cols, Math.floor(i / FAN.cols)];
      const at = [FAN.x + col * FAN.colStep + (row % 2) * FAN.shift, FAN.y + row * FAN.rowStep];
      return { at, start: FAN.delay + ((i * FAN.hop) % count) * FAN.gap };
    });
    const links = dots.map(({ at: [x, y] }) => svgEl('line', { x1: FAN.from[0], y1: FAN.from[1], x2: x, y2: y, stroke: '#2b4365', 'stroke-width': 1 }));
    const nodes = dots.map(({ at: [x, y] }) => svgEl('circle', { cx: x, cy: y, r: FAN.dot, fill: RED }));
    root.append(...links, ...nodes);
    return dots.map((dot, i) => ({ ...dot, link: links[i], node: nodes[i] }));
  }

  function planLaunder() {
    return {
      rows: LAUNDER.rows.map((id) => $('s3', id)),
      swap: drawSwap($('s3', 'swap-coins')),
      peel: drawPeel($('s3', 'peel-nodes')),
      fan: drawFan($('s3', 'fan-links')),
      reveals: reveals(LAUNDER_REVEALS),
    };
  }

  function renderSwap({ path, length, coins }, s) {
    coins.forEach((node, j) => {
      const u = loop(s + (j * SWAP.trip) / coins.length, SWAP.trip) / SWAP.trip;
      const [x, y] = pointAt(path, length * u);
      node.setAttribute('cx', x);
      node.setAttribute('cy', y);
      node.setAttribute('fill', rgb(mix(...SWAP.colours, progress(u, ...SWAP.turn))));
      node.style.opacity = Math.sin(Math.PI * u);
    });
  }

  function renderLaunder({ launder }, l) {
    const rowStart = (i) => LAUNDER.start + i * LAUNDER.stagger;
    launder.rows.forEach((node, i) => riseIn(node, ease(progress(l, rowStart(i), FADE))));
    renderSwap(launder.swap, l - rowStart(0));
    launder.peel.forEach(({ node, at, start }) => popIn(node, at, ease(progress(l - rowStart(1), start, POP))));
    launder.fan.forEach(({ link, node, at, start }) => {
      const shown = ease(progress(l - rowStart(2), start, POP));
      link.style.opacity = shown;
      popIn(node, at, shown);
    });
    launder.reveals.forEach(({ node, at }) => riseIn(node, ease(progress(l, at, FADE))));
  }

  // ---------------------------------------------------------------- after

  function checkCandles({ id, candles }) {
    const isPrice = (v) => Number.isFinite(v) && v > 0;
    if (candles.length < 2) throw new Error(`heist: the ${id} chart needs at least two candles`);
    candles.forEach(({ open, high, low, close }, i) => {
      if (![open, high, low, close].every(isPrice)) throw new Error(`heist: ${id} candle ${i} has a bad price`);
      if (high < Math.max(open, close) || low > Math.min(open, close)) throw new Error(`heist: ${id} candle ${i} is not OHLC`);
    });
  }

  function drawCandles(candles, x0, root) {
    const lo = Math.min(...candles.map((c) => c.low));
    const hi = Math.max(...candles.map((c) => c.high));
    const yOf = (price) => lerp(CHART.bottom, CHART.top, (price - lo) / (hi - lo));
    const slot = CHART.width / candles.length;
    const xOf = (i) => x0 + slot * (i + 0.5);
    const body = slot * BODY;
    const nodes = candles.map(({ open, high, low, close }, i) => {
      const [x, top, base] = [xOf(i), yOf(Math.max(open, close)), yOf(Math.min(open, close))];
      const candle = svgEl('g', { class: toneOf(close >= open) });
      candle.append(
        svgEl('line', { class: 'candle-wick', x1: x, x2: x, y1: yOf(high), y2: yOf(low) }),
        svgEl('rect', { class: 'candle-body', x: x - body / 2, y: top, width: body, height: Math.max(1, base - top) }),
      );
      root.append(candle);
      return candle;
    });
    return { nodes, xOf, yOf };
  }

  // A dot on the lowest wick since the hack, labelled, inside the hack mark so it shows with it.
  function markLow(mark, x, y) {
    const text = svgEl('text', { class: 'hm-muted hm-red', x: x + LOW_MARK.gap, y: y + LOW_MARK.drop, style: 'font-size: 9px; font-weight: 700' });
    text.textContent = 'LOW';
    mark.append(svgEl('circle', { class: 'hm-red', cx: x, cy: y, r: LOW_MARK.r }), text);
  }

  // Marks the hack candle and the lowest low since it, and writes that low and the drop to it from the hack
  // candle's open, all from the candles: the worst point of the move, not where it happens to close.
  function markHack({ id, label, candles }, { xOf, yOf }) {
    const index = candles.findIndex(({ time }) => time === STORY.hackCandle);
    if (index < 0) throw new Error(`heist: no ${STORY.hackCandle} among the last ${candles.length} ${id} candles`);
    ['x1', 'x2'].forEach((name) => $('s3', `${id}-hack-line`).setAttribute(name, xOf(index)));
    $('s3', `${id}-hack-label`).setAttribute('x', xOf(index));
    const hack = candles[index];
    const low = Math.min(...candles.slice(index).map((c) => c.low));
    const lowIndex = candles.findIndex((c, i) => i >= index && c.low === low);
    const change = low / hack.open - 1;
    const at = new Date(hack.time);
    const changeText = $('s3', `${id}-change`);
    $('s3', `${id}-price`).textContent = `${label} low ${priceText(low)}`;
    changeText.textContent = `${signed(change, `${Math.abs(change * 100).toFixed(1)}%`)} since ${pad(at.getUTCHours())}:${pad(at.getUTCMinutes())} UTC ${shortDay(at)}`;
    changeText.classList.toggle('hm-red', change < 0);
    const mark = $('s3', `${id}-hack-mark`);
    markLow(mark, xOf(lowIndex), yOf(low));
    return mark;
  }

  // The chart sits where its price label does; the dashed placeholder goes once there are candles.
  function drawChart(chart) {
    checkCandles(chart);
    $('s3', `${chart.id}-pending`).remove();
    const x0 = Number($('s3', `${chart.id}-price`).getAttribute('x'));
    const { nodes, ...scale } = drawCandles(chart.candles, x0, $('s3', `${chart.id}-candles`));
    const hackMark = markHack(chart, scale);
    $('s3', `${chart.id}-caption`).textContent = chart.caption;
    return { candles: nodes, hackMark };
  }

  // Every chart slot on the screen shows, in order; one with no candles in the story keeps its placeholder.
  function planCharts() {
    const missing = CHARTS.find(({ id }) => !$('s3', `chart-${id}`));
    if (missing) throw new Error(`heist: the monitor has no chart-${missing.id}`);
    return [...$('s3', 'beat-after').querySelectorAll('.hm-chart')].map((node, i) => {
      const chart = CHARTS.find(({ id }) => $('s3', `chart-${id}`) === node);
      return { node, start: AFTER.charts + i * AFTER.stagger, ...(chart ? drawChart(chart) : { candles: [], hackMark: null }) };
    });
  }

  function renderAfter({ after }, a) {
    after.charts.forEach(({ node, start, candles, hackMark }) => {
      riseIn(node, ease(progress(a, start, FADE)));
      const step = CHART.sweep / Math.max(1, candles.length - 1);
      candles.forEach((candle, i) => riseIn(candle, ease(progress(a, start + CHART.candles + i * step, CHART.rise))));
      if (hackMark) hackMark.style.opacity = progress(a, start + CHART.mark, FADE);
    });
    riseIn(after.status, ease(progress(a, AFTER.status, FADE)));
  }

  // ---------------------------------------------------------------- beats

  const RENDER_BEAT = { prep: renderPrep, drain: renderDrain, who: renderWho, launder: renderLaunder, after: renderAfter };

  function planBeats() {
    return STORY.beats.map(({ id, start }, i, all) => {
      if (!RENDER_BEAT[id]) throw new Error(`heist: no beat called ${id}`);
      if (i && start <= all[i - 1].start) throw new Error(`heist: beat ${id} starts before the one ahead of it`);
      return { id, node: $('s3', `beat-${id}`), start, end: all[i + 1]?.start };
    });
  }

  // The first beat is already up when the screen comes on; the last one holds.
  function beatShown({ start, end }, t, isFirst) {
    const shown = isFirst ? 1 : progress(t, start, BEAT_FADE);
    const gone = end === undefined ? 0 : progress(t, end - BEAT_FADE, BEAT_FADE);
    return Math.min(shown, 1 - gone);
  }

  function planHeistMonitor() {
    checkChains();
    const beats = planBeats();
    const drain = beats.find(({ id }) => id === 'drain');
    if (!drain) throw new Error('heist: the clock needs a drain beat');
    const safes = drawSafes($('s3', 'safes'));
    return {
      beats,
      drain,
      clock: $('s3', 'clock'),
      clockTime: $('s3', 'clock-time'),
      clockDot: $('s3', 'clock-dot'),
      safes,
      flying: drawFlying(safes, $('s3', 'flying')),
      walletFill: $('s3', 'wallet-fill'),
      counter: $('s3', 'counter'),
      prep: planPrep(),
      who: planWho(),
      launder: planLaunder(),
      after: { charts: planCharts(), status: $('s3', 'after-status') },
    };
  }

  // k counts from the monitor's start; it runs negative while the camera is still at the desk.
  function renderHeistMonitor(plan, k, view = FULL_VIEW) {
    setViewBox('s3', view);
    const t = Math.max(0, k);
    plan.beats.forEach((beat, i) => {
      riseIn(beat.node, ease(beatShown(beat, t, i === 0)));
      RENDER_BEAT[beat.id](plan, t - beat.start);
    });
    renderClock(plan, t);
  }

  window.STORY = { ...window.STORY, monitorFrames: STORY.monitorFrames, planMonitor: planHeistMonitor, renderMonitor: renderHeistMonitor };
})();
