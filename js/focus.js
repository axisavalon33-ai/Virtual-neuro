// Decides which ONE body part the visitor is looking at, before anything is
// drawn. Candidates come from scene.regions; the winner must be the best for a
// few consecutive frames, so a one-frame misdetection never flashes up.

const ACQUIRE_FRAMES = 6;  // frames a new body part must win before it is shown
const SWITCH_FRAMES = 10;  // frames another part must clearly win to replace it
const SWITCH_MARGIN = 1.35;
const LOSE_FRAMES = 15;    // frames without the shown part before it is dropped

export class FocusTracker {
  constructor() {
    this.current = null;  // { group, key, since }
    this.pending = null;  // { group, count }
    this.missing = 0;
  }

  score(r, w, h) {
    const diag = Math.hypot(w, h);
    const d = Math.hypot(r.x - w / 2, r.y - h / 2) / (diag / 2);
    const centrality = 1 - 0.75 * Math.min(1, d);
    return r.conf * (0.3 + Math.min(1, r.size / diag)) * centrality;
  }

  update(regions, w, h, now) {
    // Best region per body-part group.
    const best = new Map();
    for (const r of regions) {
      const s = this.score(r, w, h);
      if (!best.has(r.group) || best.get(r.group).s < s) best.set(r.group, { ...r, s });
    }
    let top = null;
    for (const r of best.values()) if (!top || r.s > top.s) top = r;

    const cur = this.current && best.get(this.current.group);
    if (cur) {
      this.missing = 0;
      this.current.key = cur.key; // e.g. head-front -> head-side as the head turns
    } else if (this.current && ++this.missing > LOSE_FRAMES) {
      this.current = null;
    }

    if (!top) { this.pending = null; return this.state(); }

    if (this.current && top.group === this.current.group) {
      this.pending = null;
    } else {
      const needed = this.current ? SWITCH_FRAMES : ACQUIRE_FRAMES;
      const beats = !cur || top.s > cur.s * SWITCH_MARGIN;
      if (beats) {
        this.pending = this.pending && this.pending.group === top.group
          ? { group: top.group, count: this.pending.count + 1, needed }
          : { group: top.group, count: 1, needed };
        if (this.pending.count >= needed) {
          this.current = { group: top.group, key: top.key, since: now };
          this.pending = null;
          this.missing = 0;
        }
      } else {
        this.pending = null;
      }
    }
    return this.state();
  }

  state() {
    return {
      current: this.current,
      progress: this.pending ? this.pending.count / this.pending.needed : 0,
      pendingGroup: this.pending?.group || null,
    };
  }
}
