# Draft issue for chartjs/Chart.js

**Title:** `fill: 'stack'`: a dataset's whole fill disappears when its x differs from the line below by ≤ 1e-6 px (visible as bands vanishing at the end of animations)

---

### Expected behavior

With `fill: 'stack'`, each dataset's area stays filled on every frame, including frames of an animated
`chart.update()`.

### Current behavior

Consider an animated update of a stacked area chart that moves points horizontally, for example because the
y-axis tick labels change width. Right when the transition looks finished, every band above the first dataset
disappears. The bands then reappear one by one in dataset order over the next few frames.

The same happens without animation: if a dataset's point `x` differs from the dataset below it by a tiny non-zero
amount (≤ 1e-6 px), that dataset's entire fill is not drawn.

### Reproducible sample

Deterministic, no animation (Chart.js 4.5.1):

```js
const chart = new Chart(canvas, {
  type: 'line',
  data: {
    labels: ['a', 'b', 'c', 'd', 'e'],
    datasets: [
      { data: [1, 2, 1, 2, 1], fill: 'stack', backgroundColor: 'rgba(0, 0, 255, 0.5)', pointRadius: 0 },
      { data: [1, 1, 1, 1, 1], fill: 'stack', backgroundColor: 'rgba(255, 128, 0, 0.5)', pointRadius: 0 },
    ],
  },
  options: { animation: false, scales: { y: { stacked: true } } },
});

chart.getDatasetMeta(1).data[2].x += 1e-9;
chart.draw(); // the orange band (dataset 1) is gone completely
// nudging by 1e-3 instead of 1e-9 does not trigger it
```

Animated version (what users actually see): attached `minimal-repro.html`. Two datasets, 330 points, and a
toggle between a percentage and an absolute representation. The tick labels `"100%"` and `"16,000"` differ in
width, so `chartArea.left` moves by 6 px and all points' `x` animate. On each toggle the orange band is logged
missing for about 7 consecutive frames just before `animation.onComplete`.

<!-- attach minimal-repro.html or paste it into a codepen and link it here -->

### Root cause

1. `fill: 'stack'` rebuilds its lower boundary on every draw. `_buildStackLine` → `addPointsBelow` →
   `findPoint(lineBelow, sourcePoint, 'x')` → `lineBelow.interpolate(sourcePoint, 'x')`.
2. `LineElement.interpolate` returns an **array** when more than one segment matches. `_boundSegment` decides
   "inside" with the epsilon-tolerant `_isBetween(…, 1e-6)`, but decides where a sub-segment starts with exact
   `compare(...) === 0`. For a degenerate bound `{start: v, end: v}` where `v = x_j ± δ` and `0 < δ ≤ 1e-6`, it
   therefore returns both `[j-1, j]` and `[j, j+1]`, and `interpolate` returns `[p, p']`:
   ```
   line x = [0, 10, 20, 30]
   interpolate({x: 10})        -> {x: 10, y: …}
   interpolate({x: 10 + 1e-9}) -> [{…}, {…}]    // also for ±1e-12 … ±1e-6
   interpolate({x: 10 + 2e-6}) -> {x: 10.000002, y: …}
   ```
3. `findPoint` (`src/plugins/plugin.filler/filler.target.stack.js`) doesn't handle the array. `point[property]` is
   `undefined`, and the array is pushed into the synthetic boundary line as if it were a point.
4. In `_segments(line, target)`, the boundary line's sub-segments that touch that element get `undefined`
   bounds. `_boundSegment(sourceSegment, …, subBounds)` then finds no overlap, `_segments` returns **0 parts**,
   and nothing is filled for that dataset. One bad point is enough to remove the whole band.

**Why animations hit this so reliably.** `chart.update()` updates datasets sequentially, and every `Animation`
takes its own `Date.now()` as `_start`. With a few hundred points per dataset, dataset *i*'s x-animations start
several ms after dataset *i-1*'s (measured: about 10 ms per dataset for 330 points). The datasets' `x` values
at the same index therefore differ a little on every frame. Near the end of the ease-out curve the difference
shrinks into the 1e-7…1e-9 px range, which is exactly the window above. When each dataset's animation finishes,
its `x` snaps to the exact target value and its band returns. That produces the "collapse, then rebuild in array
order" pattern. Dataset 0 is never affected because its target is the axis line.

Triggers therefore include anything that animates `x` for stacked-fill datasets: y-tick label width changes,
legend size changes on a left/right legend, x-label rotation changes, and label insertions/removals.
`tension` is irrelevant (reproduces with `tension: 0`). `fill: 'origin'` and `fill: '-1'` are unaffected because
they don't go through `findPoint`.

### Possible solution

Minimal fix in `findPoint`. The matched points are the same point within the epsilon, so taking the first is safe:

```diff
 function findPoint(line, sourcePoint, property) {
-  const point = line.interpolate(sourcePoint, property);
+  let point = line.interpolate(sourcePoint, property);
+  if (isArray(point)) {
+    // interpolate() returns one point per matching segment; a value within the
+    // _isBetween epsilon of (but not equal to) a vertex matches both adjacent segments
+    point = point[0];
+  }
   if (!point) {
     return {};
   }
```

(Plus `isArray` added to the existing `import {_isBetween} from '../../helpers/index.js'`.) Verified against 4.5.1: with this change the animated repro shows 0
frames with a missing band, and the 1e-9 nudge no longer removes the fill.

A more thorough fix would make `_boundSegment` use the same tolerance for its start/stop decisions as for
`inside`, so that a single-value bound never yields two overlapping sub-segments. That touches shared segment
code, though. `interpolatedLineTo` in `filler.drawing.js` has the same array blind spot. It is harmless today
only because `ctx.lineTo(undefined, undefined)` is a no-op.

A suggested regression test: the deterministic sample above. Render with `fill: 'stack'`, set
`getDatasetMeta(1).data[2].x += 1e-9`, call `chart.draw()`, and assert that a pixel inside dataset 1's band is
still painted.

### Context

Seen in production with vue-chartjs 5.3.4. Its `setDatasets` update keeps dataset object identity
(`Object.assign` onto the existing dataset), so the update is animated from the current state. The workaround
we use is `fill: 'origin'` on dataset 0 and `fill: '-1'` on the rest, with `scales.y.stacked: true`. At rest it
renders pixel-identical to `'stack'` for a single stack group without `null` gaps.

- chart.js version: 4.5.1 (`findPoint` unchanged on `master`)
- Browser name and version: Chromium (headless, via Playwright) and the reporter's desktop browser
