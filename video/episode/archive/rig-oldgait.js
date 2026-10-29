// Grandpa rig for the character pages: pivots, posing, gait and floor contact.
(function () {
  const BODY = {
    head: [80, 80],
    'arm-left': [64, 100],
    'arm-left-forearm': [58, 135],
    'arm-right': [96, 100],
    'arm-right-forearm': [102, 135],
    'leg-left': [72, 166],
    'leg-left-shin': [72, 208],
    'leg-right': [88, 166],
    'leg-right-shin': [88, 208],
  };
  // Soles per shoe: front faces the viewer, side is the profile shoe with the toe to the right.
  const RIGS = {
    v2: {
      pivots: { ...BODY, 'leg-left-foot': [72, 245], 'leg-right-foot': [88, 245] },
      soles: {
        front: { left: [[61.5, 252.5], [80, 252.5]], right: [[80, 252.5], [98.5, 252.5]] },
        side: { left: [[64, 252.5], [86, 252.5]], right: [[80, 252.5], [102, 252.5]] },
      },
    },
    v1: {
      pivots: { ...BODY, 'leg-left': [80, 170], 'leg-left-shin': [68, 210], 'leg-right': [80, 170], 'leg-right-shin': [92, 210] },
      soles: { front: { left: [[49.5, 252.5], [73, 252.5]], right: [[87, 252.5], [110.5, 252.5]] } },
    },
  };
  const HANDS = { left: [50.58, 165.61], right: [109.42, 165.61] };
  const CHALK_TIP = [47.6, 177.7];

  // Gait: the stance leg is straight and sweeps from +STEP_ANGLE to -STEP_ANGLE with its sole level.
  // The swing ankle eases from one footprint to the next, raised by STEP_HEIGHT at mid-swing;
  // two-bone IK turns that path into thigh and knee angles, so the foot lifts off and lands without sliding.
  // In the air the toe hangs by up to FOOT_HANG degrees. In profile the hips draw together by HIP_DRAW to one point.
  const STEP_ANGLE = 20;
  const STEP_HEIGHT = 8;
  const FOOT_HANG = 10;
  const HIP_DRAW = 8;
  const ARM_SWING = 10;
  const STANDING = { 'leg-left': 1.5, 'leg-right': -1.5, 'leg-left-foot': -1.5, 'leg-right-foot': 1.5 };
  const SEATED = { 'leg-left': -90, 'leg-left-shin': 90, 'leg-right': -90, 'leg-right-shin': 90 };
  const HIP_SIDE = { 'leg-left': 1, 'leg-right': -1 };

  const rad = (deg) => (deg * Math.PI) / 180;
  const deg = (r) => (r * 180) / Math.PI;
  const shift = (parts, id) => (HIP_SIDE[id] ?? 0) * (parts.hips ?? 0);

  function rotate([x, y], angle, [cx, cy]) {
    const c = Math.cos(rad(angle));
    const s = Math.sin(rad(angle));
    return [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c];
  }

  // Moves a point through a nested limb, chain listed outer to inner: the inner part turns first.
  function through(rig, parts, point, chain) {
    return chain
      .filter((id) => id in rig.pivots)
      .reduceRight((p, id) => {
        const [x, y] = rotate(p, parts[id] ?? 0, rig.pivots[id]);
        return [x + shift(parts, id), y];
      }, point);
  }

  // feet: 'front' for the shoes facing the viewer, 'right' or 'left' for profile shoes pointing that way.
  function soles(rig, side, feet) {
    if (feet === 'front') return rig.soles.front[side];
    const [ax] = rig.pivots[`leg-${side}-foot`];
    return rig.soles.side[side].map(([x, y]) => [feet === 'left' ? 2 * ax - x : x, y]);
  }

  function lowestSole(rig, parts, feet = 'front') {
    const ys = ['left', 'right'].flatMap((side) =>
      soles(rig, side, feet).map((p) => through(rig, parts, p, [`leg-${side}`, `leg-${side}-shin`, `leg-${side}-foot`])[1]),
    );
    return Math.max(...ys);
  }

  const ankle = (rig, parts, side) => through(rig, parts, rig.pivots[`leg-${side}-foot`], [`leg-${side}`, `leg-${side}-shin`]);
  const hand = (rig, parts, side) => through(rig, parts, HANDS[side], [`arm-${side}`, `arm-${side}-forearm`]);
  const chalkTip = (rig, parts) => through(rig, parts, CHALK_TIP, ['arm-left', 'arm-left-forearm']);

  // Thigh and shin lengths: hip to knee, knee to ankle.
  function bones(rig) {
    const y = (id) => rig.pivots[id][1];
    return [y('leg-left-shin') - y('leg-left'), y('leg-left-foot') - y('leg-left-shin')];
  }

  // Degrees, forward positive: thigh from vertical, knee bend, foot relative to the shin.
  // The leg swings while cos(phase) > 0 and stands for the other half of the cycle.
  function legAt(rig, phase) {
    const [a, b] = bones(rig);
    const p = (((phase + Math.PI / 2) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    if (p >= Math.PI) {
      const thigh = STEP_ANGLE * Math.cos(p - Math.PI);
      return { thigh, knee: 0, foot: thigh };
    }
    // Ankle target from the hip: the other leg is planted at the mirrored angle, the stride eases in and out.
    const s = p / Math.PI;
    const planted = rad(STEP_ANGLE * Math.cos(Math.PI * s));
    const reach = (a + b) * Math.sin(rad(STEP_ANGLE));
    const h = -2 * reach * Math.cos(Math.PI * s) + (a + b) * Math.sin(planted);
    const v = (a + b) * Math.cos(planted) - STEP_HEIGHT * Math.sin(Math.PI * s);
    const knee = Math.acos(Math.min(1, (h * h + v * v - a * a - b * b) / (2 * a * b)));
    const thigh = deg(Math.atan2(h, v) + Math.atan2(b * Math.sin(knee), a + b * Math.cos(knee)));
    const hang = FOOT_HANG * Math.sin(Math.PI * s);
    return { thigh, knee: deg(knee), foot: hang + thigh - deg(knee) };
  }

  // dir 1 walks right, -1 walks left. The right leg runs half a cycle behind the left one.
  function walk(rig, phase, dir) {
    const left = legAt(rig, phase);
    const right = legAt(rig, phase + Math.PI);
    return {
      hips: HIP_DRAW,
      'leg-left': -dir * left.thigh,
      'leg-left-shin': dir * left.knee,
      'leg-left-foot': dir * left.foot,
      'leg-right': -dir * right.thigh,
      'leg-right-shin': dir * right.knee,
      'leg-right-foot': dir * right.foot,
      'arm-left': dir * ARM_SWING * Math.sin(phase),
      'arm-right': -dir * ARM_SWING * Math.sin(phase),
    };
  }

  // How far the body has travelled, in figure units, with the stance foot planted on the floor.
  function walkOffset(rig, phase) {
    const [a, b] = bones(rig);
    const reach = (a + b) * Math.sin(rad(STEP_ANGLE));
    const since = phase - Math.PI / 2;
    const steps = Math.floor(since / Math.PI);
    const stance = Math.PI / 2 + (since - steps * Math.PI);
    return steps * 2 * reach + reach - (a + b) * Math.sin(rad(STEP_ANGLE * Math.sin(stance)));
  }

  function showFeet(el, rig, feet) {
    for (const side of ['left', 'right']) {
      const [ax] = rig.pivots[`leg-${side}-foot`];
      const profile = el(`leg-${side}-shoe-side`);
      el(`leg-${side}-shoe-front`).setAttribute('display', feet === 'front' ? 'inline' : 'none');
      profile.setAttribute('display', feet === 'front' ? 'none' : 'inline');
      if (feet === 'left') profile.setAttribute('transform', `matrix(-1 0 0 1 ${2 * ax} 0)`);
      else profile.removeAttribute('transform');
    }
  }

  function pose(prefix, rig, { place, parts = {}, eyes = [0, 0], chalk = false, feet = 'front' }) {
    const el = (id) => document.getElementById(`${prefix}-${id}`);
    for (const [id, [px, py]] of Object.entries(rig.pivots)) {
      const dx = shift(parts, id);
      el(id).setAttribute('transform', `${dx ? `translate(${dx} 0) ` : ''}rotate(${parts[id] ?? 0} ${px} ${py})`);
    }
    if ('leg-left-foot' in rig.pivots) showFeet(el, rig, feet);
    el('eyes').setAttribute('transform', `translate(${eyes[0]} ${eyes[1]})`);
    el('chalk').setAttribute('display', chalk ? 'inline' : 'none');
    el('place').setAttribute('transform', `translate(${place[0]} ${place[1]}) scale(${place[2] ?? 1})`);
  }

  window.Rig = { RIGS, STANDING, SEATED, walk, walkOffset, lowestSole, ankle, hand, chalkTip, pose };
})();
