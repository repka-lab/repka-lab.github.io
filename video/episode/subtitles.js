/*
 * A story's subtitles, the "subs" layer build_episode.py lays in the band under the screen. Once the
 * fonts are in, each cue's pill is sized to its line; then each cue fades in and out over its frames.
 * Loads after episode.js and uses its helpers; an IIFE, because classic scripts share one global scope.
 */
(() => {
  'use strict';

  const STORY = JSON.parse(document.getElementById('story').textContent);

  const PILL_PAD = 12; // px either side of the line
  const CENTRE = 320;
  const FADE = 3; // frames in and out

  function planSubs() {
    return STORY.subs.map(({ from, to }, i) => {
      const width = $('s6', `sub-${i}-text`).getComputedTextLength() + 2 * PILL_PAD;
      $('s6', `sub-${i}-pill`).setAttribute('x', CENTRE - width / 2);
      $('s6', `sub-${i}-pill`).setAttribute('width', width);
      return { node: $('s6', `sub-${i}`), from, to };
    });
  }

  function renderSubs(cues, f) {
    cues.forEach(({ node, from, to }) => {
      node.style.opacity = Math.min(progress(f + 1, from, FADE), 1 - progress(f + 1, to - FADE, FADE));
    });
  }

  window.STORY = { ...window.STORY, planSubs, renderSubs };
})();
