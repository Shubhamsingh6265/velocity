import { getAimDirection, raycastMap } from './physics';
import { MapBlock, MapData, SpawnPoint } from './types';

export function makePerimeterWalls(halfW: number, halfD: number, height = 5.5): MapBlock[] {
  return [
    { id: 'wall_n', x: 0, y: height / 2, z: -halfD - 0.5, w: halfW * 2 + 2, h: height, d: 1, material: 'concrete' },
    { id: 'wall_s', x: 0, y: height / 2, z: halfD + 0.5, w: halfW * 2 + 2, h: height, d: 1, material: 'concrete' },
    { id: 'wall_w', x: -halfW - 0.5, y: height / 2, z: 0, w: 1, h: height, d: halfD * 2 + 2, material: 'concrete' },
    { id: 'wall_e', x: halfW + 0.5, y: height / 2, z: 0, w: 1, h: height, d: halfD * 2 + 2, material: 'concrete' },
  ];
}

export const MAPS: Record<string, MapData> = {
  foundry: {
    id: 'foundry',
    name: 'Foundry Yard',
    theme: 'industrial',
    bounds: { halfW: 26, halfD: 26 },
    skyHorizon: 0xbdd4ea,
    fogColor: 0xaec2d6,
    floorColor: 0x3b4452,
    blocks: [
      ...makePerimeterWalls(26, 26, 5.5),
      { id: 'c_plat', x: 0, y: 1.0, z: 0, w: 8, h: 2.0, d: 8, material: 'steel' },
      { id: 'c_ramp_n', x: 0, y: 0.5, z: -5.2, w: 4, h: 1.0, d: 2.4, material: 'hazard' },
      { id: 'c_ramp_s', x: 0, y: 0.5, z: 5.2, w: 4, h: 1.0, d: 2.4, material: 'hazard' },
      { id: 'nw_cont', x: -12, y: 1.6, z: -12, w: 7, h: 3.2, d: 3.2, material: 'container_blue' },
      { id: 'se_cont', x: 12, y: 1.6, z: 12, w: 7, h: 3.2, d: 3.2, material: 'container_red' },
      { id: 'ne_cont', x: 12, y: 1.6, z: -12, w: 3.2, h: 3.2, d: 7, material: 'container_red' },
      { id: 'sw_cont', x: -12, y: 1.6, z: 12, w: 3.2, h: 3.2, d: 7, material: 'container_blue' },
      { id: 'w_tower', x: -16.5, y: 2.5, z: 0, w: 3.0, h: 5.0, d: 4.5, material: 'concrete' },
      { id: 'e_tower', x: 16.5, y: 2.5, z: 0, w: 3.0, h: 5.0, d: 4.5, material: 'concrete' },
      { id: 'crate_nw', x: -6.5, y: 1.0, z: -7.5, w: 2.2, h: 2.0, d: 2.2, material: 'crate' },
      { id: 'crate_se', x: 6.5, y: 1.0, z: 7.5, w: 2.2, h: 2.0, d: 2.2, material: 'crate' },
      { id: 'crate_ne', x: 7.5, y: 1.0, z: -6.5, w: 2.2, h: 2.0, d: 2.2, material: 'crate' },
      { id: 'crate_sw', x: -7.5, y: 1.0, z: 6.5, w: 2.2, h: 2.0, d: 2.2, material: 'crate' },
      { id: 'haz_w', x: -7.5, y: 2.2, z: 0, w: 2.2, h: 4.4, d: 2.2, material: 'hazard' },
      { id: 'haz_e', x: 7.5, y: 2.2, z: 0, w: 2.2, h: 4.4, d: 2.2, material: 'hazard' },
      { id: 'n_bunker', x: 0, y: 1.1, z: -17, w: 6, h: 2.2, d: 2.4, material: 'steel' },
      { id: 's_bunker', x: 0, y: 1.1, z: 17, w: 6, h: 2.2, d: 2.4, material: 'steel' },
    ],
    spawns: [
      { x: -21, y: 0, z: -21, yaw: -Math.PI * 0.75, team: 'BLUE' },
      { x: 21, y: 0, z: 21, yaw: Math.PI * 0.25, team: 'RED' },
      { x: 21, y: 0, z: -21, yaw: Math.PI * 0.75, team: 'RED' },
      { x: -21, y: 0, z: 21, yaw: -Math.PI * 0.25, team: 'BLUE' },
      { x: -21, y: 0, z: -7, yaw: -Math.PI * 0.65, team: 'BLUE' },
      { x: 21, y: 0, z: 7, yaw: Math.PI * 0.35, team: 'RED' },
      { x: -7, y: 0, z: -21, yaw: Math.PI, team: 'BLUE' },
      { x: 7, y: 0, z: 21, yaw: 0, team: 'RED' },
    ],
  },
  skyline: {
    id: 'skyline',
    name: 'Skyline Blocks',
    theme: 'rooftop',
    bounds: { halfW: 26, halfD: 26 },
    skyHorizon: 0xcbdcf0,
    fogColor: 0xb7cadc,
    floorColor: 0x333c4a,
    blocks: [
      ...makePerimeterWalls(26, 26, 4.0),
      { id: 'sky_center', x: 0, y: 1.2, z: 0, w: 6.5, h: 2.4, d: 6.5, material: 'concrete' },
      { id: 'sky_step1', x: -5.0, y: 0.6, z: 0, w: 3.5, h: 1.2, d: 3.5, material: 'accent' },
      { id: 'sky_step2', x: 5.0, y: 0.6, z: 0, w: 3.5, h: 1.2, d: 3.5, material: 'accent' },
      { id: 'hvac_n1', x: -8, y: 1.4, z: -13, w: 5, h: 2.8, d: 4, material: 'steel' },
      { id: 'hvac_n2', x: 8, y: 1.4, z: -13, w: 5, h: 2.8, d: 4, material: 'steel' },
      { id: 'hvac_s1', x: -8, y: 1.4, z: 13, w: 5, h: 2.8, d: 4, material: 'steel' },
      { id: 'hvac_s2', x: 8, y: 1.4, z: 13, w: 5, h: 2.8, d: 4, material: 'steel' },
      { id: 'sky_w', x: -15, y: 2.0, z: -5, w: 3, h: 4.0, d: 6, material: 'concrete' },
      { id: 'sky_e', x: 15, y: 2.0, z: 5, w: 3, h: 4.0, d: 6, material: 'concrete' },
      { id: 'sky_crate1', x: -13, y: 0.9, z: 8, w: 2.4, h: 1.8, d: 2.4, material: 'crate' },
      { id: 'sky_crate2', x: 13, y: 0.9, z: -8, w: 2.4, h: 1.8, d: 2.4, material: 'crate' },
      { id: 'sky_haz1', x: 0, y: 1.6, z: -18, w: 4, h: 3.2, d: 2.2, material: 'hazard' },
      { id: 'sky_haz2', x: 0, y: 1.6, z: 18, w: 4, h: 3.2, d: 2.2, material: 'hazard' },
    ],
    spawns: [
      { x: -21, y: 0, z: -21, yaw: -Math.PI * 0.75, team: 'BLUE' },
      { x: 21, y: 0, z: 21, yaw: Math.PI * 0.25, team: 'RED' },
      { x: 21, y: 0, z: -21, yaw: Math.PI * 0.75, team: 'RED' },
      { x: -21, y: 0, z: 21, yaw: -Math.PI * 0.25, team: 'BLUE' },
      { x: -7, y: 0, z: -22, yaw: Math.PI, team: 'BLUE' },
      { x: 7, y: 0, z: 22, yaw: 0, team: 'RED' },
      { x: -21, y: 0, z: 8, yaw: -Math.PI * 0.5, team: 'BLUE' },
      { x: 21, y: 0, z: -8, yaw: Math.PI * 0.5, team: 'RED' },
    ],
  },
  depot: {
    id: 'depot',
    name: 'Container Depot',
    theme: 'depot',
    bounds: { halfW: 26, halfD: 26 },
    skyHorizon: 0xd8d3c8,
    fogColor: 0xc8c0b2,
    floorColor: 0x43464b,
    blocks: [
      ...makePerimeterWalls(26, 26, 5.5),
      { id: 'd_c1', x: -9, y: 1.7, z: -9, w: 8, h: 3.4, d: 3.4, material: 'container_blue' },
      { id: 'd_c2', x: 9, y: 1.7, z: 9, w: 8, h: 3.4, d: 3.4, material: 'container_red' },
      { id: 'd_c3', x: -9, y: 1.7, z: 9, w: 3.4, h: 3.4, d: 8, material: 'container_red' },
      { id: 'd_c4', x: 9, y: 1.7, z: -9, w: 3.4, h: 3.4, d: 8, material: 'container_blue' },
      { id: 'd_mid_b', x: 0, y: 1.7, z: 0, w: 3.6, h: 3.4, d: 8.5, material: 'steel' },
      { id: 'd_mid_t', x: 0, y: 4.9, z: 0, w: 3.6, h: 3.0, d: 5.0, material: 'hazard' },
      { id: 'd_cr1', x: -16, y: 1.0, z: 0, w: 3, h: 2.0, d: 3, material: 'crate' },
      { id: 'd_cr2', x: 16, y: 1.0, z: 0, w: 3, h: 2.0, d: 3, material: 'crate' },
      { id: 'd_cr3', x: 0, y: 1.0, z: -15, w: 4, h: 2.0, d: 2.5, material: 'crate' },
      { id: 'd_cr4', x: 0, y: 1.0, z: 15, w: 4, h: 2.0, d: 2.5, material: 'crate' },
    ],
    spawns: [
      { x: -21, y: 0, z: -21, yaw: -Math.PI * 0.75, team: 'BLUE' },
      { x: 21, y: 0, z: 21, yaw: Math.PI * 0.25, team: 'RED' },
      { x: 21, y: 0, z: -21, yaw: Math.PI * 0.75, team: 'RED' },
      { x: -21, y: 0, z: 21, yaw: -Math.PI * 0.25, team: 'BLUE' },
      { x: -21, y: 0, z: -7, yaw: -Math.PI * 0.65, team: 'BLUE' },
      { x: 21, y: 0, z: 7, yaw: Math.PI * 0.35, team: 'RED' },
      { x: -7, y: 0, z: -21, yaw: Math.PI, team: 'BLUE' },
      { x: 7, y: 0, z: 21, yaw: 0, team: 'RED' },
    ],
  },
  reactor: {
    id: 'reactor',
    name: 'Reactor Core',
    theme: 'reactor',
    bounds: { halfW: 28, halfD: 28 },
    skyHorizon: 0xb6d6e6,
    fogColor: 0x9fc0d4,
    floorColor: 0x2c3543,
    blocks: [
      ...makePerimeterWalls(28, 28, 6.0),
      // Central Reactor Core + 4 stepped access ramps
      { id: 'rc_core', x: 0, y: 1.4, z: 0, w: 6.4, h: 2.8, d: 6.4, material: 'steel' },
      { id: 'rc_spire', x: 0, y: 3.9, z: 0, w: 2.6, h: 2.2, d: 2.6, material: 'accent' },
      { id: 'rc_ramp_n', x: 0, y: 0.7, z: -4.8, w: 3.2, h: 1.4, d: 3.2, material: 'hazard' },
      { id: 'rc_ramp_s', x: 0, y: 0.7, z: 4.8, w: 3.2, h: 1.4, d: 3.2, material: 'hazard' },
      { id: 'rc_ramp_w', x: -4.8, y: 0.7, z: 0, w: 3.2, h: 1.4, d: 3.2, material: 'hazard' },
      { id: 'rc_ramp_e', x: 4.8, y: 0.7, z: 0, w: 3.2, h: 1.4, d: 3.2, material: 'hazard' },
      // Coolant containment baffles
      { id: 'rc_baf_nw', x: -12, y: 2.0, z: -12, w: 5.5, h: 4.0, d: 2.8, material: 'container_blue' },
      { id: 'rc_baf_ne', x: 12, y: 2.0, z: -12, w: 2.8, h: 4.0, d: 5.5, material: 'container_red' },
      { id: 'rc_baf_sw', x: -12, y: 2.0, z: 12, w: 2.8, h: 4.0, d: 5.5, material: 'container_blue' },
      { id: 'rc_baf_se', x: 12, y: 2.0, z: 12, w: 5.5, h: 4.0, d: 2.8, material: 'container_red' },
      // Sniper catwalk perches & flank crates
      { id: 'rc_perch_n', x: 0, y: 1.2, z: -18.5, w: 9, h: 2.4, d: 3.2, material: 'concrete' },
      { id: 'rc_perch_s', x: 0, y: 1.2, z: 18.5, w: 9, h: 2.4, d: 3.2, material: 'concrete' },
      { id: 'rc_cr_w', x: -16.5, y: 1.0, z: 0, w: 2.8, h: 2.0, d: 4.4, material: 'crate' },
      { id: 'rc_cr_e', x: 16.5, y: 1.0, z: 0, w: 2.8, h: 2.0, d: 4.4, material: 'crate' },
    ],
    spawns: [
      { x: -23, y: 0, z: -23, yaw: -Math.PI * 0.75, team: 'BLUE' },
      { x: 23, y: 0, z: 23, yaw: Math.PI * 0.25, team: 'RED' },
      { x: 23, y: 0, z: -23, yaw: Math.PI * 0.75, team: 'RED' },
      { x: -23, y: 0, z: 23, yaw: -Math.PI * 0.25, team: 'BLUE' },
      { x: -23, y: 0, z: -6, yaw: -Math.PI * 0.5, team: 'BLUE' },
      { x: 23, y: 0, z: 6, yaw: Math.PI * 0.5, team: 'RED' },
      { x: -10, y: 0, z: -23, yaw: Math.PI, team: 'BLUE' },
      { x: 10, y: 0, z: 23, yaw: 0, team: 'RED' },
    ],
  },
  citadel: {
    id: 'citadel',
    name: 'Sandstone Citadel',
    theme: 'citadel',
    bounds: { halfW: 30, halfD: 24 },
    skyHorizon: 0xf1dec2,
    fogColor: 0xe3cba9,
    floorColor: 0x6b5c49,
    blocks: [
      ...makePerimeterWalls(30, 24, 5.5),
      // Courtyard monument & flanking steps
      { id: 'cit_mon', x: 0, y: 1.5, z: 0, w: 5.5, h: 3.0, d: 5.5, material: 'concrete' },
      { id: 'cit_cap', x: 0, y: 3.6, z: 0, w: 3.0, h: 1.2, d: 3.0, material: 'accent' },
      { id: 'cit_st_w', x: -4.2, y: 0.6, z: 0, w: 2.8, h: 1.2, d: 4.0, material: 'crate' },
      { id: 'cit_st_e', x: 4.2, y: 0.6, z: 0, w: 2.8, h: 1.2, d: 4.0, material: 'crate' },
      // West & East battlements
      { id: 'cit_bat_w1', x: -18, y: 1.8, z: -9, w: 3.2, h: 3.6, d: 7.0, material: 'container_blue' },
      { id: 'cit_bat_w2', x: -18, y: 1.8, z: 9, w: 3.2, h: 3.6, d: 7.0, material: 'container_blue' },
      { id: 'cit_bat_e1', x: 18, y: 1.8, z: -9, w: 3.2, h: 3.6, d: 7.0, material: 'container_red' },
      { id: 'cit_bat_e2', x: 18, y: 1.8, z: 9, w: 3.2, h: 3.6, d: 7.0, material: 'container_red' },
      // Mid-lane tactical cover
      { id: 'cit_cr1', x: -9.5, y: 1.1, z: -11, w: 3.6, h: 2.2, d: 2.6, material: 'crate' },
      { id: 'cit_cr2', x: 9.5, y: 1.1, z: -11, w: 3.6, h: 2.2, d: 2.6, material: 'crate' },
      { id: 'cit_cr3', x: -9.5, y: 1.1, z: 11, w: 3.6, h: 2.2, d: 2.6, material: 'crate' },
      { id: 'cit_cr4', x: 9.5, y: 1.1, z: 11, w: 3.6, h: 2.2, d: 2.6, material: 'crate' },
      { id: 'cit_haz_n', x: 0, y: 1.5, z: -14.5, w: 4.5, h: 3.0, d: 2.2, material: 'hazard' },
      { id: 'cit_haz_s', x: 0, y: 1.5, z: 14.5, w: 4.5, h: 3.0, d: 2.2, material: 'hazard' },
    ],
    spawns: [
      { x: -25, y: 0, z: -19, yaw: -Math.PI * 0.7, team: 'BLUE' },
      { x: 25, y: 0, z: 19, yaw: Math.PI * 0.3, team: 'RED' },
      { x: -25, y: 0, z: 19, yaw: -Math.PI * 0.3, team: 'BLUE' },
      { x: 25, y: 0, z: -19, yaw: Math.PI * 0.7, team: 'RED' },
      { x: -25, y: 0, z: 0, yaw: -Math.PI * 0.5, team: 'BLUE' },
      { x: 25, y: 0, z: 0, yaw: Math.PI * 0.5, team: 'RED' },
      { x: -8, y: 0, z: -19, yaw: Math.PI, team: 'BLUE' },
      { x: 8, y: 0, z: 19, yaw: 0, team: 'RED' },
    ],
  },
  neon_grid: {
    id: 'neon_grid',
    name: 'Cyber Spire',
    theme: 'cyber',
    bounds: { halfW: 32, halfD: 32 },
    skyHorizon: 0xa6c1e2,
    fogColor: 0x90aecf,
    floorColor: 0x252d3d,
    blocks: [
      ...makePerimeterWalls(32, 32, 6.0),
      // Multi-tier central cyber spire for 18-player mayhem
      { id: 'ng_base', x: 0, y: 0.9, z: 0, w: 10, h: 1.8, d: 10, material: 'steel' },
      { id: 'ng_mid', x: 0, y: 2.7, z: 0, w: 5.5, h: 1.8, d: 5.5, material: 'accent' },
      { id: 'ng_ramp_n', x: 0, y: 0.5, z: -6.5, w: 4.0, h: 1.0, d: 3.0, material: 'hazard' },
      { id: 'ng_ramp_s', x: 0, y: 0.5, z: 6.5, w: 4.0, h: 1.0, d: 3.0, material: 'hazard' },
      // 4 Quadrant Bastions
      { id: 'ng_q1', x: -16, y: 1.9, z: -16, w: 6.5, h: 3.8, d: 4.5, material: 'container_blue' },
      { id: 'ng_q2', x: 16, y: 1.9, z: 16, w: 6.5, h: 3.8, d: 4.5, material: 'container_red' },
      { id: 'ng_q3', x: -16, y: 1.9, z: 16, w: 4.5, h: 3.8, d: 6.5, material: 'container_blue' },
      { id: 'ng_q4', x: 16, y: 1.9, z: -16, w: 4.5, h: 3.8, d: 6.5, material: 'container_red' },
      // Mid-lane slide-peek pillars & crates
      { id: 'ng_p_w', x: -13, y: 2.2, z: 0, w: 3.2, h: 4.4, d: 4.0, material: 'concrete' },
      { id: 'ng_p_e', x: 13, y: 2.2, z: 0, w: 3.2, h: 4.4, d: 4.0, material: 'concrete' },
      { id: 'ng_p_n', x: 0, y: 1.5, z: -19, w: 7.0, h: 3.0, d: 2.6, material: 'steel' },
      { id: 'ng_p_s', x: 0, y: 1.5, z: 19, w: 7.0, h: 3.0, d: 2.6, material: 'steel' },
      { id: 'ng_cr1', x: -22, y: 1.0, z: -7, w: 2.6, h: 2.0, d: 2.6, material: 'crate' },
      { id: 'ng_cr2', x: 22, y: 1.0, z: 7, w: 2.6, h: 2.0, d: 2.6, material: 'crate' },
      { id: 'ng_cr3', x: -7, y: 1.0, z: 22, w: 2.6, h: 2.0, d: 2.6, material: 'crate' },
      { id: 'ng_cr4', x: 7, y: 1.0, z: -22, w: 2.6, h: 2.0, d: 2.6, material: 'crate' },
    ],
    spawns: [
      { x: -27, y: 0, z: -27, yaw: -Math.PI * 0.75, team: 'BLUE' },
      { x: 27, y: 0, z: 27, yaw: Math.PI * 0.25, team: 'RED' },
      { x: 27, y: 0, z: -27, yaw: Math.PI * 0.75, team: 'RED' },
      { x: -27, y: 0, z: 27, yaw: -Math.PI * 0.25, team: 'BLUE' },
      { x: -27, y: 0, z: 0, yaw: -Math.PI * 0.5, team: 'BLUE' },
      { x: 27, y: 0, z: 0, yaw: Math.PI * 0.5, team: 'RED' },
      { x: 0, y: 0, z: -27, yaw: Math.PI, team: 'BLUE' },
      { x: 0, y: 0, z: 27, yaw: 0, team: 'RED' },
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Authoring helpers for the v2 maps
// ─────────────────────────────────────────────────────────────────────────────
type Mat = MapBlock['material'];

/** Block standing on the floor (or on `baseY`) – x/z are the centre, `h` the height. */
function box(id: string, x: number, z: number, w: number, d: number, h: number, material: Mat = 'concrete', baseY = 0): MapBlock {
  return { id, x, y: baseY + h / 2, z, w, h, d, material };
}

/** Thin raised walkway whose TOP surface is at `top`. */
function deck(id: string, x: number, z: number, w: number, d: number, top: number, material: Mat = 'steel', thick = 0.3): MapBlock {
  return { id, x, y: top - thick / 2, z, w, h: thick, d, material };
}

/**
 * Staircase of solid steps. Starts at (x, z) with the LOWEST step and climbs toward (dx, dz).
 * Each step is `run` long and `width` wide; `tops` are the top heights, lowest first.
 * Rises stay <= 1.2 m so every step can be reached with a normal jump.
 */
function stairs(id: string, x: number, z: number, dx: number, dz: number, width: number, tops: number[], run = 1.6, material: Mat = 'crate'): MapBlock[] {
  return tops.map((top, i) => {
    const cx = x + dx * run * i;
    const cz = z + dz * run * i;
    const alongX = dx !== 0;
    return box(`${id}_${i + 1}`, cx, cz, alongX ? run : width, alongX ? width : run, top, material);
  });
}

/** Point-mirror (180° rotation) – guarantees both teams get an identical layout. */
function mirror(blocks: MapBlock[]): MapBlock[] {
  return blocks.map((b) => ({ ...b, id: `${b.id}_m`, x: -b.x, z: -b.z }));
}

function spawnAt(x: number, z: number, team: 'RED' | 'BLUE'): SpawnPoint {
  // Face the arena centre
  return { x, y: 0, z, yaw: Math.atan2(x, z), team };
}

function mirrorSpawns(list: SpawnPoint[]): SpawnPoint[] {
  return list.map((s) => spawnAt(-s.x, -s.z, s.team === 'BLUE' ? 'RED' : 'BLUE'));
}

// ─────────────────────────────────────────────────────────────────────────────
// v2 upgrades for the six original arenas: climbable towers, elevated walkways, extra cover
// ─────────────────────────────────────────────────────────────────────────────
MAPS.foundry.blocks.push(
  // Staircases up both towers + a bridge across the whole yard
  ...stairs('f_w_st', -16.5, 6.0, 0, -1, 3, [1.0, 2.0, 3.5]),
  ...stairs('f_e_st', 16.5, -6.0, 0, 1, 3, [1.0, 2.0, 3.5]),
  deck('f_bridge', 0, 0, 30, 2.2, 5.0, 'steel'),
  // Low cover near the spawn corners
  box('f_low_nw', -20, -14, 1.2, 4, 1.4, 'crate'),
  box('f_low_se', 20, 14, 1.2, 4, 1.4, 'crate'),
  box('f_low_ne', 20, -14, 1.2, 4, 1.4, 'crate'),
  box('f_low_sw', -20, 14, 1.2, 4, 1.4, 'crate'),
);

MAPS.skyline.blocks.push(
  ...stairs('sky_w_st', -15, -12.6, 0, 1, 3, [1.0, 2.0, 3.0]),
  ...stairs('sky_e_st', 15, 12.6, 0, -1, 3, [1.0, 2.0, 3.0]),
  box('sky_vent_1', -3, -9, 2.2, 1.6, 1.2, 'steel'),
  box('sky_vent_2', 3, 9, 2.2, 1.6, 1.2, 'steel'),
  box('sky_vent_3', 3, -9, 2.2, 1.6, 1.2, 'steel'),
  box('sky_vent_4', -3, 9, 2.2, 1.6, 1.2, 'steel'),
);

MAPS.depot.blocks.push(
  // Stairs onto the central stack from both sides, plus steps up to the top perch
  ...stairs('d_st_e', 6.2, 0, -1, 0, 3, [1.0, 2.0, 3.0]),
  ...stairs('d_st_w', -6.2, 0, 1, 0, 3, [1.0, 2.0, 3.0]),
  box('d_perch_step_s', 0, 3.4, 1.6, 1.6, 1.2, 'crate', 3.4),
  box('d_perch_step_n', 0, -3.4, 1.6, 1.6, 1.2, 'crate', 3.4),
  box('d_pal_1', -5, 16, 2.4, 2.4, 1.2, 'crate'),
  box('d_pal_2', 5, -16, 2.4, 2.4, 1.2, 'crate'),
  box('d_pal_3', 13, -3, 2.0, 5, 1.2, 'steel'),
  box('d_pal_4', -13, 3, 2.0, 5, 1.2, 'steel'),
);

MAPS.reactor.blocks.push(
  // Coolant-bridge catwalks between the baffles (top 4.0) with stairs up
  deck('rc_cat_n', 0.675, -12, 19.85, 2.0, 4.0, 'steel'),
  deck('rc_cat_s', -0.675, 12, 19.85, 2.0, 4.0, 'steel'),
  ...stairs('rc_st_nw', -12, -6.2, 0, -1, 3, [1.0, 2.0, 3.0]),
  ...stairs('rc_st_ne', 12, -6.2, 0, -1, 3, [1.0, 2.0, 3.0]),
  ...stairs('rc_st_sw', -12, 6.2, 0, 1, 3, [1.0, 2.0, 3.0]),
  ...stairs('rc_st_se', 12, 6.2, 0, 1, 3, [1.0, 2.0, 3.0]),
);

MAPS.citadel.blocks.push(
  // Rampart walkways joining the battlements, with stairs from the courtyard
  deck('cit_walk_w', -18, 0, 3.2, 11, 3.6, 'concrete'),
  deck('cit_walk_e', 18, 0, 3.2, 11, 3.6, 'concrete'),
  ...stairs('cit_st_w', -12.0, -7.5, -1, 0, 2, [1.0, 2.0, 3.0]),
  ...stairs('cit_st_e', 12.0, 7.5, 1, 0, 2, [1.0, 2.0, 3.0]),
  box('cit_pil_1', -5, -16, 1.6, 1.6, 3.2, 'accent'),
  box('cit_pil_2', 5, 16, 1.6, 1.6, 3.2, 'accent'),
  box('cit_pil_3', 5, -16, 1.6, 1.6, 3.2, 'accent'),
  box('cit_pil_4', -5, 16, 1.6, 1.6, 3.2, 'accent'),
);

MAPS.neon_grid.blocks.push(
  // Staircases up every bastion and two long elevated lanes
  ...stairs('ng_st_q1', -8.4, -16, -1, 0, 3, [1.0, 2.0, 3.0]),
  ...stairs('ng_st_q2', 8.4, 16, 1, 0, 3, [1.0, 2.0, 3.0]),
  ...stairs('ng_st_q3', -9.4, 16, -1, 0, 3, [1.0, 2.0, 3.0]),
  ...stairs('ng_st_q4', 9.4, -16, 1, 0, 3, [1.0, 2.0, 3.0]),
  deck('ng_lane_w', -16, 0, 2, 26.5, 3.8, 'accent'),
  deck('ng_lane_e', 16, 0.5, 2, 26.5, 3.8, 'accent'),
);

/** Turns each spawn toward the most open direction (for tight layouts such as the labyrinth). */
function faceOpenSpace(spawns: SpawnPoint[], blocks: MapBlock[]): SpawnPoint[] {
  return spawns.map((sp) => {
    let bestYaw = sp.yaw;
    let bestDist = -1;
    for (let k = 0; k < 16; k++) {
      const yaw = (k / 16) * Math.PI * 2;
      const hit = raycastMap({ x: sp.x, y: 1.56, z: sp.z }, getAimDirection(yaw, 0), 30, blocks);
      const dist = hit ? hit.distance : 30;
      // Prefer long sightlines, break ties toward the arena centre
      const towardCentre = Math.abs(Math.atan2(Math.sin(yaw - sp.yaw), Math.cos(yaw - sp.yaw)));
      const score = dist - towardCentre * 0.5;
      if (score > bestDist) {
        bestDist = score;
        bestYaw = yaw;
      }
    }
    return { ...sp, yaw: bestYaw };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Six brand-new arenas
// ─────────────────────────────────────────────────────────────────────────────
const warehouseHalf: [number, number] = [30, 20];
const warehouseHalfBlocks: MapBlock[] = [
  box('wh_shelf_a', -14, -12, 14, 1.6, 2.6, 'steel'),
  box('wh_shelf_c', -14, 12, 14, 1.6, 2.6, 'steel'),
  box('wh_pal_1', -2.5, -6, 2.4, 2.4, 2.4, 'crate'),
  box('wh_pillar_1', -22, 0, 1.6, 1.6, 7, 'concrete'),
  box('wh_pillar_2', -7, 0, 1.6, 1.6, 7, 'concrete'),
  deck('wh_mezz_n', 0, -17.5, 16, 4, 3.6, 'steel', 0.4),
  ...stairs('wh_st_n', 12.0, -17.5, -1, 0, 3, [1.0, 2.0, 3.0]),
];

MAPS.warehouse = {
  id: 'warehouse',
  name: 'Midnight Warehouse',
  theme: 'warehouse',
  bounds: { halfW: warehouseHalf[0], halfD: warehouseHalf[1] },
  skyHorizon: 0x453b5c,
  fogColor: 0x373049,
  floorColor: 0x2a2d35,
  blocks: [
    ...makePerimeterWalls(warehouseHalf[0], warehouseHalf[1], 7.0),
    ...warehouseHalfBlocks,
    ...mirror(warehouseHalfBlocks),
    box('wh_cargo', 0, 0, 4.4, 4.4, 1.2, 'hazard'),
  ],
  spawns: [
    spawnAt(-26, -15, 'BLUE'),
    spawnAt(-26, -5, 'BLUE'),
    spawnAt(-26, 5, 'BLUE'),
    spawnAt(-26, 15, 'BLUE'),
    ...mirrorSpawns([spawnAt(-26, -15, 'BLUE'), spawnAt(-26, -5, 'BLUE'), spawnAt(-26, 5, 'BLUE'), spawnAt(-26, 15, 'BLUE')]),
  ],
};

const canyonHalf: MapBlock[] = [
  box('cy_rock_nw', -20, -12, 10, 8, 5, 'concrete'),
  box('cy_rock_ne', 20, -14, 8, 6, 4, 'concrete'),
  box('cy_mesa', 0, 0, 12, 8, 3.2, 'crate'),
  ...stairs('cy_st_w', -8.4, 0, 1, 0, 3.5, [1.0, 2.0]),
  box('cy_spire_1', -8, -14, 2.4, 2.4, 6, 'concrete'),
  box('cy_spire_2', 8, -14, 2.4, 2.4, 6, 'concrete'),
  box('cy_boulder', -13, 4, 3.5, 3, 1.8, 'crate'),
];
MAPS.canyon = {
  id: 'canyon',
  name: 'Dune Canyon',
  theme: 'canyon',
  bounds: { halfW: 34, halfD: 24 },
  skyHorizon: 0xf2c9a0,
  fogColor: 0xdfb98f,
  floorColor: 0x8a6a45,
  blocks: [
    ...makePerimeterWalls(34, 24, 8.0),
    // Mesa is its own mirror, so only add the non-central pieces to the mirrored set
    ...canyonHalf.filter((b) => b.id !== 'cy_mesa' && !b.id.startsWith('cy_st_w')),
    ...mirror(canyonHalf.filter((b) => b.id !== 'cy_mesa' && !b.id.startsWith('cy_st_w'))),
    canyonHalf.find((b) => b.id === 'cy_mesa')!,
    ...canyonHalf.filter((b) => b.id.startsWith('cy_st_w')),
    ...mirror(canyonHalf.filter((b) => b.id.startsWith('cy_st_w'))),
  ],
  spawns: [
    spawnAt(-30, -18, 'BLUE'),
    spawnAt(-30, -6, 'BLUE'),
    spawnAt(-30, 6, 'BLUE'),
    spawnAt(-30, 18, 'BLUE'),
    ...mirrorSpawns([spawnAt(-30, -18, 'BLUE'), spawnAt(-30, -6, 'BLUE'), spawnAt(-30, 6, 'BLUE'), spawnAt(-30, 18, 'BLUE')]),
  ],
};

const harborHalf: MapBlock[] = [
  box('hb_n1', -20, -11, 8, 3.4, 3.4, 'container_blue'),
  box('hb_n2', -6, -11, 8, 3.4, 3.4, 'container_red'),
  box('hb_n2_top', -6, -11, 8, 3.4, 3.4, 'container_blue', 3.4),
  box('hb_n3', 8, -11, 8, 3.4, 3.4, 'container_blue'),
  box('hb_n4', 22, -11, 8, 3.4, 3.4, 'container_red'),
  ...stairs('hb_st', -6, -4.9, 0, -1, 3, [1.0, 2.0, 3.0]),
  box('hb_low', 10, 0, 2, 6, 1.2, 'steel'),
];
MAPS.harbor = {
  id: 'harbor',
  name: 'Dockside Harbor',
  theme: 'harbor',
  bounds: { halfW: 32, halfD: 22 },
  skyHorizon: 0x9fb9cf,
  fogColor: 0x8aa6bd,
  floorColor: 0x3a4048,
  blocks: [
    ...makePerimeterWalls(32, 22, 5.0),
    ...harborHalf,
    ...mirror(harborHalf),
    box('hb_crane_w', -26, 0, 3, 3, 8, 'steel'),
    box('hb_crane_e', 26, 0, 3, 3, 8, 'steel'),
    box('hb_mid', 0, 0, 3, 3, 2, 'crate'),
  ],
  spawns: [
    spawnAt(-28, -16, 'BLUE'),
    spawnAt(-28, -6, 'BLUE'),
    spawnAt(-28, 6, 'BLUE'),
    spawnAt(-28, 16, 'BLUE'),
    ...mirrorSpawns([spawnAt(-28, -16, 'BLUE'), spawnAt(-28, -6, 'BLUE'), spawnAt(-28, 6, 'BLUE'), spawnAt(-28, 16, 'BLUE')]),
  ],
};

const arcticCorner = (sx: number, sz: number): MapBlock[] => {
  const tag = `${sx > 0 ? 'e' : 'w'}${sz > 0 ? 's' : 'n'}`;
  return [
    box(`ar_tw_${tag}`, sx * 18, sz * 18, 4, 4, 5.5, 'concrete'),
    ...[15.1, 13.7, 12.3, 10.9].map((cx, i) => box(`ar_tw_st_${tag}_${i + 1}`, sx * cx, sz * 18, 1.4, 3, 4 - i, 'crate')),
    box(`ar_mound_${tag}`, sx * 10, sz * 10, 5, 3, 1.0, 'crate'),
  ];
};
MAPS.arctic = {
  id: 'arctic',
  name: 'Frostbite Outpost',
  theme: 'arctic',
  bounds: { halfW: 30, halfD: 30 },
  skyHorizon: 0xdce9f5,
  fogColor: 0xcfdeea,
  floorColor: 0xb9c6d3,
  blocks: [
    ...makePerimeterWalls(30, 30, 4.5),
    ...arcticCorner(-1, -1),
    ...arcticCorner(1, -1),
    ...arcticCorner(-1, 1),
    ...arcticCorner(1, 1),
    // Central bunker ring with four doorways
    box('ar_bk_n1', -3.5, -5, 5, 1, 3, 'steel'),
    box('ar_bk_n2', 3.5, -5, 5, 1, 3, 'steel'),
    box('ar_bk_s1', -3.5, 5, 5, 1, 3, 'steel'),
    box('ar_bk_s2', 3.5, 5, 5, 1, 3, 'steel'),
    box('ar_bk_w1', -5, -3.5, 1, 5, 3, 'steel'),
    box('ar_bk_w2', -5, 3.5, 1, 5, 3, 'steel'),
    box('ar_bk_e1', 5, -3.5, 1, 5, 3, 'steel'),
    box('ar_bk_e2', 5, 3.5, 1, 5, 3, 'steel'),
    box('ar_bk_core', 0, 0, 2.4, 2.4, 1.4, 'crate'),
    box('ar_ridge_n', 0, -14, 8, 2.4, 1.4, 'crate'),
    box('ar_ridge_s', 0, 14, 8, 2.4, 1.4, 'crate'),
  ],
  spawns: [
    spawnAt(-26, -16, 'BLUE'),
    spawnAt(-26, -6, 'BLUE'),
    spawnAt(-26, 6, 'BLUE'),
    spawnAt(-26, 16, 'BLUE'),
    ...mirrorSpawns([spawnAt(-26, -16, 'BLUE'), spawnAt(-26, -6, 'BLUE'), spawnAt(-26, 6, 'BLUE'), spawnAt(-26, 16, 'BLUE')]),
  ],
};

const colosseumPillars: MapBlock[] = [];
for (let k = 0; k < 8; k++) {
  const a = (k / 8) * Math.PI * 2;
  colosseumPillars.push(box(`co_pillar_${k}`, Math.round(Math.cos(a) * 14 * 10) / 10, Math.round(Math.sin(a) * 14 * 10) / 10, 2.6, 2.6, 5, 'concrete'));
}
MAPS.colosseum = {
  id: 'colosseum',
  name: 'Obsidian Colosseum',
  theme: 'colosseum',
  bounds: { halfW: 28, halfD: 28 },
  skyHorizon: 0xe0b79a,
  fogColor: 0xc9a08a,
  floorColor: 0x2b2b33,
  blocks: [
    ...makePerimeterWalls(28, 28, 6.0),
    ...colosseumPillars,
    box('co_dais', 0, 0, 10, 10, 1.0, 'accent'),
    box('co_dais_top', 0, 0, 5, 5, 2.2, 'steel'),
    box('co_mono_1', -19, -19, 2, 2, 4, 'hazard'),
    box('co_mono_2', 19, 19, 2, 2, 4, 'hazard'),
    box('co_mono_3', 19, -19, 2, 2, 4, 'hazard'),
    box('co_mono_4', -19, 19, 2, 2, 4, 'hazard'),
    box('co_stand_n', 0, -25.5, 40, 3, 1.0, 'concrete'),
    box('co_stand_s', 0, 25.5, 40, 3, 1.0, 'concrete'),
  ],
  spawns: [
    spawnAt(-23, -9, 'BLUE'),
    spawnAt(-23, 9, 'BLUE'),
    spawnAt(-23, 0, 'BLUE'),
    spawnAt(-14, -22, 'BLUE'),
    ...mirrorSpawns([spawnAt(-23, -9, 'BLUE'), spawnAt(-23, 9, 'BLUE'), spawnAt(-23, 0, 'BLUE'), spawnAt(-14, -22, 'BLUE')]),
  ],
};

const labyrinthHalf: MapBlock[] = [
  box('lab_a1', -10, -12, 10, 1, 3.2, 'concrete'),
  box('lab_a2', -5, -6.5, 1, 11, 3.2, 'accent'),
  box('lab_a3', -12, -4, 8, 1, 3.2, 'concrete'),
  box('lab_a4', 4, -14, 1, 9, 3.2, 'accent'),
  box('lab_a5', 10, -6, 9, 1, 3.2, 'concrete'),
  box('lab_a6', 15, -11, 1, 11, 3.2, 'accent'),
];
MAPS.labyrinth = {
  id: 'labyrinth',
  name: 'Neon Labyrinth',
  theme: 'maze',
  bounds: { halfW: 20, halfD: 20 },
  skyHorizon: 0x9fb4d8,
  fogColor: 0x8497b9,
  floorColor: 0x232a3a,
  blocks: [
    ...makePerimeterWalls(20, 20, 4.5),
    ...labyrinthHalf,
    ...mirror(labyrinthHalf),
    box('lab_core', 0, 0, 4, 4, 1.4, 'crate'),
  ],
  spawns: [
    spawnAt(-17, -17, 'BLUE'),
    spawnAt(-17, 17, 'BLUE'),
    spawnAt(-17, 0, 'BLUE'),
    spawnAt(-8, -17, 'BLUE'),
    ...mirrorSpawns([spawnAt(-17, -17, 'BLUE'), spawnAt(-17, 17, 'BLUE'), spawnAt(-17, 0, 'BLUE'), spawnAt(-8, -17, 'BLUE')]),
  ],
};
MAPS.labyrinth.spawns = faceOpenSpace(MAPS.labyrinth.spawns, MAPS.labyrinth.blocks);

export const MAP_LIST: MapData[] = [
  MAPS.foundry,
  MAPS.skyline,
  MAPS.depot,
  MAPS.reactor,
  MAPS.citadel,
  MAPS.neon_grid,
  MAPS.warehouse,
  MAPS.canyon,
  MAPS.harbor,
  MAPS.arctic,
  MAPS.colosseum,
  MAPS.labyrinth,
];

export function cloneCustomMap(blocks: MapBlock[], name = 'Custom Arena'): MapData {
  return {
    id: 'custom',
    name,
    theme: 'custom',
    bounds: { halfW: 24, halfD: 24 },
    skyHorizon: 0xbdd4ea,
    fogColor: 0xaec2d6,
    floorColor: 0x3b4452,
    blocks: [...makePerimeterWalls(24, 24, 5.0), ...blocks],
    spawns: [
      { x: -19.5, y: 0, z: -19.5, yaw: -Math.PI * 0.75, team: 'BLUE' },
      { x: 19.5, y: 0, z: 19.5, yaw: Math.PI * 0.25, team: 'RED' },
      { x: 19.5, y: 0, z: -19.5, yaw: Math.PI * 0.75, team: 'RED' },
      { x: -19.5, y: 0, z: 19.5, yaw: -Math.PI * 0.25, team: 'BLUE' },
    ],
  };
}
