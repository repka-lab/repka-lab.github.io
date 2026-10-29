// Grandpa rig for the character pages: pivots, posing, gait and floor contact.
(function () {
  const LEGS = {
    'leg-left': [72, 152],
    'leg-left-shin': [72, 184],
    'leg-left-foot': [72, 214],
    'leg-right': [88, 152],
    'leg-right-shin': [88, 184],
    'leg-right-foot': [88, 214],
  };
  // Soles per shoe: front faces the viewer, side is the profile shoe with the toe to the right.
  const SOLES = {
    front: { left: [[61.5, 221.5], [80, 221.5]], right: [[80, 221.5], [98.5, 221.5]] },
    side: { left: [[64, 221.5], [86, 221.5]], right: [[80, 221.5], [102, 221.5]] },
  };
  const RIGS = {
    v2: {
      pivots: {
        head: [80, 80],
        'arm-left': [59, 100],
        'arm-left-forearm': [54, 129],
        'arm-right': [101, 100],
        'arm-right-forearm': [106, 129],
        ...LEGS,
      },
      hands: { left: [47.87, 154.27], right: [112.13, 154.27] },
      chalk: [44.89, 166.36],
      soles: SOLES,
    },
    // The narrow-shouldered v7 figure (archive/grandpa-v7.svg), for the before/after panels. It has no profile torso.
    v7: {
      pivots: {
        head: [80, 80],
        'arm-left': [64, 100],
        'arm-left-forearm': [59, 129],
        'arm-right': [96, 100],
        'arm-right-forearm': [101, 129],
        ...LEGS,
      },
      hands: { left: [52.87, 154.27], right: [107.13, 154.27] },
      chalk: [49.89, 166.36],
      soles: SOLES,
    },
  };

  // Gait: a heel-toe walk, slow and careful. Times are fractions of one foot's cycle from its heel strike.
  // The foot lands on the heel tipped HEEL_STRIKE degrees toe-up, rolls flat by HEEL_ROLL, starts peeling off
  // over the toe at TOE_ROLL and leaves the floor at STANCE tipped TOE_OFF degrees heel-up; while it carries
  // weight its sole doesn't slide. In the air it swings low, STEP_HEIGHT above the straight path, and is ready
  // to land toe-up by SWING_TURN of the swing. The hips glide on at STEP_LEN per step, pass over the ankle at
  // MID_STANCE and ride as high as both feet allow with the knees bent at least KNEE_SOFT, rounded off by HIP_EASE,
  // so the body rises over the planted foot and dips where the feet hand over. Two-bone IK turns each ankle into
  // thigh and knee angles. In profile the hips draw together by HIP_DRAW to one point.
  const STEP_LEN = 38;
  const HEEL_STRIKE = 8;
  const HEEL_ROLL = 0.08;
  const TOE_ROLL = 0.38;
  const STANCE = 0.62;
  const TOE_OFF = 18;
  const STEP_HEIGHT = 5;
  const SWING_TURN = 0.7;
  const MID_STANCE = 0.27;
  const KNEE_SOFT = 12;
  const HIP_EASE = 1;
  const HIP_DRAW = 8;
  // Seated, the figure turns to profile: the shoulders draw in by SHOULDER_DRAW to x 80, over the hips,
  // and the profile torso stands in for the front one once they are more than halfway in.
  const SHOULDER_DRAW = 21;
  // Arms swing as seen from the front, against the legs: the arm going forward turns in by ARM_IN and folds its
  // forearm in over the body by up to ELBOW_SWING, the one going back turns out as much and hangs straight.
  // The elbows keep ELBOW_BEND so the arms never lock into sticks.
  const ARM_IN = 2.5;
  const ELBOW_SWING = 14;
  const ELBOW_BEND = 4;
  const STANDING = { 'leg-left': 1.5, 'leg-right': -1.5, 'leg-left-foot': -1.5, 'leg-right-foot': 1.5 };
  const SEATED = {
    hips: HIP_DRAW,
    shoulders: SHOULDER_DRAW,
    'leg-left': -90,
    'leg-left-shin': 90,
    'leg-right': -90,
    'leg-right-shin': 90,
  };
  // Which draw-in amount moves each part, and which way: the left limbs move right, the right ones left.
  const DRAW = { 'leg-left': ['hips', 1], 'leg-right': ['hips', -1], 'arm-left': ['shoulders', 1], 'arm-right': ['shoulders', -1] };

  const rad = (deg) => (deg * Math.PI) / 180;
  const deg = (r) => (r * 180) / Math.PI;
  const shift = (parts, id) => (id in DRAW ? DRAW[id][1] * (parts[DRAW[id][0]] ?? 0) : 0);

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
  const hand = (rig, parts, side) => through(rig, parts, rig.hands[side], [`arm-${side}`, `arm-${side}-forearm`]);
  const chalkTip = (rig, parts) => through(rig, parts, rig.chalk, ['arm-left', 'arm-left-forearm']);

  // Thigh and shin lengths: hip to knee, knee to ankle.
  function bones(rig) {
    const y = (id) => rig.pivots[id][1];
    return [y('leg-left-shin') - y('leg-left'), y('leg-left-foot') - y('leg-left-shin')];
  }

  const ease = (r) => (1 - Math.cos(Math.PI * r)) / 2;
  const lerp = (from, to, r) => from + (to - from) * r;

  // A point given relative to the ankle, y up, on a foot tipped toe-down by phi degrees.
  function tilt([x, y], phi) {
    const c = Math.cos(rad(phi));
    const s = Math.sin(rad(phi));
    return [x * c + y * s, y * c - x * s];
  }

  // The profile shoe's heel and toe corners relative to the ankle, y up.
  function footOf(rig) {
    const [ax, ay] = rig.pivots['leg-left-foot'];
    const [heel, toe] = rig.soles.side.left.map(([x, y]) => [x - ax, ay - y]);
    return { heel, toe };
  }

  // The ankle [x, y] above the floor and the tilt of a foot resting on one corner at x.
  function resting(corner, x, phi) {
    const [cx, cy] = tilt(corner, phi);
    return { x: x - cx, y: -cy, phi };
  }

  // One foot at time t of its cycle; the footprint it lands on at t 0 has its heel at x 0, the next one at 2 * STEP_LEN.
  function footAt({ heel, toe }, t) {
    const toeX = toe[0] - heel[0];
    if (t < HEEL_ROLL) return resting(heel, 0, -HEEL_STRIKE * (1 - ease(t / HEEL_ROLL)));
    if (t < TOE_ROLL) return resting(heel, 0, 0);
    if (t < STANCE) return resting(toe, toeX, TOE_OFF * ease((t - TOE_ROLL) / (STANCE - TOE_ROLL)));
    const s = (t - STANCE) / (1 - STANCE);
    const from = resting(toe, toeX, TOE_OFF);
    const to = resting(heel, 2 * STEP_LEN, -HEEL_STRIKE);
    return {
      x: lerp(from.x, to.x, ease(s)),
      y: lerp(from.y, to.y, ease(s)) + STEP_HEIGHT * Math.sin(Math.PI * s),
      phi: lerp(TOE_OFF, -HEEL_STRIKE, ease(Math.min(1, s / SWING_TURN))),
    };
  }

  // A foot at this point of its cycle (whole cycles ignored) seen from the hips: forward offset h, height y, tilt.
  function footState(foot, cycle) {
    const t = cycle - Math.floor(cycle);
    const { x, y, phi } = footAt(foot, t);
    return { h: x + foot.heel[0] - 2 * STEP_LEN * (t - MID_STANCE), y, phi };
  }

  // Hip height above the floor: as high as every ankle stays in reach of a leg bent KNEE_SOFT, softened by HIP_EASE.
  function hipHeight(rig, feet) {
    const [a, b] = bones(rig);
    const leg = Math.sqrt(a * a + b * b + 2 * a * b * Math.cos(rad(KNEE_SOFT)));
    const reach = feet.map(({ h, y }) => y + Math.sqrt(Math.max(0, leg * leg - h * h)));
    const low = Math.min(...reach);
    return low - HIP_EASE * Math.log(reach.reduce((sum, r) => sum + Math.exp((low - r) / HIP_EASE), 0));
  }

  // Degrees, forward positive: thigh from vertical, knee bend, foot relative to the shin.
  function legTo(rig, { h, y, phi }, hipY) {
    const [a, b] = bones(rig);
    const v = hipY - y;
    const knee = Math.acos(Math.min(1, (h * h + v * v - a * a - b * b) / (2 * a * b)));
    const thigh = deg(Math.atan2(h, v) + Math.atan2(b * Math.sin(knee), a + b * Math.cos(knee)));
    return { thigh, knee: deg(knee), foot: phi + thigh - deg(knee) };
  }

  // dir 1 walks right, -1 walks left. The left heel strikes at phase π/2, the right one half a cycle later.
  function walk(rig, phase, dir) {
    const foot = footOf(rig);
    const cycle = phase / (2 * Math.PI) - 0.25;
    const feet = [footState(foot, cycle), footState(foot, cycle + 0.5)];
    const hipY = hipHeight(rig, feet);
    const [left, right] = feet.map((f) => legTo(rig, f, hipY));
    // The right arm leads while the left leg does (sin > 0). Left-arm angles turn in when negative, right ones when positive.
    const s = Math.sin(phase);
    const fold = (lead) => ELBOW_BEND + ELBOW_SWING * ((1 + lead) / 2) ** 2;
    return {
      hips: HIP_DRAW,
      'leg-left': -dir * left.thigh,
      'leg-left-shin': dir * left.knee,
      'leg-left-foot': dir * left.foot,
      'leg-right': -dir * right.thigh,
      'leg-right-shin': dir * right.knee,
      'leg-right-foot': dir * right.foot,
      'arm-left': ARM_IN * s,
      'arm-left-forearm': -fold(-s),
      'arm-right': ARM_IN * s,
      'arm-right-forearm': fold(s),
    };
  }

  // How far the body has travelled, in figure units: the hips glide on at STEP_LEN per half cycle.
  const walkOffset = (rig, phase) => (STEP_LEN * phase) / Math.PI;

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
    showFeet(el, rig, feet);
    if (el('torso-side')) {
      const profile = (parts.shoulders ?? 0) > SHOULDER_DRAW / 2;
      el('torso-side').setAttribute('display', profile ? 'inline' : 'none');
      el('torso-front').setAttribute('display', profile ? 'none' : 'inline');
    }
    el('eyes').setAttribute('transform', `translate(${eyes[0]} ${eyes[1]})`);
    el('chalk').setAttribute('display', chalk ? 'inline' : 'none');
    el('place').setAttribute('transform', `translate(${place[0]} ${place[1]}) scale(${place[2] ?? 1})`);
  }

  window.Rig = { RIGS, STANDING, SEATED, walk, walkOffset, lowestSole, ankle, hand, chalkTip, pose };
})();
