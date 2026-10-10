// Optional 3D layer: anchors your own glTF/GLB anatomy models (for example a
// brain exported from a 3D anatomy app) to the tracked body. Configure it in
// models/models.json. If no models are listed, three.js is never loaded.

export class ModelLayer {
  static async create(configUrl = 'models/models.json') {
    let cfg;
    try {
      const res = await fetch(configUrl, { cache: 'no-store' });
      if (!res.ok) return null;
      cfg = await res.json();
    } catch {
      return null;
    }
    const entries = (cfg.models || []).filter((m) => m.file && !m.disabled);
    if (!entries.length) return null;
    const layer = new ModelLayer();
    await layer.init(entries);
    return layer;
  }

  async init(entries) {
    const THREE = await import('three');
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    this.THREE = THREE;
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    this.renderer.setClearColor(0x000000, 0);
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.4));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(0.3, 0.6, 1);
    this.scene.add(sun);
    this.camera = new THREE.OrthographicCamera(0, 1, 0, -1, -10000, 10000);
    const loader = new GLTFLoader();

    this.items = [];
    for (const e of entries) {
      try {
        const gltf = await loader.loadAsync('models/' + e.file);
        const root = gltf.scene;
        // Normalise: centre the model at the origin and make it 1 unit tall
        // (for limbs) or 1 unit in its largest dimension (for the head).
        const box = new THREE.Box3().setFromObject(root);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        root.position.sub(center);
        const inner = new THREE.Group();
        inner.add(root);
        const r = e.rotation || [0, 0, 0];
        inner.rotation.set(r[0] * Math.PI / 180, r[1] * Math.PI / 180, r[2] * Math.PI / 180);
        const isLimb = e.region !== 'head' && e.region !== 'torso';
        const norm = isLimb ? size.y : Math.max(size.x, size.y, size.z);
        inner.scale.setScalar(1 / (norm || 1));
        const holder = new THREE.Group();
        holder.add(inner);
        holder.visible = false;
        if (e.opacity !== undefined && e.opacity < 1) {
          root.traverse((o) => {
            if (o.material) { o.material.transparent = true; o.material.opacity = e.opacity; o.material.depthWrite = false; }
          });
        }
        this.scene.add(holder);
        this.items.push({ cfg: e, holder });
      } catch (err) {
        console.warn('Could not load model', e.file, err);
      }
    }
  }

  // Which 2D overlays the 3D models replace for the current scene.
  replaces(scene) {
    const skip = {};
    for (const it of this.items) {
      if (it.cfg.region === 'head' && it.cfg.replaces2D !== false && it.holder.visible) skip.brain = true;
    }
    return skip;
  }

  update(scene, w, h, dpr) {
    if (this.renderer.domElement.width !== Math.round(w * dpr) || this.renderer.domElement.height !== Math.round(h * dpr)) {
      this.renderer.setPixelRatio(dpr);
      this.renderer.setSize(w, h, false);
    }
    Object.assign(this.camera, { left: 0, right: w, top: 0, bottom: -h });
    this.camera.updateProjectionMatrix();

    const used = {};
    let any = false;
    for (const it of this.items) {
      const c = it.cfg;
      const s = c.scale ?? 1;
      const off = c.offset || [0, 0, 0];
      it.holder.visible = false;
      if (c.region === 'head') {
        const hd = scene.anchors.heads[0];
        if (!hd || (c.view && c.view !== 'any' && c.view !== hd.view)) continue;
        const yaw = hd.view === 'back' ? Math.PI : hd.view === 'side' ? (hd.dir * Math.PI) / 2 : 0;
        const ux = Math.sin(hd.rot), uy = -Math.cos(hd.rot); // head "up" on screen
        const px = hd.c.x + (-uy * off[0] + ux * off[1]) * hd.R;
        const py = hd.c.y + (ux * off[0] + uy * off[1]) * hd.R;
        it.holder.position.set(px, -py, 0);
        it.holder.rotation.order = 'ZYX';
        it.holder.rotation.set(0, yaw, -hd.rot);
        it.holder.scale.setScalar(hd.R * 2 * s);
      } else {
        const segs = scene.anchors.segments.filter((g) => g.name === c.region);
        const i = used[c.region] = (used[c.region] ?? -1) + 1;
        const g = segs[i];
        if (!g) continue;
        const dx = g.a.x - g.b.x, dy = -(g.a.y - g.b.y); // proximal end is model +Y
        const L = Math.hypot(dx, dy);
        it.holder.position.set((g.a.x + g.b.x) / 2, -(g.a.y + g.b.y) / 2, 0);
        it.holder.rotation.order = 'ZYX';
        it.holder.rotation.set(0, 0, Math.atan2(dy, dx) - Math.PI / 2);
        it.holder.scale.setScalar(L * s);
      }
      it.holder.visible = true;
      any = true;
    }
    if (!any) return null;
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement;
  }
}
