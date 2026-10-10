// Anatomical data, expressed in body-segment coordinates so it follows the
// tracked skeleton.
//
// Limb point:  [segment, t, s]
//   t: 0 at the proximal joint, 1 at the distal joint (may go slightly outside)
//   s: sideways offset in limb half-widths. s > 0 is MEDIAL (toward the body
//      midline); for the forearm/hand s > 0 is the ULNAR (little-finger) side.
// Torso point: ['torso', t, s]
//   t: 0 on the shoulder line, 1 on the hip line (negative = up the neck)
//   s: offset in half shoulder-widths, s > 0 is the person's LEFT.
// ['hand', key] splices in the branches from HAND_BRANCHES (needs hand tracking).
//
// face: which side of the body the nerve is superficial on. Nerves on the far
// side from the camera are drawn faint and dashed ("seen through the body") and
// are not labelled.

export const COLORS = {
  nerve: '#ffd447',
  cranial: '#7fe7ff',
  trigeminal: '#ffb86b',
  facial: '#8dff9e',
  cord: '#fff1b8',
};

export const ARM_NERVES = [
  {
    id: 'median', name: 'Median nerve', face: 'front', label: ['forearm', 0.45, 0.0],
    path: [['upperArm', 0.0, 0.25], ['upperArm', 0.5, 0.32], ['upperArm', 0.95, 0.18],
      ['forearm', 0.12, 0.05], ['forearm', 0.6, 0.0], ['forearm', 1.0, -0.05], ['hand', 'median']],
  },
  {
    id: 'ulnar', name: 'Ulnar nerve', face: 'both', label: ['upperArm', 0.9, 0.85],
    path: [['upperArm', 0.0, 0.35], ['upperArm', 0.5, 0.6], ['upperArm', 0.97, 0.88],
      ['forearm', 0.1, 0.85], ['forearm', 0.55, 0.7], ['forearm', 1.0, 0.6], ['hand', 'ulnar']],
  },
  {
    id: 'radial', name: 'Radial nerve', face: 'back', label: ['upperArm', 0.6, -0.6],
    path: [['upperArm', 0.0, 0.2], ['upperArm', 0.3, 0.0], ['upperArm', 0.55, -0.6],
      ['upperArm', 0.85, -0.55], ['upperArm', 1.02, -0.35], ['forearm', 0.12, -0.45],
      ['forearm', 0.55, -0.7], ['forearm', 0.97, -0.8], ['hand', 'radial']],
  },
  {
    id: 'musculocutaneous', name: 'Musculocutaneous nerve', face: 'front', label: ['upperArm', 0.45, -0.15],
    path: [['upperArm', 0.05, 0.15], ['upperArm', 0.3, -0.05], ['upperArm', 0.7, -0.25],
      ['upperArm', 1.0, -0.4], ['forearm', 0.15, -0.55], ['forearm', 0.6, -0.65]],
  },
  {
    id: 'axillary', name: 'Axillary nerve', face: 'back', label: null,
    path: [['upperArm', 0.0, 0.1], ['upperArm', 0.12, -0.35], ['upperArm', 0.2, -0.85]],
  },
];

// Hand landmark refs: a number is a landmark index, [a, b, f] is lerp(a, b, f).
// Landmarks: 0 wrist, 1-4 thumb, 5-8 index, 9-12 middle, 13-16 ring, 17-20 little.
// Each entry is a list of branches; branch 0 continues the forearm trunk.
export const HAND_BRANCHES = {
  median: {
    face: 'front', label: { at: [0, 9, 0.35], name: 'Carpal tunnel (median n.)' },
    branches: [
      [[0, 9, 0.05], [0, 9, 0.4], [1, 2, 0.6], 3, 4],
      [[0, 9, 0.4], [5, 9, 0.15], 6, 7, 8],
      [[0, 9, 0.4], 9, 10, 11, 12],
      [[0, 9, 0.4], [13, 9, 0.3], [14, 10, 0.3], [15, 11, 0.3], [16, 12, 0.25]],
    ],
  },
  ulnar: {
    face: 'front', label: { at: [17, 18, 0.5], name: 'Ulnar nerve' },
    branches: [
      [[0, 17, 0.12], [0, 17, 0.55], 17, 18, 19, 20],
      [[0, 17, 0.55], [13, 17, 0.3], [14, 18, 0.3], [15, 19, 0.3], [16, 20, 0.25]],
    ],
  },
  radial: {
    face: 'back', label: { at: [1, 2, 0.4], name: 'Superficial radial n.' },
    branches: [
      [[0, 1, 0.25], [1, 2, 0.5], 2, 3],
      [[1, 2, 0.5], [2, 5, 0.5], 5, 6],
    ],
  },
};

export const LEG_NERVES = [
  {
    id: 'sciatic', name: 'Sciatic nerve', face: 'back', width: 1.6, label: ['thigh', 0.4, 0.0],
    path: [['thigh', -0.05, -0.1], ['thigh', 0.4, 0.0], ['thigh', 0.82, 0.02]],
  },
  {
    id: 'tibial', name: 'Tibial nerve', face: 'back', label: ['leg', 0.45, 0.05],
    path: [['thigh', 0.82, 0.02], ['thigh', 1.0, 0.05], ['leg', 0.1, 0.0], ['leg', 0.6, 0.05],
      ['leg', 0.97, 0.35], ['foot', 0.25, 0.35], ['foot', 0.9, 0.4]],
  },
  {
    id: 'fibular', name: 'Common fibular nerve', face: 'both', label: ['leg', 0.1, -0.85],
    path: [['thigh', 0.82, 0.02], ['thigh', 1.0, -0.5], ['leg', 0.08, -0.85], ['leg', 0.18, -0.7],
      ['leg', 0.5, -0.55], ['leg', 0.97, -0.3], ['foot', 0.3, -0.2], ['foot', 0.9, -0.1]],
  },
  {
    id: 'deepfibular', name: 'Deep fibular nerve', face: 'front', label: null,
    path: [['leg', 0.18, -0.7], ['leg', 0.35, -0.3], ['leg', 0.97, -0.05], ['foot', 0.4, 0.05], ['foot', 1.0, 0.15]],
  },
  {
    id: 'femoral', name: 'Femoral nerve', face: 'front', label: ['thigh', 0.15, 0.1],
    path: [['thigh', -0.08, 0.15], ['thigh', 0.1, 0.1], ['thigh', 0.28, -0.1], ['thigh', 0.45, -0.2]],
  },
  {
    id: 'saphenous', name: 'Saphenous nerve', face: 'front', label: ['leg', 0.5, 0.65],
    path: [['thigh', 0.1, 0.1], ['thigh', 0.5, 0.45], ['thigh', 0.92, 0.75], ['leg', 0.1, 0.75],
      ['leg', 0.6, 0.65], ['leg', 1.0, 0.5], ['foot', 0.3, 0.6]],
  },
  {
    id: 'obturator', name: 'Obturator nerve', face: 'front', label: null,
    path: [['thigh', -0.05, 0.4], ['thigh', 0.15, 0.5], ['thigh', 0.4, 0.6]],
  },
];

// Bilateral torso nerves are listed once with s > 0 (person's left) and mirrored.
export const TORSO_NERVES = [
  {
    id: 'vagus', name: 'Vagus nerve (CN X)', face: 'front', mirror: true, label: ['torso', 0.15, 0.12],
    path: [['torso', -0.26, 0.12], ['torso', 0.0, 0.13], ['torso', 0.3, 0.09], ['torso', 0.55, 0.04]],
  },
  {
    id: 'phrenic', name: 'Phrenic nerve', face: 'front', mirror: true, label: ['torso', 0.25, 0.37],
    path: [['torso', -0.24, 0.25], ['torso', 0.0, 0.3], ['torso', 0.25, 0.37], ['torso', 0.42, 0.48]],
  },
  {
    id: 'brachialplexus', name: 'Brachial plexus', face: 'both', mirror: true, label: ['torso', -0.08, 0.5],
    path: [['torso', -0.22, 0.12], ['torso', -0.1, 0.45], ['torso', 0.05, 0.88]],
    strands: 3,
  },
  {
    id: 'lumbosacral', name: 'Lumbosacral plexus', face: 'both', mirror: true, label: null,
    path: [['torso', 0.6, 0.05], ['torso', 0.82, 0.25], ['torso', 1.0, 0.42]],
    strands: 3,
  },
];

// Spinal cord, cauda equina and intercostal nerves are generated in scene.js.

// Head structures. Coordinates are in head units (R = head radius) relative to
// the head centre; v > 0 is downward (chin), u > 0 is toward the nose in side
// view. Labels are drawn on top of the procedural brain sprites.
export const BRAIN_LABELS = {
  front: [
    { name: 'Cerebrum (frontal lobe)', u: -0.32, v: -0.62 },
    { name: 'Temporal lobe', u: 0.62, v: 0.2 },
    { name: 'Pons (brainstem)', u: 0.0, v: 0.33 },
    { name: 'Medulla oblongata', u: 0.0, v: 0.62 },
  ],
  side: [
    { name: 'Frontal lobe', u: 0.6, v: -0.42 },
    { name: 'Parietal lobe', u: -0.2, v: -0.62 },
    { name: 'Temporal lobe', u: 0.2, v: 0.15 },
    { name: 'Occipital lobe', u: -0.8, v: -0.2 },
    { name: 'Cerebellum', u: -0.55, v: 0.4 },
    { name: 'Pons', u: 0.08, v: 0.32 },
    { name: 'Medulla oblongata', u: -0.05, v: 0.7 },
  ],
  back: [
    { name: 'Parietal lobe', u: -0.35, v: -0.6 },
    { name: 'Occipital lobe', u: 0.35, v: -0.1 },
    { name: 'Cerebellum', u: -0.35, v: 0.38 },
    { name: 'Spinal cord', u: 0.0, v: 0.85 },
  ],
};

// Short "did you know" captions shown in the HUD for the region in view.
export const REGION_INFO = {
  'head-front': 'Brain: cerebrum, brainstem and medulla. The cranial nerves for vision, facial feeling and facial movement are also shown.',
  'head-side': 'Brain lobes: frontal (planning), parietal (touch), temporal (hearing, memory), occipital (vision), and the cerebellum (balance).',
  'head-back': 'Back of the head: occipital lobe (vision) and cerebellum (balance and coordination). The spinal cord runs down from the medulla.',
  arm: 'Arm: the median, ulnar and radial nerves carry commands from the brain to the muscles, and touch signals back. Hitting your "funny bone" squeezes the ulnar nerve.',
  hand: 'Hand: the median nerve passes through the carpal tunnel. The ulnar nerve supplies the little finger. Touch signals run from the fingertips back to the brain.',
  leg: 'Leg: the sciatic nerve is the thickest nerve in the body. It splits into the tibial and common fibular nerves above the knee.',
  'torso-front': 'Chest: the vagus nerve slows the heart and helps digestion. The phrenic nerve drives the diaphragm when you breathe.',
  'torso-back': 'Back: the spinal cord ends around the first lumbar vertebra. Below that, the nerve roots form the cauda equina ("horse\'s tail").',
};
