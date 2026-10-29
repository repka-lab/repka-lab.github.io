// Checks foot planting in the walk loop: world x of each foot's ankle and its height above the floor, per frame.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync(new URL('./rig.js', import.meta.url), 'utf8').replace(
  'window.Rig = {',
  'window.Rig = { through, soles,',
);
const ctx = { window: {}, Math };
vm.runInNewContext(src, ctx);
const { RIGS, walk, walkOffset, lowestSole, through, soles } = ctx.window.Rig;
const rig = RIGS.v2;

const CYCLE = 36;
const SCALE = 1.8;
const GROUND = 641;
const START = -260;
const rows = [];
for (let f = 0; f < CYCLE + 1; f++) {
  const phase = -Math.PI / 2 + (f * 2 * Math.PI) / CYCLE;
  const parts = walk(rig, phase, 1);
  const x = START + SCALE * (walkOffset(rig, phase) - walkOffset(rig, -Math.PI / 2));
  const y = GROUND - SCALE * lowestSole(rig, parts, 'right');
  const row = { f };
  for (const side of ['left', 'right']) {
    const chain = [`leg-${side}`, `leg-${side}-shin`, `leg-${side}-foot`];
    const pts = soles(rig, side, 'right').map((p) => through(rig, parts, p, chain));
    const heel = [x + SCALE * pts[0][0], y + SCALE * pts[0][1]];
    const toe = [x + SCALE * pts[1][0], y + SCALE * pts[1][1]];
    row[`${side[0]}HeelX`] = heel[0].toFixed(1);
    row[`${side[0]}Lift`] = (GROUND - Math.max(heel[1], toe[1])).toFixed(1);
  }
  rows.push(row);
}
console.table(rows);
