import * as THREE from 'three';
import { CharacterStyle, Team, WeaponId } from './types';

export interface WeaponViewmodel {
  group: THREE.Group;
  muzzleFlash: THREE.Group;
  hipPos: [number, number, number];
  adsPos: [number, number, number];
  muzzleLocalPos: [number, number, number];
  setSleeveAccent: (hex: number) => void;
  dispose: () => void;
}

export function buildWeaponViewmodel(weaponId: WeaponId, sleeveAccentHex = 0x38bdf8): WeaponViewmodel {
  const group = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];

  const gunMetal = new THREE.MeshStandardMaterial({
    color: 0x1e2530,
    roughness: 0.25,
    metalness: 0.88,
  });
  const brushedSteel = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    roughness: 0.32,
    metalness: 0.82,
  });
  const mattePolymer = new THREE.MeshStandardMaterial({
    color: 0x2b3340,
    roughness: 0.78,
    metalness: 0.14,
  });
  const gripRubber = new THREE.MeshStandardMaterial({
    color: 0x141922,
    roughness: 0.9,
    metalness: 0.06,
  });
  const accentColor =
    weaponId === 'knife'
      ? 0xf43f5e
      : weaponId === 'sniper'
      ? 0x0ea5e9
      : weaponId === 'shotgun'
      ? 0xea580c
      : weaponId === 'smg'
      ? 0x10b981
      : weaponId === 'pistol'
      ? 0x94a3b8
      : 0xf59e0b;
  const hollowScopeMat = new THREE.MeshStandardMaterial({
    color: 0x1e2530,
    roughness: 0.25,
    metalness: 0.88,
    side: THREE.DoubleSide,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    roughness: 0.32,
    metalness: 0.58,
  });
  const opticGlass = new THREE.MeshStandardMaterial({
    color: 0xe0f2fe,
    emissive: 0x0284c7,
    emissiveIntensity: 0.06,
    roughness: 0.05,
    metalness: 0.05,
    transparent: true,
    opacity: 0.06,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const reticleDotMat = new THREE.MeshBasicMaterial({
    color: weaponId === 'smg' ? 0x34d399 : 0xf43f5e,
  });
  const laserEmitMat = new THREE.MeshBasicMaterial({
    color: 0x22d3ee,
  });
  const sleeveMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.72,
    metalness: 0.15,
  });
  const cuffAccentMat = new THREE.MeshStandardMaterial({
    color: sleeveAccentHex,
    emissive: sleeveAccentHex,
    emissiveIntensity: 0.25,
    roughness: 0.4,
    metalness: 0.45,
  });
  disposables.push(
    gunMetal,
    hollowScopeMat,
    brushedSteel,
    mattePolymer,
    gripRubber,
    accentMat,
    opticGlass,
    reticleDotMat,
    laserEmitMat,
    sleeveMat,
    cuffAccentMat,
  );

  const addPart = (
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    pos: [number, number, number],
    rot: [number, number, number] = [0, 0, 0],
  ) => {
    disposables.push(geo);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(...pos);
    mesh.rotation.set(...rot);
    group.add(mesh);
    return mesh;
  };

  let hipPos: [number, number, number] = [0.24, -0.22, -0.34];
  let adsPos: [number, number, number] = [0, -0.115, -0.24];
  let muzzleZ = -0.68;
  let muzzleY = 0.028;

  if (weaponId === 'rifle') {
    adsPos = [0, -0.118, -0.24];
    muzzleZ = -0.68;
    muzzleY = 0.028;

    // Lower & upper receiver + brushed bolt carrier
    addPart(new THREE.BoxGeometry(0.078, 0.095, 0.40), mattePolymer, [0, 0, 0.01]);
    addPart(new THREE.BoxGeometry(0.064, 0.042, 0.42), gunMetal, [0, 0.056, -0.01]);
    addPart(new THREE.BoxGeometry(0.014, 0.026, 0.10), brushedSteel, [0.036, 0.048, -0.03]); // Ejection port
    addPart(new THREE.BoxGeometry(0.036, 0.016, 0.055), brushedSteel, [-0.042, 0.062, 0.08]); // Charging handle

    // Picatinny rail spine + segmented rail notches
    addPart(new THREE.BoxGeometry(0.038, 0.016, 0.48), gunMetal, [0, 0.082, -0.09]);
    for (let i = 0; i < 6; i++) {
      addPart(new THREE.BoxGeometry(0.044, 0.008, 0.022), brushedSteel, [0, 0.092, 0.10 - i * 0.07]);
    }

    // Vented handguard + accent shroud + side laser module
    addPart(new THREE.BoxGeometry(0.072, 0.076, 0.25), accentMat, [0, 0.015, -0.26]);
    addPart(new THREE.BoxGeometry(0.076, 0.018, 0.22), gunMetal, [0, 0.042, -0.26]);
    addPart(new THREE.BoxGeometry(0.022, 0.026, 0.075), gunMetal, [0.045, 0.022, -0.28]);
    addPart(new THREE.CylinderGeometry(0.006, 0.006, 0.01, 6), laserEmitMat, [0.045, 0.022, -0.32], [Math.PI / 2, 0, 0]);

    // Heavy fluted barrel + muzzle brake
    addPart(new THREE.CylinderGeometry(0.016, 0.018, 0.48, 8), gunMetal, [0, 0.028, -0.40], [Math.PI / 2, 0, 0]);
    addPart(new THREE.CylinderGeometry(0.022, 0.020, 0.075, 8), brushedSteel, [0, 0.028, -0.64], [Math.PI / 2, 0, 0]);

    // Angled foregrip + curved mag + tactical stock
    addPart(new THREE.BoxGeometry(0.042, 0.075, 0.055), gripRubber, [0, -0.062, -0.25], [0.35, 0, 0]);
    addPart(new THREE.BoxGeometry(0.046, 0.18, 0.078), gunMetal, [0, -0.115, -0.06], [0.22, 0, 0]);
    addPart(new THREE.BoxGeometry(0.052, 0.13, 0.062), gripRubber, [0, -0.098, 0.13], [-0.26, 0, 0]);
    addPart(new THREE.BoxGeometry(0.052, 0.095, 0.18), mattePolymer, [0, -0.015, 0.28]);

    // Open Holographic Sight Housing + glowing dot reticle (centered at y=0.118)
    addPart(new THREE.BoxGeometry(0.054, 0.014, 0.09), gunMetal, [0, 0.096, 0.02]);
    addPart(new THREE.BoxGeometry(0.009, 0.042, 0.075), gunMetal, [-0.024, 0.118, 0.02]);
    addPart(new THREE.BoxGeometry(0.009, 0.042, 0.075), gunMetal, [0.024, 0.118, 0.02]);
    addPart(new THREE.BoxGeometry(0.057, 0.009, 0.075), gunMetal, [0, 0.141, 0.02]);
    addPart(new THREE.BoxGeometry(0.038, 0.032, 0.006), opticGlass, [0, 0.118, 0.005]);
    addPart(new THREE.SphereGeometry(0.0018, 6, 6), reticleDotMat, [0, 0.118, 0.008]);

    // First-person gloves/forearms
    addPart(new THREE.BoxGeometry(0.065, 0.075, 0.22), sleeveMat, [0.06, -0.14, 0.24], [0.22, 0.15, 0]);
    addPart(new THREE.BoxGeometry(0.058, 0.062, 0.075), cuffAccentMat, [0.01, -0.105, 0.13], [-0.25, 0, 0]);
    addPart(new THREE.BoxGeometry(0.062, 0.065, 0.22), sleeveMat, [-0.11, -0.12, -0.10], [0.16, -0.45, 0]);
  } else if (weaponId === 'smg') {
    adsPos = [0, -0.105, -0.22];
    muzzleZ = -0.46;
    muzzleY = 0.018;

    // Compact tactical upper + polymer lower
    addPart(new THREE.BoxGeometry(0.072, 0.09, 0.32), mattePolymer, [0, 0, 0]);
    addPart(new THREE.BoxGeometry(0.062, 0.038, 0.30), accentMat, [0, 0.056, -0.02]);
    addPart(new THREE.BoxGeometry(0.036, 0.014, 0.24), gunMetal, [0, 0.078, -0.02]);
    addPart(new THREE.BoxGeometry(0.012, 0.02, 0.065), brushedSteel, [0.034, 0.048, -0.04]);

    // Suppressor / integrated barrel shroud
    addPart(new THREE.CylinderGeometry(0.024, 0.024, 0.25, 10), gunMetal, [0, 0.018, -0.27], [Math.PI / 2, 0, 0]);
    addPart(new THREE.CylinderGeometry(0.026, 0.026, 0.03, 10), brushedSteel, [0, 0.018, -0.39], [Math.PI / 2, 0, 0]);

    // Extended stick mag + angled grip + folding stock
    addPart(new THREE.BoxGeometry(0.040, 0.21, 0.048), gunMetal, [0, -0.12, -0.09], [0.14, 0, 0]);
    addPart(new THREE.BoxGeometry(0.048, 0.12, 0.056), gripRubber, [0, -0.095, 0.09], [-0.22, 0, 0]);
    addPart(new THREE.BoxGeometry(0.036, 0.065, 0.16), gunMetal, [0, 0.005, 0.22]);

    // Hollow open-through Reflex Sight Housing (centered at y=0.105 so enemies stay clearly visible)
    addPart(new THREE.BoxGeometry(0.022, 0.014, 0.036), gunMetal, [0, 0.082, 0.01]);
    addPart(new THREE.CylinderGeometry(0.025, 0.025, 0.052, 20, 1, true), hollowScopeMat, [0, 0.105, 0.01], [Math.PI / 2, 0, 0]);
    addPart(new THREE.TorusGeometry(0.025, 0.0032, 8, 20), gunMetal, [0, 0.105, 0.036]);
    addPart(new THREE.TorusGeometry(0.025, 0.0032, 8, 20), gunMetal, [0, 0.105, -0.016]);
    addPart(new THREE.CircleGeometry(0.021, 18), opticGlass, [0, 0.105, 0.008]);
    addPart(new THREE.SphereGeometry(0.0014, 6, 6), reticleDotMat, [0, 0.105, 0.009]);

    addPart(new THREE.BoxGeometry(0.06, 0.07, 0.20), sleeveMat, [0.055, -0.135, 0.19], [0.22, 0.14, 0]);
    addPart(new THREE.BoxGeometry(0.054, 0.058, 0.068), cuffAccentMat, [0.005, -0.10, 0.09], [-0.22, 0, 0]);
    addPart(new THREE.BoxGeometry(0.058, 0.06, 0.19), sleeveMat, [-0.095, -0.115, -0.09], [0.18, -0.42, 0]);
  } else if (weaponId === 'shotgun') {
    adsPos = [0, -0.085, -0.24];
    muzzleZ = -0.68;
    muzzleY = 0.034;

    // Heavy machined receiver + heat-shield + twin barrels
    addPart(new THREE.BoxGeometry(0.088, 0.105, 0.42), gunMetal, [0, 0, 0.02]);
    addPart(new THREE.BoxGeometry(0.016, 0.024, 0.09), brushedSteel, [0.042, 0.022, -0.04]); // Loading port
    addPart(new THREE.CylinderGeometry(0.022, 0.022, 0.56, 8), gunMetal, [0, 0.034, -0.37], [Math.PI / 2, 0, 0]);
    addPart(new THREE.BoxGeometry(0.048, 0.016, 0.42), brushedSteel, [0, 0.055, -0.33]); // Ribbed sight rail
    addPart(new THREE.CylinderGeometry(0.018, 0.018, 0.48, 8), mattePolymer, [0, -0.015, -0.33], [Math.PI / 2, 0, 0]);

    // Ribbed orange pump handle + stock + side shell saddle
    addPart(new THREE.BoxGeometry(0.084, 0.068, 0.21), accentMat, [0, -0.022, -0.25]);
    for (let i = 0; i < 4; i++) {
      addPart(new THREE.BoxGeometry(0.088, 0.014, 0.022), gripRubber, [0, -0.025, -0.18 - i * 0.045]);
    }
    addPart(new THREE.BoxGeometry(0.058, 0.135, 0.072), gripRubber, [0, -0.095, 0.16], [-0.32, 0, 0]);
    addPart(new THREE.BoxGeometry(0.058, 0.10, 0.20), mattePolymer, [0, -0.02, 0.30]);

    // Ghost-ring iron sights (centered at y=0.085)
    addPart(new THREE.BoxGeometry(0.012, 0.028, 0.022), gunMetal, [-0.016, 0.080, 0.08]);
    addPart(new THREE.BoxGeometry(0.012, 0.028, 0.022), gunMetal, [0.016, 0.080, 0.08]);
    addPart(new THREE.SphereGeometry(0.004, 6, 6), reticleDotMat, [0, 0.082, -0.58]);

    addPart(new THREE.BoxGeometry(0.068, 0.074, 0.22), sleeveMat, [0.06, -0.135, 0.25], [0.24, 0.12, 0]);
    addPart(new THREE.BoxGeometry(0.06, 0.062, 0.072), cuffAccentMat, [0.008, -0.10, 0.15], [-0.3, 0, 0]);
    addPart(new THREE.BoxGeometry(0.064, 0.064, 0.22), sleeveMat, [-0.11, -0.11, -0.11], [0.16, -0.46, 0]);
  } else if (weaponId === 'sniper') {
    hipPos = [0.25, -0.22, -0.35];
    adsPos = [0, -0.118, -0.22];
    muzzleZ = -0.95;
    muzzleY = 0.028;

    // Precision railgun chassis + glowing accelerator coils
    addPart(new THREE.BoxGeometry(0.078, 0.10, 0.54), mattePolymer, [0, 0, 0.04]);
    addPart(new THREE.BoxGeometry(0.062, 0.045, 0.50), gunMetal, [0, 0.056, 0.02]);
    addPart(new THREE.BoxGeometry(0.066, 0.052, 0.38), accentMat, [0, 0.025, -0.34]);
    for (let i = 0; i < 4; i++) {
      addPart(new THREE.BoxGeometry(0.072, 0.024, 0.025), opticGlass, [0, 0.028, -0.22 - i * 0.08]);
    }
    addPart(new THREE.CylinderGeometry(0.016, 0.022, 0.74, 8), gunMetal, [0, 0.028, -0.54], [Math.PI / 2, 0, 0]);
    addPart(new THREE.BoxGeometry(0.046, 0.048, 0.09), brushedSteel, [0, 0.028, -0.90]); // Muzzle brake

    // Bipod folded + ergonomic grip + precision cheek-rest stock
    addPart(new THREE.CylinderGeometry(0.01, 0.01, 0.20, 6), gunMetal, [-0.042, -0.02, -0.45], [Math.PI / 2, 0, 0]);
    addPart(new THREE.CylinderGeometry(0.01, 0.01, 0.20, 6), gunMetal, [0.042, -0.02, -0.45], [Math.PI / 2, 0, 0]);
    addPart(new THREE.BoxGeometry(0.048, 0.125, 0.065), gripRubber, [0, -0.095, 0.14], [-0.24, 0, 0]);
    addPart(new THREE.BoxGeometry(0.05, 0.095, 0.22), mattePolymer, [0, -0.01, 0.32]);

    // Variable 8x Optical Scope + scope rings + hollow sunshade (centered at y=0.118)
    addPart(new THREE.BoxGeometry(0.036, 0.032, 0.032), brushedSteel, [0, 0.092, 0.04]);
    addPart(new THREE.BoxGeometry(0.036, 0.032, 0.032), brushedSteel, [0, 0.092, -0.08]);
    addPart(new THREE.CylinderGeometry(0.028, 0.025, 0.30, 16, 1, true), hollowScopeMat, [0, 0.118, -0.02], [Math.PI / 2, 0, 0]);
    addPart(new THREE.CylinderGeometry(0.034, 0.028, 0.075, 16, 1, true), hollowScopeMat, [0, 0.118, -0.19], [Math.PI / 2, 0, 0]);
    addPart(new THREE.TorusGeometry(0.025, 0.003, 8, 18), gunMetal, [0, 0.118, 0.13]);
    addPart(new THREE.CircleGeometry(0.023, 18), opticGlass, [0, 0.118, 0.128]);

    addPart(new THREE.BoxGeometry(0.062, 0.072, 0.22), sleeveMat, [0.058, -0.135, 0.24], [0.22, 0.14, 0]);
    addPart(new THREE.BoxGeometry(0.056, 0.06, 0.07), cuffAccentMat, [0.008, -0.10, 0.14], [-0.24, 0, 0]);
    addPart(new THREE.BoxGeometry(0.06, 0.062, 0.22), sleeveMat, [-0.11, -0.115, -0.14], [0.16, -0.42, 0]);
  } else if (weaponId === 'knife') {
    hipPos = [0.22, -0.18, -0.35];
    adsPos = [0.12, -0.14, -0.28];
    muzzleZ = -0.38;
    muzzleY = 0.06;

    const knifeGroup = new THREE.Group();
    knifeGroup.position.set(0, -0.02, 0);
    knifeGroup.rotation.set(-0.38, -0.14, 0.12);
    group.add(knifeGroup);

    const addKnifePart = (
      geo: THREE.BufferGeometry,
      mat: THREE.Material,
      pos: [number, number, number],
      rot: [number, number, number] = [0, 0, 0],
      scale: [number, number, number] = [1, 1, 1],
    ) => {
      disposables.push(geo);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(...pos);
      mesh.rotation.set(...rot);
      mesh.scale.set(...scale);
      knifeGroup.add(mesh);
      return mesh;
    };

    // Ergonomic tactical handle + pommel + crossguard on unified axis
    addKnifePart(new THREE.BoxGeometry(0.034, 0.022, 0.044), brushedSteel, [0, -0.105, 0]);
    addKnifePart(new THREE.BoxGeometry(0.028, 0.125, 0.038), gripRubber, [0, -0.04, 0]);
    addKnifePart(new THREE.BoxGeometry(0.046, 0.016, 0.072), brushedSteel, [0, 0.028, 0]);

    // Dark coated combat tanto blade + crimson bevel edge + flattened diamond tip
    addKnifePart(new THREE.BoxGeometry(0.009, 0.20, 0.040), gunMetal, [0, 0.135, 0]);
    addKnifePart(new THREE.BoxGeometry(0.005, 0.198, 0.010), accentMat, [0, 0.135, -0.022]);
    addKnifePart(new THREE.BoxGeometry(0.011, 0.16, 0.008), brushedSteel, [0, 0.125, 0.016]);
    addKnifePart(
      new THREE.ConeGeometry(0.028, 0.072, 4),
      brushedSteel,
      [0, 0.270, -0.002],
      [0, Math.PI / 4, 0],
      [0.24, 1, 1.05],
    );

    // First-person knife forearm & cuff
    addPart(new THREE.BoxGeometry(0.062, 0.072, 0.20), sleeveMat, [0.055, -0.13, 0.17], [0.22, 0.18, 0]);
    addPart(new THREE.BoxGeometry(0.056, 0.06, 0.07), cuffAccentMat, [0.015, -0.095, 0.07], [-0.22, 0, 0]);
  } else {
    hipPos = [0.22, -0.22, -0.36];
    adsPos = [0, -0.072, -0.26];
    muzzleZ = -0.26;
    muzzleY = 0.026;

    // Brushed metal slide + polymer frame + tritium iron sights
    addPart(new THREE.BoxGeometry(0.054, 0.052, 0.26), brushedSteel, [0, 0.03, -0.04]);
    addPart(new THREE.BoxGeometry(0.050, 0.042, 0.24), mattePolymer, [0, -0.012, -0.03]);
    addPart(new THREE.BoxGeometry(0.048, 0.13, 0.064), gripRubber, [0, -0.082, 0.05], [-0.25, 0, 0]);
    addPart(new THREE.BoxGeometry(0.012, 0.018, 0.015), gunMetal, [-0.012, 0.065, 0.07]);
    addPart(new THREE.BoxGeometry(0.012, 0.018, 0.015), gunMetal, [0.012, 0.065, 0.07]);
    addPart(new THREE.SphereGeometry(0.003, 6, 6), laserEmitMat, [0, 0.068, -0.15]);

    addPart(new THREE.BoxGeometry(0.058, 0.068, 0.19), sleeveMat, [0.04, -0.13, 0.16], [0.22, 0.12, 0]);
    addPart(new THREE.BoxGeometry(0.054, 0.058, 0.068), cuffAccentMat, [0.004, -0.095, 0.055], [-0.24, 0, 0]);
  }

  // Multi-layered star-cross muzzle flash + bright plasma core
  const muzzleFlash = new THREE.Group();
  const flashColor = weaponId === 'sniper' ? 0x38bdf8 : weaponId === 'smg' ? 0xfbbf24 : 0xfde047;
  const flashMat = new THREE.MeshBasicMaterial({
    color: flashColor,
    transparent: true,
    opacity: 0.94,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const coreMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.98,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const flashConeGeo = new THREE.ConeGeometry(0.115, 0.36, 7);
  flashConeGeo.rotateX(-Math.PI / 2);
  flashConeGeo.translate(0, 0, -0.18);
  const flashFinGeo = new THREE.PlaneGeometry(0.36, 0.115);
  const coreGeo = new THREE.SphereGeometry(0.058, 8, 8);
  const flashRingGeo = new THREE.RingGeometry(0.055, 0.125, 14);
  disposables.push(flashMat, coreMat, flashConeGeo, flashFinGeo, coreGeo, flashRingGeo);

  const fCore = new THREE.Mesh(coreGeo, coreMat);
  const fCone = new THREE.Mesh(flashConeGeo, flashMat);
  const fRing = new THREE.Mesh(flashRingGeo, flashMat);
  const fFin1 = new THREE.Mesh(flashFinGeo, flashMat);
  const fFin2 = new THREE.Mesh(flashFinGeo, flashMat);
  const fFin3 = new THREE.Mesh(flashFinGeo, flashMat);
  const fFin4 = new THREE.Mesh(flashFinGeo, flashMat);
  fFin2.rotation.z = Math.PI / 2;
  fFin3.rotation.z = Math.PI / 4;
  fFin4.rotation.z = -Math.PI / 4;
  muzzleFlash.add(fCore, fCone, fRing, fFin1, fFin2, fFin3, fFin4);
  muzzleFlash.position.set(0, muzzleY, muzzleZ);
  muzzleFlash.visible = false;
  group.add(muzzleFlash);

  return {
    group,
    muzzleFlash,
    hipPos,
    adsPos,
    muzzleLocalPos: [0, muzzleY, muzzleZ],
    setSleeveAccent: (hex: number) => {
      cuffAccentMat.color.setHex(hex);
      cuffAccentMat.emissive.setHex(hex);
    },
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}

export interface PlayerRig {
  root: THREE.Group;
  head: THREE.Group;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  rightArm: THREE.Group;
  bodyGroup: THREE.Group;
  hitFlashMats: THREE.MeshStandardMaterial[];
  dispose: () => void;
}

export function buildPlayerRig(
  team: Team,
  shadowDiscMat: THREE.Material,
  labelColorHex: number,
  characterStyle: CharacterStyle = 'vanguard',
  accentColorHex = 0x38bdf8,
): PlayerRig {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const disposables: Array<{ dispose: () => void }> = [];

  const primaryColor =
    team === 'RED'
      ? 0xdc2626
      : team === 'BLUE'
      ? 0x2563eb
      : characterStyle === 'medtech'
      ? 0xe2e8f0
      : characterStyle === 'phantom'
      ? 0x1e1b4b
      : labelColorHex;

  const secondaryTrimColor =
    characterStyle === 'medtech'
      ? 0x10b981
      : characterStyle === 'juggernaut'
      ? 0x475569
      : accentColorHex;

  const armorMat = new THREE.MeshStandardMaterial({
    color: primaryColor,
    roughness: characterStyle === 'phantom' ? 0.55 : 0.38,
    metalness: characterStyle === 'juggernaut' ? 0.55 : 0.35,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: secondaryTrimColor,
    roughness: 0.35,
    metalness: 0.45,
  });
  const darkUnderMat = new THREE.MeshStandardMaterial({
    color: 0x18212f,
    roughness: 0.8,
    metalness: 0.14,
  });
  const visorMat = new THREE.MeshStandardMaterial({
    color: accentColorHex,
    emissive: accentColorHex,
    emissiveIntensity: 0.9,
    roughness: 0.14,
    metalness: 0.72,
  });
  const gunMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.3,
    metalness: 0.85,
  });
  const gunAccentMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    roughness: 0.35,
    metalness: 0.75,
  });
  disposables.push(armorMat, trimMat, darkUnderMat, visorMat, gunMat, gunAccentMat);

  const addBox = (
    parent: THREE.Object3D,
    w: number,
    h: number,
    d: number,
    mat: THREE.Material,
    pos: [number, number, number],
    rot: [number, number, number] = [0, 0, 0],
    castShadow = false,
  ) => {
    const geo = new THREE.BoxGeometry(w, h, d);
    disposables.push(geo);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(...pos);
    mesh.rotation.set(...rot);
    mesh.castShadow = castShadow;
    parent.add(mesh);
    return mesh;
  };

  // Contact shadow disc
  const shGeo = new THREE.CircleGeometry(characterStyle === 'juggernaut' ? 0.64 : 0.55, 16);
  shGeo.rotateX(-Math.PI / 2);
  disposables.push(shGeo);
  const shadow = new THREE.Mesh(shGeo, shadowDiscMat);
  shadow.position.y = 0.015;
  root.add(shadow);

  // Legs (slim for recon, armored greaves for juggernaut)
  const legW = characterStyle === 'juggernaut' ? 0.28 : characterStyle === 'recon' ? 0.21 : 0.24;
  const legGeo = new THREE.BoxGeometry(legW, 0.72, 0.26);
  legGeo.translate(0, -0.36, 0);
  disposables.push(legGeo);
  const leftLeg = new THREE.Mesh(legGeo, darkUnderMat);
  leftLeg.position.set(-0.16, 0.72, 0);
  const rightLeg = new THREE.Mesh(legGeo, darkUnderMat);
  rightLeg.position.set(0.16, 0.72, 0);
  bodyGroup.add(leftLeg, rightLeg);

  // Torso & character-specific chest silhouette
  const torsoW = characterStyle === 'juggernaut' ? 0.68 : characterStyle === 'recon' ? 0.52 : 0.58;
  const torsoD = characterStyle === 'juggernaut' ? 0.40 : 0.34;
  addBox(bodyGroup, torsoW, 0.64, torsoD, armorMat, [0, 1.04, 0], [0, 0, 0], true);
  addBox(bodyGroup, torsoW + 0.03, 0.12, torsoD + 0.03, darkUnderMat, [0, 0.74, 0]);

  if (characterStyle === 'vanguard') {
    addBox(bodyGroup, 0.42, 0.28, 0.06, trimMat, [0, 1.12, -0.18]);
    addBox(bodyGroup, 0.17, 0.22, 0.34, armorMat, [-0.37, 1.24, 0]);
    addBox(bodyGroup, 0.17, 0.22, 0.34, armorMat, [0.37, 1.24, 0]);
  } else if (characterStyle === 'recon') {
    addBox(bodyGroup, 0.32, 0.36, 0.14, darkUnderMat, [0, 1.08, 0.22]); // Recon backpack
    addBox(bodyGroup, 0.03, 0.42, 0.03, trimMat, [-0.12, 1.44, 0.22]); // Radio whip antenna
    addBox(bodyGroup, 0.12, 0.16, 0.28, trimMat, [-0.32, 1.25, 0]);
    addBox(bodyGroup, 0.12, 0.16, 0.28, trimMat, [0.32, 1.25, 0]);
  } else if (characterStyle === 'juggernaut') {
    addBox(bodyGroup, 0.74, 0.16, 0.44, trimMat, [0, 1.34, 0]); // Heavy blast collar
    addBox(bodyGroup, 0.24, 0.28, 0.42, armorMat, [-0.46, 1.26, 0]);
    addBox(bodyGroup, 0.24, 0.28, 0.42, armorMat, [0.46, 1.26, 0]);
    addBox(bodyGroup, 0.44, 0.44, 0.20, darkUnderMat, [0, 1.08, 0.28]); // Heavy dorsal power unit
  } else if (characterStyle === 'phantom') {
    addBox(bodyGroup, 0.14, 0.20, 0.36, trimMat, [-0.34, 1.26, 0], [0, 0, 0.22]);
    addBox(bodyGroup, 0.14, 0.20, 0.36, trimMat, [0.34, 1.26, 0], [0, 0, -0.22]);
    addBox(bodyGroup, 0.28, 0.34, 0.10, darkUnderMat, [0, 1.12, 0.20]);
  } else if (characterStyle === 'medtech') {
    // Trauma pack & glowing cross emblem
    addBox(bodyGroup, 0.18, 0.20, 0.32, trimMat, [-0.36, 1.24, 0]);
    addBox(bodyGroup, 0.18, 0.20, 0.32, trimMat, [0.36, 1.24, 0]);
    addBox(bodyGroup, 0.34, 0.36, 0.16, trimMat, [0, 1.08, 0.23]); // Med-canister pack
    addBox(bodyGroup, 0.22, 0.07, 0.04, visorMat, [0, 1.12, -0.18]);
    addBox(bodyGroup, 0.07, 0.22, 0.04, visorMat, [0, 1.12, -0.18]);
  }

  // Head & character-specific helmet/visor
  const head = new THREE.Group();
  head.position.set(0, 1.48, 0);
  addBox(head, 0.40, 0.38, 0.40, armorMat, [0, 0, 0], [0, 0, 0], true);

  if (characterStyle === 'recon') {
    addBox(head, 0.44, 0.12, 0.44, darkUnderMat, [0, 0.14, 0.02]); // Hood cowl
    addBox(head, 0.11, 0.10, 0.08, visorMat, [-0.09, 0.02, -0.20]); // Dual optic lenses
    addBox(head, 0.11, 0.10, 0.08, visorMat, [0.09, 0.02, -0.20]);
  } else if (characterStyle === 'juggernaut') {
    addBox(head, 0.45, 0.18, 0.44, trimMat, [0, 0.12, 0]); // Reinforced brow shield
    addBox(head, 0.32, 0.07, 0.08, visorMat, [0, 0.01, -0.20]); // Armored slit visor
  } else if (characterStyle === 'phantom') {
    addBox(head, 0.10, 0.12, 0.38, trimMat, [0, 0.22, 0.04], [0.22, 0, 0]); // Stealth crest fin
    addBox(head, 0.08, 0.08, 0.07, visorMat, [-0.10, 0.03, -0.20]);
    addBox(head, 0.08, 0.08, 0.07, visorMat, [0.10, 0.03, -0.20]);
    addBox(head, 0.07, 0.07, 0.07, visorMat, [0, 0.10, -0.20]);
  } else {
    addBox(head, 0.34, 0.12, 0.08, visorMat, [0, 0.02, -0.19]);
  }
  bodyGroup.add(head);

  // Detailed 3rd-person weapon arm
  const rightArm = new THREE.Group();
  rightArm.position.set(0.38, 1.18, -0.08);
  addBox(rightArm, 0.16, 0.18, 0.44, darkUnderMat, [0, 0, -0.16]);
  addBox(rightArm, 0.08, 0.11, 0.44, gunMat, [-0.08, -0.01, -0.34]);
  addBox(rightArm, 0.04, 0.04, 0.28, gunAccentMat, [-0.08, 0.01, -0.62]);
  addBox(rightArm, 0.05, 0.14, 0.07, gunMat, [-0.08, -0.11, -0.36], [0.2, 0, 0]);
  addBox(rightArm, 0.045, 0.04, 0.09, visorMat, [-0.08, 0.065, -0.32]);
  bodyGroup.add(rightArm);

  return {
    root,
    head,
    leftLeg,
    rightLeg,
    rightArm,
    bodyGroup,
    hitFlashMats: [armorMat, trimMat],
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}
