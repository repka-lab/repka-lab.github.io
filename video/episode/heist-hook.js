/*
 * The Binance hack cold open (assets/scenes/hook-heist.svg), in place of the standard hook.
 * The full sum and its caption are there from the first frame, under a short glitch burst, and settle
 * into the calm frame; coins stream right, the drained links flow, the camera pushes in a little. The
 * story sets how long it runs. Loads after episode.js and uses its helpers; an IIFE, because classic
 * scripts share one global scope.
 */
(() => {
  'use strict';

  const STORY = JSON.parse(document.getElementById('story').textContent);

  const WHO = { mark: 28, gap: 12, pillPad: 11, wordSpacing: 5, pillSpacing: 3, rowMid: 107.5, centre: 320 };
  // Each burst fades out from its full strength over `length` frames.
  const BURSTS = [
    { start: 0, length: 7, strength: 1 },
    { start: 18, length: 8, strength: 1 },
  ];
  const GHOST_SPLIT = 7; // px the colour ghosts part at full strength...
  const GHOST_JITTER = 4; // ...plus this much shake
  const GHOSTS = { cyan: { side: -1, opacity: [0.45, 0.8] }, red: { side: 1, opacity: [0.55, 0.85] } };
  const SHAKE = 3;
  const TEAR_BAND = [140, 90]; // the tears land anywhere in y 140-230, over the digits
  const TEAR_SHIFT = 30;
  const SCAN_BAND = [150, 100];
  const PUSH_IN = 0.05; // the camera closes in this much over the hook
  const CENTRE = [320, 180];
  const COIN_MARGIN = 90; // a coin and its trail leave the frame completely before it wraps round
  const COIN_SPEED = { near: 2.4, far: 1.2 };
  const LINK_FLOW = 0.6;

  const loop = (v, span) => ((v % span) + span) % span;
  const noise = (f, i) => {
    const v = Math.sin(f * 12.9898 + i * 78.233) * 43758.5453;
    return v - Math.floor(v);
  };
  const sumText = (billions) => `−$${billions.toFixed(1)}B`;

  // The mark, BINANCE and the HACKED pill, centred as one row; letter-spacing trails the last letter.
  function layoutWho() {
    const word = $('s0', 'who-word');
    const pillText = $('s0', 'who-pill-text');
    const wordWidth = word.getComputedTextLength() - WHO.wordSpacing;
    const pillWidth = pillText.getComputedTextLength() - WHO.pillSpacing + 2 * WHO.pillPad;
    const x0 = WHO.centre - (WHO.mark + WHO.gap + wordWidth + WHO.gap + pillWidth) / 2;
    const wordX = x0 + WHO.mark + WHO.gap;
    const pillX = wordX + wordWidth + WHO.gap;
    $('s0', 'who-mark').setAttribute('transform', `translate(${x0} ${WHO.rowMid - WHO.mark / 2}) scale(${WHO.mark / 24})`);
    word.setAttribute('x', wordX);
    $('s0', 'who-pill').setAttribute('x', pillX);
    $('s0', 'who-pill').setAttribute('width', pillWidth);
    pillText.setAttribute('x', pillX + pillWidth / 2 + WHO.pillSpacing / 2);
  }

  function planHeistHook() {
    layoutWho();
    const coins = [...$('s0', 'coins').querySelectorAll('.hh-coin')].map((node) => ({
      node,
      cx: Number(node.querySelector('circle').getAttribute('cx')),
      speed: node.classList.contains('hh-far') ? COIN_SPEED.far : COIN_SPEED.near,
    }));
    const tear = (id) => ({ rect: $('s0', `${id}-rect`), text: $('s0', `${id}-text`), x: Number($('s0', `${id}-text`).getAttribute('x')) });
    // The sum and its ghosts and tears are written once from the story, so the svg and the data can't disagree.
    $('s0', 'big').querySelectorAll('text').forEach((node) => (node.textContent = sumText(STORY.stolenB)));
    return {
      big: $('s0', 'big'),
      ghosts: Object.entries(GHOSTS).map(([name, ghost]) => ({ ...ghost, node: $('s0', `ghost-${name}`) })),
      glitch: $('s0', 'glitch'),
      tears: [tear('tear-a'), tear('tear-b')],
      scans: ['scan-a', 'scan-b'].map((id) => $('s0', id)),
      coins,
      drained: [...$('s0', 'net').querySelectorAll('.hh-drained')],
    };
  }

  const glitchAt = (h) =>
    Math.max(0, ...BURSTS.map(({ start, length, strength }) => {
      const t = (h - start) / length;
      return t >= 0 && t < 1 ? strength * (1 - t * t) : 0;
    }));

  // g is the burst strength, 0 at rest: then every part is back where the svg puts it.
  function renderGlitch(plan, h, g) {
    const shake = (i, px) => (noise(h, i) - 0.5) * 2 * px * g;
    plan.big.setAttribute('transform', `translate(${shake(1, SHAKE)} ${shake(2, SHAKE)})`);
    plan.ghosts.forEach(({ node, side, opacity }, i) => {
      node.setAttribute('transform', `translate(${side * GHOST_SPLIT * g + shake(3 + i, GHOST_JITTER)} ${shake(5 + i, 1)})`);
      node.style.opacity = lerp(opacity[0], opacity[1], g);
    });
    plan.glitch.setAttribute('display', g > 0 ? 'inline' : 'none');
    plan.tears.forEach(({ rect, text, x }, i) => {
      rect.setAttribute('y', TEAR_BAND[0] + noise(h, 7 + i) * TEAR_BAND[1]);
      text.setAttribute('x', x + shake(9 + i, TEAR_SHIFT));
    });
    plan.scans.forEach((node, i) => node.setAttribute('y', SCAN_BAND[0] + noise(h, 11 + i) * SCAN_BAND[1]));
  }

  function renderHeistHook(plan, h) {
    renderGlitch(plan, h, glitchAt(h));
    const zoom = 1 + PUSH_IN * (h / STORY.hookFrames);
    setViewBox('s0', [CENTRE[0] - CENTRE[0] / zoom, CENTRE[1] - CENTRE[1] / zoom, 640 / zoom, 360 / zoom]);
    const span = 640 + 2 * COIN_MARGIN;
    plan.coins.forEach(({ node, cx, speed }) => {
      const x = loop(cx + COIN_MARGIN + speed * h, span) - COIN_MARGIN;
      node.setAttribute('transform', `translate(${x - cx} 0)`);
    });
    plan.drained.forEach((node) => node.setAttribute('stroke-dashoffset', -h * LINK_FLOW));
  }

  window.STORY = {
    ...window.STORY,
    hookFrames: STORY.hookFrames,
    planHook: planHeistHook,
    renderHook: renderHeistHook,
    renderHookScreen: null,
    renderEnd: renderPlainEnd,
  };
})();
