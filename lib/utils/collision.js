/**
 * Shape collision helpers (composition, no classes).
 *
 * Shapes (axis-aligned where noted; centers are world positions):
 *
 *   box:      { type:'box', center:[x,y,z], halfExtents:[hx,hy,hz] }
 *   sphere:   { type:'sphere', center:[x,y,z], radius }
 *   cylinder: { type:'cylinder', center:[x,y,z], radius, halfHeight }  // Y-axis
 *   cone:     { type:'cone', center:[x,y,z], radius, height }           // Y-axis, Three.js style
 *             // base (radius) at y = center.y - height/2, apex at center.y + height/2
 *
 * Result: null if no hit, else { normal:[nx,ny,nz], depth } where normal pushes A out of B
 * (unit vector, A should move by normal * depth).
 */

/**
 * @typedef {[number, number, number]} Vec3
 * @typedef {{ type: 'box', center: Vec3, halfExtents: Vec3 }} BoxShape
 * @typedef {{ type: 'sphere', center: Vec3, radius: number }} SphereShape
 * @typedef {{ type: 'cylinder', center: Vec3, radius: number, halfHeight: number }} CylinderShape
 * @typedef {{ type: 'cone', center: Vec3, radius: number, height: number }} ConeShape
 * @typedef {BoxShape|SphereShape|CylinderShape|ConeShape} Shape
 * @typedef {{ normal: Vec3, depth: number }} Hit
 */

/** @param {number} v @param {number} lo @param {number} hi */
function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

/** @param {Vec3} a @param {Vec3} b @returns {Vec3} */
function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

/** @param {Vec3} a @param {number} s @returns {Vec3} */
function scale(a, s) {
  return [a[0] * s, a[1] * s, a[2] * s];
}

/** @param {Vec3} a @param {Vec3} b @returns {Vec3} */
function add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

/** @param {Vec3} v */
function length3(v) {
  return Math.hypot(v[0], v[1], v[2]);
}

/** @param {Vec3} v @param {number} [eps=1e-8] @returns {Vec3|null} */
function normalize(v, eps = 1e-8) {
  const len = length3(v);
  if (len < eps) return null;
  return [v[0] / len, v[1] / len, v[2] / len];
}

/**
 * @param {BoxShape} box
 * @param {Vec3} p
 * @returns {Vec3}
 */
export function closestPointOnBox(box, p) {
  const c = box.center;
  const h = box.halfExtents;
  return [
    clamp(p[0], c[0] - h[0], c[0] + h[0]),
    clamp(p[1], c[1] - h[1], c[1] + h[1]),
    clamp(p[2], c[2] - h[2], c[2] + h[2]),
  ];
}

/**
 * Build a box shape from center + full size (width, height, depth).
 * @param {Vec3} center
 * @param {number|Vec3} size  scalar or [w,h,d]
 * @returns {BoxShape}
 */
export function boxFromSize(center, size) {
  const s = Array.isArray(size) ? size : [size, size, size];
  return {
    type: 'box',
    center: [center[0], center[1], center[2]],
    halfExtents: [s[0] / 2, s[1] / 2, s[2] / 2],
  };
}

/**
 * @param {object} def  geometry element def with geometry + position + size fields
 * @param {{ x: number, y: number, z: number }|Vec3} [position]
 * @returns {Shape|null}
 */
export function shapeFromGeometryDef(def, position) {
  const pos = position
    ? Array.isArray(position)
      ? position
      : [position.x, position.y, position.z]
    : Array.isArray(def.position)
      ? def.position
      : [0, 0, 0];
  const g = def.geometry ?? 'box';

  if (g === 'box') {
    const w = def.width ?? 1;
    const h = def.height ?? 1;
    const d = def.depth ?? 1;
    return boxFromSize(/** @type {Vec3} */ (pos), [w, h, d]);
  }
  if (g === 'sphere') {
    return {
      type: 'sphere',
      center: /** @type {Vec3} */ ([pos[0], pos[1], pos[2]]),
      radius: def.radius ?? 0.5,
    };
  }
  if (g === 'cylinder') {
    const h = def.height ?? 1;
    return {
      type: 'cylinder',
      center: /** @type {Vec3} */ ([pos[0], pos[1], pos[2]]),
      radius: def.radiusTop ?? def.radiusBottom ?? def.radius ?? 0.5,
      halfHeight: h / 2,
    };
  }
  if (g === 'cone') {
    return {
      type: 'cone',
      center: /** @type {Vec3} */ ([pos[0], pos[1], pos[2]]),
      radius: def.radius ?? 0.5,
      height: def.height ?? 1,
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Box
// ---------------------------------------------------------------------------

/**
 * AABB vs AABB.
 * @param {BoxShape} a
 * @param {BoxShape} b
 * @returns {Hit|null}
 */
export function collideBoxBox(a, b) {
  const dx = a.center[0] - b.center[0];
  const dy = a.center[1] - b.center[1];
  const dz = a.center[2] - b.center[2];
  const ox = a.halfExtents[0] + b.halfExtents[0] - Math.abs(dx);
  const oy = a.halfExtents[1] + b.halfExtents[1] - Math.abs(dy);
  const oz = a.halfExtents[2] + b.halfExtents[2] - Math.abs(dz);
  if (ox <= 0 || oy <= 0 || oz <= 0) return null;

  // Minimum translation along the shallowest axis
  if (ox <= oy && ox <= oz) {
    return { normal: [dx < 0 ? -1 : 1, 0, 0], depth: ox };
  }
  if (oy <= ox && oy <= oz) {
    return { normal: [0, dy < 0 ? -1 : 1, 0], depth: oy };
  }
  return { normal: [0, 0, dz < 0 ? -1 : 1], depth: oz };
}

// ---------------------------------------------------------------------------
// Sphere
// ---------------------------------------------------------------------------

/**
 * @param {SphereShape} a
 * @param {SphereShape} b
 * @returns {Hit|null}
 */
export function collideSphereSphere(a, b) {
  const d = sub(a.center, b.center);
  const dist = length3(d);
  const sum = a.radius + b.radius;
  if (dist >= sum) return null;
  if (dist < 1e-8) {
    return { normal: [0, 1, 0], depth: sum };
  }
  const n = /** @type {Vec3} */ (scale(d, 1 / dist));
  return { normal: n, depth: sum - dist };
}

/**
 * @param {BoxShape} box
 * @param {SphereShape} sphere
 * @returns {Hit|null}
 */
export function collideBoxSphere(box, sphere) {
  const closest = closestPointOnBox(box, sphere.center);
  const d = sub(sphere.center, closest);
  const dist = length3(d);

  if (dist > 1e-8 && dist < sphere.radius) {
    // Sphere center outside box but shell overlaps
    const n = /** @type {Vec3} */ (scale(d, 1 / dist));
    // normal pushes box (A) out of sphere (B): from sphere toward box = -n from center-to-closest
    return { normal: scale(n, -1), depth: sphere.radius - dist };
  }

  if (dist > sphere.radius) return null;

  // Sphere center inside box — exit through nearest face (outward).
  // Pushing the sphere by +faceNormal ≡ pushing the box by −faceNormal.
  const c = box.center;
  const h = box.halfExtents;
  const s = sphere.center;
  const faces = [
    { n: /** @type {Vec3} */ ([1, 0, 0]), pen: h[0] - (s[0] - c[0]) },
    { n: /** @type {Vec3} */ ([-1, 0, 0]), pen: h[0] - (c[0] - s[0]) },
    { n: /** @type {Vec3} */ ([0, 1, 0]), pen: h[1] - (s[1] - c[1]) },
    { n: /** @type {Vec3} */ ([0, -1, 0]), pen: h[1] - (c[1] - s[1]) },
    { n: /** @type {Vec3} */ ([0, 0, 1]), pen: h[2] - (s[2] - c[2]) },
    { n: /** @type {Vec3} */ ([0, 0, -1]), pen: h[2] - (c[2] - s[2]) },
  ];
  let best = faces[0];
  for (const f of faces) {
    if (f.pen < best.pen) best = f;
  }
  return { normal: scale(best.n, -1), depth: best.pen + sphere.radius };
}

/**
 * @param {SphereShape} sphere
 * @param {BoxShape} box
 * @returns {Hit|null}
 */
export function collideSphereBox(sphere, box) {
  const hit = collideBoxSphere(box, sphere);
  if (!hit) return null;
  return { normal: scale(hit.normal, -1), depth: hit.depth };
}

// ---------------------------------------------------------------------------
// Cylinder (Y-axis)
// ---------------------------------------------------------------------------

/**
 * 2D point vs AABB distance squared on XZ plane + closest offset.
 * @returns {{ distSq: number, dx: number, dz: number, inside: boolean }}
 */
function xzPointToAabb(px, pz, minX, maxX, minZ, maxZ) {
  const cx = clamp(px, minX, maxX);
  const cz = clamp(pz, minZ, maxZ);
  const dx = px - cx;
  const dz = pz - cz;
  const distSq = dx * dx + dz * dz;
  const inside = px >= minX && px <= maxX && pz >= minZ && pz <= maxZ;
  return { distSq, dx, dz, inside };
}

/**
 * Box (AABB) vs Y-aligned cylinder.
 * @param {BoxShape} box
 * @param {CylinderShape} cyl
 * @returns {Hit|null}
 */
export function collideBoxCylinder(box, cyl) {
  const bc = box.center;
  const bh = box.halfExtents;
  const cc = cyl.center;

  const boxMinY = bc[1] - bh[1];
  const boxMaxY = bc[1] + bh[1];
  const cylMinY = cc[1] - cyl.halfHeight;
  const cylMaxY = cc[1] + cyl.halfHeight;

  const yOverlap = Math.min(boxMaxY, cylMaxY) - Math.max(boxMinY, cylMinY);
  if (yOverlap <= 0) return null;

  const minX = bc[0] - bh[0];
  const maxX = bc[0] + bh[0];
  const minZ = bc[2] - bh[2];
  const maxZ = bc[2] + bh[2];

  const { distSq, dx, dz, inside } = xzPointToAabb(cc[0], cc[2], minX, maxX, minZ, maxZ);
  const r = cyl.radius;

  // No XZ overlap with expanded circle
  if (!inside && distSq >= r * r) return null;

  // Penetration candidates: radial XZ vs vertical Y
  let radialDepth;
  /** @type {Vec3} */
  let radialNormal;

  if (inside || distSq < 1e-12) {
    // Axis projects inside box XZ — push out to nearest vertical face + radius
    const toL = cc[0] - minX;
    const toR = maxX - cc[0];
    const toD = cc[2] - minZ;
    const toU = maxZ - cc[2];
    const m = Math.min(toL, toR, toD, toU);
    if (m === toL) {
      radialNormal = [-1, 0, 0];
      radialDepth = toL + r;
    } else if (m === toR) {
      radialNormal = [1, 0, 0];
      radialDepth = toR + r;
    } else if (m === toD) {
      radialNormal = [0, 0, -1];
      radialDepth = toD + r;
    } else {
      radialNormal = [0, 0, 1];
      radialDepth = toU + r;
    }
  } else {
    const dist = Math.sqrt(distSq);
    radialDepth = r - dist;
    // normal on box: away from cylinder axis
    radialNormal = [-dx / dist, 0, -dz / dist];
  }

  // Y separation alternative
  const boxAbove = bc[1] >= cc[1];
  const yDepth = yOverlap;
  const yNormal = /** @type {Vec3} */ ([0, boxAbove ? 1 : -1, 0]);

  if (radialDepth <= yDepth) {
    return { normal: radialNormal, depth: radialDepth };
  }
  return { normal: yNormal, depth: yDepth };
}

/**
 * @param {CylinderShape} a
 * @param {CylinderShape} b
 * @returns {Hit|null}
 */
export function collideCylinderCylinder(a, b) {
  const dy = a.center[1] - b.center[1];
  const yOverlap = a.halfHeight + b.halfHeight - Math.abs(dy);
  if (yOverlap <= 0) return null;

  const dx = a.center[0] - b.center[0];
  const dz = a.center[2] - b.center[2];
  const dist = Math.hypot(dx, dz);
  const sumR = a.radius + b.radius;
  if (dist >= sumR) return null;

  const radialDepth = sumR - (dist < 1e-8 ? 0 : dist);
  /** @type {Vec3} */
  let radialNormal;
  if (dist < 1e-8) {
    radialNormal = [1, 0, 0];
  } else {
    radialNormal = [dx / dist, 0, dz / dist];
  }

  if (radialDepth <= yOverlap) {
    return { normal: radialNormal, depth: radialDepth };
  }
  return { normal: [0, dy < 0 ? -1 : 1, 0], depth: yOverlap };
}

/**
 * @param {SphereShape} sphere
 * @param {CylinderShape} cyl
 * @returns {Hit|null}
 */
export function collideSphereCylinder(sphere, cyl) {
  // Closest point on cylinder solid to sphere center
  const sc = sphere.center;
  const cc = cyl.center;
  const y = clamp(sc[1], cc[1] - cyl.halfHeight, cc[1] + cyl.halfHeight);
  const dx = sc[0] - cc[0];
  const dz = sc[2] - cc[2];
  const horiz = Math.hypot(dx, dz);
  let px;
  let pz;
  if (horiz < 1e-8) {
    px = cc[0] + cyl.radius;
    pz = cc[2];
  } else {
    const rh = Math.min(horiz, cyl.radius);
    px = cc[0] + (dx / horiz) * rh;
    pz = cc[2] + (dz / horiz) * rh;
  }
  // Cap: if y was clamped and horiz < radius, closest is on disk
  if (sc[1] > cc[1] + cyl.halfHeight || sc[1] < cc[1] - cyl.halfHeight) {
    if (horiz <= cyl.radius) {
      px = sc[0];
      pz = sc[2];
    }
  }
  const closest = /** @type {Vec3} */ ([px, y, pz]);
  const d = sub(sc, closest);
  const dist = length3(d);
  if (dist >= sphere.radius) return null;
  if (dist < 1e-8) {
    return { normal: [0, sc[1] >= cc[1] ? 1 : -1, 0], depth: sphere.radius };
  }
  return { normal: /** @type {Vec3} */ (scale(d, 1 / dist)), depth: sphere.radius - dist };
}

// ---------------------------------------------------------------------------
// Cone (Y-axis, Three.js orientation)
// ---------------------------------------------------------------------------

/**
 * Horizontal radius of a Y-aligned Three.js cone at world Y.
 * Base at center.y - height/2, apex at center.y + height/2.
 * @param {ConeShape} cone
 * @param {number} worldY
 * @returns {number|null} null if outside height range
 */
export function coneRadiusAtY(cone, worldY) {
  const half = cone.height / 2;
  const localY = worldY - cone.center[1];
  if (localY < -half - 1e-8 || localY > half + 1e-8) return null;
  const t = (localY + half) / cone.height; // 0 base → 1 apex
  return cone.radius * (1 - clamp(t, 0, 1));
}

/**
 * Point inside cone test.
 * @param {ConeShape} cone
 * @param {Vec3} p
 */
export function pointInCone(cone, p) {
  const r = coneRadiusAtY(cone, p[1]);
  if (r == null) return false;
  const dx = p[0] - cone.center[0];
  const dz = p[2] - cone.center[2];
  return dx * dx + dz * dz <= r * r + 1e-8;
}

/**
 * Box (AABB) vs Y-aligned cone.
 * @param {BoxShape} box
 * @param {ConeShape} cone
 * @returns {Hit|null}
 */
export function collideBoxCone(box, cone) {
  const bc = box.center;
  const bh = box.halfExtents;
  const cc = cone.center;
  const half = cone.height / 2;
  const coneMinY = cc[1] - half;
  const coneMaxY = cc[1] + half;
  const boxMinY = bc[1] - bh[1];
  const boxMaxY = bc[1] + bh[1];

  const yOverlap = Math.min(boxMaxY, coneMaxY) - Math.max(boxMinY, coneMinY);
  if (yOverlap <= 0) return null;

  // Sample Y band of overlap for the tightest horizontal radius the box must clear
  const yLo = Math.max(boxMinY, coneMinY);
  const yHi = Math.min(boxMaxY, coneMaxY);
  // Use radius at lowest overlap Y (widest part of cone in the band)
  const rWide = coneRadiusAtY(cone, yLo);
  if (rWide == null || rWide <= 0) {
    // Only near apex — treat as tiny cylinder
    if (yOverlap > 0 && Math.abs(bc[0] - cc[0]) < bh[0] && Math.abs(bc[2] - cc[2]) < bh[2]) {
      return { normal: [0, bc[1] >= cc[1] ? 1 : -1, 0], depth: yOverlap };
    }
  }

  const r = Math.max(rWide ?? 0, 1e-6);
  const minX = bc[0] - bh[0];
  const maxX = bc[0] + bh[0];
  const minZ = bc[2] - bh[2];
  const maxZ = bc[2] + bh[2];

  const { distSq, dx, dz, inside } = xzPointToAabb(cc[0], cc[2], minX, maxX, minZ, maxZ);

  if (!inside && distSq >= r * r) {
    // Also test if any box corner at yLo is inside wider cone
    const corners = [
      [minX, yLo, minZ],
      [maxX, yLo, minZ],
      [minX, yLo, maxZ],
      [maxX, yLo, maxZ],
      [minX, yHi, minZ],
      [maxX, yHi, minZ],
      [minX, yHi, maxZ],
      [maxX, yHi, maxZ],
    ];
    let any = false;
    for (const p of corners) {
      if (pointInCone(cone, /** @type {Vec3} */ (p))) {
        any = true;
        break;
      }
    }
    // Closest box point to axis at mid band
    const midY = (yLo + yHi) / 2;
    const closest = closestPointOnBox(box, [cc[0], midY, cc[2]]);
    if (!any && !pointInCone(cone, closest)) return null;
  }

  if (!inside && distSq >= r * r) {
    // Corner inside — still need MTV; fall through with radial from closest
  }

  let radialDepth;
  /** @type {Vec3} */
  let radialNormal;

  if (inside || distSq < 1e-12) {
    const toL = cc[0] - minX;
    const toR = maxX - cc[0];
    const toD = cc[2] - minZ;
    const toU = maxZ - cc[2];
    const m = Math.min(toL, toR, toD, toU);
    if (m === toL) {
      radialNormal = [-1, 0, 0];
      radialDepth = toL + r;
    } else if (m === toR) {
      radialNormal = [1, 0, 0];
      radialDepth = toR + r;
    } else if (m === toD) {
      radialNormal = [0, 0, -1];
      radialDepth = toD + r;
    } else {
      radialNormal = [0, 0, 1];
      radialDepth = toU + r;
    }
  } else {
    const dist = Math.sqrt(distSq);
    if (dist >= r) {
      // Overlap only via height-varying radius — use closest point check
      const midY = (yLo + yHi) / 2;
      const closest = closestPointOnBox(box, [cc[0], midY, cc[2]]);
      const cr = coneRadiusAtY(cone, closest[1]);
      if (cr == null) return null;
      const cdx = closest[0] - cc[0];
      const cdz = closest[2] - cc[2];
      const cd = Math.hypot(cdx, cdz);
      if (cd >= cr) return null;
      radialDepth = cr - cd;
      if (cd < 1e-8) {
        radialNormal = [1, 0, 0];
      } else {
        radialNormal = [-cdx / cd, 0, -cdz / cd];
      }
    } else {
      radialDepth = r - dist;
      radialNormal = [-dx / dist, 0, -dz / dist];
    }
  }

  const boxAbove = bc[1] >= cc[1];
  const yDepth = yOverlap;
  const yNormal = /** @type {Vec3} */ ([0, boxAbove ? 1 : -1, 0]);

  if (radialDepth <= yDepth) {
    return { normal: radialNormal, depth: radialDepth };
  }
  return { normal: yNormal, depth: yDepth };
}

/**
 * Sphere vs Y-aligned cone.
 * @param {SphereShape} sphere
 * @param {ConeShape} cone
 * @returns {Hit|null}
 */
export function collideSphereCone(sphere, cone) {
  const sc = sphere.center;
  const cc = cone.center;
  const half = cone.height / 2;
  const y = clamp(sc[1], cc[1] - half, cc[1] + half);
  const rAt = coneRadiusAtY(cone, y) ?? 0;
  const dx = sc[0] - cc[0];
  const dz = sc[2] - cc[2];
  const horiz = Math.hypot(dx, dz);
  let px;
  let pz;
  if (horiz < 1e-8) {
    px = cc[0] + rAt;
    pz = cc[2];
  } else {
    const rh = Math.min(horiz, rAt);
    px = cc[0] + (dx / horiz) * rh;
    pz = cc[2] + (dz / horiz) * rh;
  }
  if ((sc[1] > cc[1] + half || sc[1] < cc[1] - half) && horiz <= rAt) {
    px = sc[0];
    pz = sc[2];
  }
  const closest = /** @type {Vec3} */ ([px, y, pz]);
  const d = sub(sc, closest);
  const dist = length3(d);
  if (dist >= sphere.radius) return null;
  if (dist < 1e-8) {
    return { normal: [0, sc[1] >= cc[1] ? 1 : -1, 0], depth: sphere.radius };
  }
  return { normal: /** @type {Vec3} */ (scale(d, 1 / dist)), depth: sphere.radius - dist };
}

/**
 * Cylinder vs cone (both Y-aligned).
 * @param {CylinderShape} cyl
 * @param {ConeShape} cone
 * @returns {Hit|null}
 */
export function collideCylinderCone(cyl, cone) {
  // Approximate: treat as sphere chain / Y-overlap + radial at widest shared band
  const cyc = cyl.center;
  const coc = cone.center;
  const cylMin = cyc[1] - cyl.halfHeight;
  const cylMax = cyc[1] + cyl.halfHeight;
  const half = cone.height / 2;
  const coneMin = coc[1] - half;
  const coneMax = coc[1] + half;
  const yOverlap = Math.min(cylMax, coneMax) - Math.max(cylMin, coneMin);
  if (yOverlap <= 0) return null;

  const yLo = Math.max(cylMin, coneMin);
  const rCone = coneRadiusAtY(cone, yLo) ?? 0;
  const sumR = cyl.radius + rCone;
  const dx = cyc[0] - coc[0];
  const dz = cyc[2] - coc[2];
  const dist = Math.hypot(dx, dz);
  if (dist >= sumR) return null;

  const radialDepth = sumR - (dist < 1e-8 ? 0 : dist);
  /** @type {Vec3} */
  const radialNormal =
    dist < 1e-8 ? [1, 0, 0] : [dx / dist, 0, dz / dist];

  if (radialDepth <= yOverlap) {
    return { normal: radialNormal, depth: radialDepth };
  }
  return { normal: [0, cyc[1] >= coc[1] ? 1 : -1, 0], depth: yOverlap };
}

/**
 * Cone vs cone (Y-aligned).
 * @param {ConeShape} a
 * @param {ConeShape} b
 * @returns {Hit|null}
 */
export function collideConeCone(a, b) {
  const halfA = a.height / 2;
  const halfB = b.height / 2;
  const aMin = a.center[1] - halfA;
  const aMax = a.center[1] + halfA;
  const bMin = b.center[1] - halfB;
  const bMax = b.center[1] + halfB;
  const yOverlap = Math.min(aMax, bMax) - Math.max(aMin, bMin);
  if (yOverlap <= 0) return null;

  const yLo = Math.max(aMin, bMin);
  const rA = coneRadiusAtY(a, yLo) ?? 0;
  const rB = coneRadiusAtY(b, yLo) ?? 0;
  const dx = a.center[0] - b.center[0];
  const dz = a.center[2] - b.center[2];
  const dist = Math.hypot(dx, dz);
  const sumR = rA + rB;
  if (dist >= sumR) return null;

  const radialDepth = sumR - (dist < 1e-8 ? 0 : dist);
  /** @type {Vec3} */
  const radialNormal =
    dist < 1e-8 ? [1, 0, 0] : [dx / dist, 0, dz / dist];

  if (radialDepth <= yOverlap) {
    return { normal: radialNormal, depth: radialDepth };
  }
  return { normal: [0, a.center[1] >= b.center[1] ? 1 : -1, 0], depth: yOverlap };
}

// ---------------------------------------------------------------------------
// Dispatch + resolution
// ---------------------------------------------------------------------------

/**
 * Collide two shapes. Normal pushes A out of B.
 * @param {Shape} a
 * @param {Shape} b
 * @returns {Hit|null}
 */
export function collide(a, b) {
  const ta = a.type;
  const tb = b.type;

  if (ta === 'box' && tb === 'box') return collideBoxBox(a, b);
  if (ta === 'sphere' && tb === 'sphere') return collideSphereSphere(a, b);
  if (ta === 'cylinder' && tb === 'cylinder') return collideCylinderCylinder(a, b);
  if (ta === 'cone' && tb === 'cone') return collideConeCone(a, b);

  if (ta === 'box' && tb === 'sphere') return collideBoxSphere(a, b);
  if (ta === 'sphere' && tb === 'box') return collideSphereBox(a, b);

  if (ta === 'box' && tb === 'cylinder') return collideBoxCylinder(a, b);
  if (ta === 'cylinder' && tb === 'box') {
    const hit = collideBoxCylinder(b, a);
    return hit ? { normal: scale(hit.normal, -1), depth: hit.depth } : null;
  }

  if (ta === 'box' && tb === 'cone') return collideBoxCone(a, b);
  if (ta === 'cone' && tb === 'box') {
    const hit = collideBoxCone(b, a);
    return hit ? { normal: scale(hit.normal, -1), depth: hit.depth } : null;
  }

  if (ta === 'sphere' && tb === 'cylinder') return collideSphereCylinder(a, b);
  if (ta === 'cylinder' && tb === 'sphere') {
    const hit = collideSphereCylinder(b, a);
    return hit ? { normal: scale(hit.normal, -1), depth: hit.depth } : null;
  }

  if (ta === 'sphere' && tb === 'cone') return collideSphereCone(a, b);
  if (ta === 'cone' && tb === 'sphere') {
    const hit = collideSphereCone(b, a);
    return hit ? { normal: scale(hit.normal, -1), depth: hit.depth } : null;
  }

  if (ta === 'cylinder' && tb === 'cone') return collideCylinderCone(a, b);
  if (ta === 'cone' && tb === 'cylinder') {
    const hit = collideCylinderCone(b, a);
    return hit ? { normal: scale(hit.normal, -1), depth: hit.depth } : null;
  }

  return null;
}

/**
 * Boolean overlap test.
 * @param {Shape} a
 * @param {Shape} b
 */
export function intersects(a, b) {
  return collide(a, b) != null;
}

/**
 * Move a box center so it no longer penetrates `other` (if it does).
 * @param {BoxShape} box  mutated center
 * @param {Shape} other
 * @param {number} [slop=1e-4]
 * @returns {Hit|null} hit that was resolved (if any)
 */
export function separateBox(box, other, slop = 1e-4) {
  const hit = collide(box, other);
  if (!hit || hit.depth <= slop) return null;
  const push = hit.depth + slop;
  box.center[0] += hit.normal[0] * push;
  box.center[1] += hit.normal[1] * push;
  box.center[2] += hit.normal[2] * push;
  return hit;
}

/**
 * Resolve a moving AABB against many static shapes (iterative).
 * @param {BoxShape} box  mutated
 * @param {Shape[]} obstacles
 * @param {number} [iterations=4]
 * @returns {number} number of separations applied
 */
export function resolveBoxCollisions(box, obstacles, iterations = 4) {
  let count = 0;
  for (let i = 0; i < iterations; i++) {
    let any = false;
    for (const o of obstacles) {
      if (separateBox(box, o)) {
        any = true;
        count++;
      }
    }
    if (!any) break;
  }
  return count;
}

/**
 * Apply a desired translation to a box, then resolve against obstacles.
 * Y is optional (keep grounded games free to lock Y).
 *
 * @param {BoxShape} box  current box (center mutated)
 * @param {Vec3} delta  desired movement
 * @param {Shape[]} obstacles
 * @param {{ lockY?: boolean, iterations?: number }} [opts]
 * @returns {Vec3} final center
 */
export function moveBoxWithCollisions(box, delta, obstacles, opts = {}) {
  const lockY = opts.lockY === true;
  const iterations = opts.iterations ?? 4;

  // Axis-separated sweep (reduces corner tunneling)
  if (delta[0] !== 0) {
    box.center[0] += delta[0];
    resolveBoxCollisions(box, obstacles, iterations);
  }
  if (!lockY && delta[1] !== 0) {
    box.center[1] += delta[1];
    resolveBoxCollisions(box, obstacles, iterations);
  }
  if (delta[2] !== 0) {
    box.center[2] += delta[2];
    resolveBoxCollisions(box, obstacles, iterations);
  }

  return box.center;
}

export const collision = {
  closestPointOnBox,
  boxFromSize,
  shapeFromGeometryDef,
  coneRadiusAtY,
  pointInCone,
  collideBoxBox,
  collideSphereSphere,
  collideBoxSphere,
  collideSphereBox,
  collideBoxCylinder,
  collideCylinderCylinder,
  collideSphereCylinder,
  collideBoxCone,
  collideSphereCone,
  collideCylinderCone,
  collideConeCone,
  collide,
  intersects,
  separateBox,
  resolveBoxCollisions,
  moveBoxWithCollisions,
};

export default collision;
