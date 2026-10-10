# Virtual Neuro AR

An augmented-reality exhibit that works in a phone VR headset. A visitor wears a phone in a
headset (Google Cardboard style). The phone's **back camera** looks at their own body or at
another person. The app detects which body part is in view and draws the **nerves inside
it**, with labels:

| Camera sees | What appears |
|---|---|
| **Head, front** | Brain (cerebrum, temporal lobes), pons, **medulla oblongata**, optic nerves (CN II), trigeminal nerve (CN V), facial nerve (CN VII) |
| **Head, side** | Brain lobes (frontal, parietal, temporal, occipital), **cerebellum**, pons, medulla |
| **Head, back** | Occipital lobe, **cerebellum**, spinal cord, greater occipital nerves |
| **Arm** | Median, ulnar, radial, musculocutaneous and axillary nerves |
| **Hand** (yours or someone else's) | Median nerve through the carpal tunnel, ulnar nerve to the little finger, superficial radial nerve |
| **Chest** | Vagus nerve, phrenic nerves, intercostal nerves, brachial plexus |
| **Back** | Spinal cord, spinal nerves, cauda equina |
| **Leg** | Sciatic, tibial, common fibular, femoral and saphenous nerves |

**How it works, step by step:**

1. **Detect.** A scanning reticle is shown while the app works out which single body part is in
   view. It looks for a hand or arm, a head (front, side or back), the chest or back, or a leg. A
   body part must be recognised for several frames in a row before it is accepted. When several
   are visible, the one that is largest and nearest the centre of view wins, because that is where
   the visitor is looking.
2. **Show.** A "Detected: …" badge appears. Only that body part's nervous system then grows in
   from the body outward, and its labels and caption follow.
3. **Impulses.** Bright pulses with tails travel along the nerves. Movement commands run away
   from the brain and spinal cord. Touch signals in the hand run from the fingertips back toward
   the brain. The brain shows neurons "firing".

To stop a close-up hand being mistaken for a head, a head is only accepted when the face detector
confirms a face. A back-of-head view needs both shoulders and an ear in the picture, a head of
plausible size above the shoulders, and no hand covering it. A body skeleton is thrown away when a
detected hand is far too big for it, because the body tracker invents a whole person around a
close-up hand. (*Show all detected body parts at once* in the menu turns off the one-part-at-a-time
behaviour.)

Nerves on the side of the body facing away from the camera are drawn dashed and faint, as if
seen through the body.

Tracking runs on the phone in the browser using
[MediaPipe](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker) (body
pose, hands and face detection). No app install and no server-side processing are needed, and
no images leave the device.

## Try it

* **Demo without a camera:** open `index.html?demo`. It cycles through front, side and back views and a
  hand. Fix one view with `?demo=back`, and zoom in with `&zoom=3&at=0.5,0.18` (x,y of the
  point to centre, 0–1). `?demo=ghost` reproduces a close-up hand with a falsely detected
  skeleton; only the hand should be shown.
* **Live:** open the page on a phone, tick **VR headset** if you are using a viewer, and
  press **Start camera**.

The camera only works over **HTTPS** (or `localhost`). Easy options:

* **GitHub Pages:** in the repo, go to *Settings → Pages* and deploy from this branch's root. Then open
  `https://<user>.github.io/<repo>/` on the phone.
* **Local network:** run any static server with HTTPS, e.g. `npx http-server -S` or
  `npx vite --host`. A plain `python3 -m http.server` works only for the demo on a laptop.

## Using it at the exhibition

1. Open the page on the phone and allow camera access.
2. Tick **VR headset (side-by-side)**. The app goes full screen and locks to landscape where the
   phone allows it. The screen is kept awake.
3. Put the phone in the headset with the camera uncovered. A tap on the screen (or the
   headset's button) opens and closes the menu.
4. Visitors look at their own arm or hand, or at another person's head, back or legs.

Tips:

* Bright, even lighting improves tracking a lot. Avoid strong backlight behind the person
  being viewed.
* To see the head and brain, the head **and shoulders** should be in view. Then the app can tell
  front, side and back views apart.
* For a visitor's own body, **hands and forearms** track best. Looking down at your own legs or
  chest works less reliably, because the body tracker expects to see a whole person.
* **Offline use** (no Wi-Fi at the venue): run `scripts/download-assets.sh` once while online.
  It copies the tracking engine and models into `vendor/`, and the app then uses them
  automatically. Serve the folder locally over HTTPS.

## Using your own 3D anatomy models

The overlay is drawn in 2D by default, so it works with no extra assets. You can also anchor
real **3D models** (glTF `.glb` / `.gltf`) to the tracked body. For example, show a detailed
3D brain on the head.

1. Export the model from your anatomy software as **GLB/glTF**. Many commercial anatomy apps
   (Complete Anatomy, Visible Body, Essential Anatomy, …) do not allow exporting their models;
   check yours. Free alternatives include
   [Z-Anatomy](https://www.z-anatomy.com/) (Blender, CC BY-SA),
   [BodyParts3D](https://lifesciencedb.jp/bp3d/) and the
   [NIH 3D](https://3d.nih.gov/) library. Convert to GLB with Blender (*File → Export → glTF 2.0*).
2. Put the file in `models/` and list it in `models/models.json`:

```json
{
  "models": [
    { "region": "head", "file": "brain.glb", "view": "any", "scale": 0.85, "offset": [0, 0.05, 0], "rotation": [0, 0, 0], "opacity": 0.9 },
    { "region": "forearm", "file": "forearm-nerves.glb", "scale": 1.0 }
  ]
}
```

| Field | Meaning |
|---|---|
| `region` | `head`, `upperArm`, `forearm`, `thigh`, `leg` or `torso` |
| `view` | head only: `any`, `front`, `side` or `back` (show the model only in that view) |
| `scale` | head: model size relative to head diameter. Limbs: relative to segment length |
| `offset` | head only: `[right, up, 0]` shift in head radii |
| `rotation` | degrees `[x, y, z]` to fix the model's orientation. Head models should face +Z (the glTF convention) with +Y up. Limb models should have +Y pointing toward the shoulder or hip |
| `opacity` | 0–1. Below 1 makes the model see-through |
| `replaces2D` | head only, default `true`: hide the drawn 2D brain while the 3D model is visible |

The models turn with the head (front, side and back) and follow limb direction. Three.js is
loaded only if at least one model is listed.

## Project layout

```
index.html            page and settings menu
css/style.css
js/main.js            camera, frame loop, VR side-by-side output, caption
js/tracker.js         MediaPipe pose, hand and face detection, with smoothing
js/scene.js           maps landmarks to nerve paths, brain overlays and labels; rejects false detections
js/focus.js           picks the one body part in view, with stability across frames
js/anatomy.js         nerve routes in limb coordinates, labels, captions (edit to add structures)
js/brain.js           procedurally drawn brain (front, side, back)
js/renderer.js        glow, branches, pulses, label layout
js/model3d.js         optional glTF model layer (three.js)
js/demo.js            synthetic person for testing
js/config.js          CDN and offline asset locations
scripts/download-assets.sh
models/models.json    your 3D models
```

### Editing the anatomy

Nerve routes in `js/anatomy.js` are written in limb-relative coordinates. `t` runs from 0 at
the joint nearer the body to 1 at the joint further out. `s` is the sideways offset in limb
half-widths, and positive `s` is toward the body midline (on the forearm and hand, toward the
little finger). Add or change entries and they follow the tracked skeleton automatically.

> This is an educational visualisation. Nerve positions are approximate and must not be used
> for clinical purposes.
