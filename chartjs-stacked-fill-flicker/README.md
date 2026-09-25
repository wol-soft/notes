# Chart.js 4.5.1: `fill: 'stack'` bands vanish at the end of an animated update

**Symptom.** A stacked area chart (`fill: 'stack'`, 2+ datasets) plays an animated `chart.update()`. Right when
the transition looks finished, every band above dataset 0 disappears. The bands then come back one at a time in
array order before the chart settles.

**Root cause (one sentence).** When two datasets' point `x` values differ by a tiny non-zero amount (≤ 1e-6 px),
`LineElement.interpolate()` returns an **array** of two points instead of one point. The `fill: 'stack'`
code in `findPoint()` doesn't expect that and pushes the array into its synthetic boundary line as if it were a
point. That one malformed point makes `_segments()` return zero fill parts, so the whole band is skipped.

**Recommended fix (config only, no Chart.js patch).** Replace `fill: 'stack'` with the per-dataset equivalent:

```js
fill: index === 0 ? 'origin' : '-1',   // keep y.stacked: true; dataset order unchanged
```

This fixes the problem completely in every test. At rest it renders pixel-identical to `'stack'`, including when
datasets are hidden via the legend. It keeps the animated transition, and the bands still don't overlap (details below).

---

## Mechanism, step by step (Chart.js 4.5.1, `dist/chart.js` line numbers)

1. **Something moves the points horizontally during an animated update.** Here the y-axis tick labels change
   width (`"100%"` vs `"1,400"`), so `chartArea.left` moves by a few px. Every point's `x` then changes, and
   `x` is an animated property (the default `numbers` animation covers `['x','y',…]`).

2. **Each dataset's x-animations start at a different time.** `chart.update()` updates datasets one after
   another (`_updateDatasets`, l.6025). Every animation takes its own `Date.now()` when it is created
   (`Animation` constructor l.178, `_createAnimations` l.306/311). Updating 9 × 330 points takes a while, so
   later datasets start later. Measured in the repro (headless Chromium): `chart.update()` took 121 ms, and the
   x-animation start offsets were 0–12, 12–22, 22–32, …, 79–87 ms for datasets 0…8. Because of that, dataset
   *i* and dataset *i-1* have **slightly different `x` values at the same index** on every frame.

3. **Near the end of the easing curve that difference becomes microscopic but stays non-zero.** Mid-animation,
   the gap between two datasets' `x` values at the same index is about 1e-1 to 1e-3 px, which is harmless. In the
   last few frames of the ease-out curve it shrinks into the 1e-7…1e-9 range. Once a dataset's animation finishes,
   its `x` is set to the exact target value, so two datasets that are *both* finished agree exactly again.

4. **`fill: 'stack'` rebuilds its lower boundary on every frame by interpolating the lines below.**
   `_drawfill` (l.8025) → `_getTarget` → `_buildStackLine` (l.7856) → for each source point, `addPointsBelow` →
   `findPoint(lineBelow, sourcePoint, 'x')` (l.7910) → `lineBelow.interpolate(sourcePoint, 'x')` (l.7016).

5. **`interpolate()` returns an array when x lands within epsilon of a vertex but isn't equal to it.**
   `interpolate` calls `_boundSegments(line, {start: x, end: x})` (helpers l.2574), and `_boundSegment`
   (helpers l.2519) mixes two kinds of comparison. It uses the epsilon-tolerant `_isBetween(…, epsilon = 1e-6)`
   (helpers l.438) to decide *inside*, but exact `compare(a, b) === 0` to decide where a sub-segment starts. For
   `x = vertex ± δ` with `0 < δ ≤ 1e-6` it therefore matches **both** neighbouring segments `[j-1, j]` and
   `[j, j+1]`, and `interpolate` returns `[p, p']` instead of `p`. Reproduced in isolation:

   ```
   interpolate at x=10+0:      {"x":10,"y":101}                       <- single point
   interpolate at x=10+1e-12:  ARRAY of 2                             <- bug window
   interpolate at x=10+1e-9:   ARRAY of 2
   interpolate at x=10+1e-6:   ARRAY of 2
   interpolate at x=10+2e-6:   {"x":10.000002,"y":101.0000002}        <- single point again
   ```

6. **`findPoint` treats the array as a point.** `point[property]` on an array is `undefined`, and the array is
   pushed into the synthetic stack line with `x`/`y` = `undefined`.

7. **A single malformed point removes the whole band.** In `fill()` (l.8152) → `_segments(line, target)`
   (l.7640), the target line is split into sub-segments at the bad point (`ok→ARR`, `ARR→ok`). Each sub-segment's
   bounds now include `undefined`, so `_boundSegment(sourceSegment, …, subBounds)` finds no overlap. `_segments`
   returns **0 fill parts** and nothing is painted for that dataset. With `borderWidth: 0` the dataset is then
   completely invisible.

8. **Why the collapse cascades and then rebuilds in array order.** Band *i* breaks while `x_i` and `x_{i-1}`
   differ by a tiny non-zero amount. It recovers as soon as datasets *i* and *i-1* have both finished (exactly
   equal `x`). The animations finish in the same staggered order they started (0, 1, 2, …), so the bands come
   back in array order. Dataset 0 never breaks: its stack target is just the axis line, built from dataset 0's
   own segments.

### Per-frame evidence (instrumented Chart.js build; switch to "absolute", 9 datasets × 330 points)

`anim` = dataset still has an active x-animation (`A`) or has finished (`.`). `badStackPts` = number of
array/NaN points in that dataset's synthetic stack line. `px` = that band's pixel count in a sampled column.

```
t= 988ms  px=[62,33,10,4,11,21,26,24,52]  anim=AAAAAAAAA  badStackPts=[0,0,0,0,0,0,0,0,0]
t=1020ms  px=[64, 0, 0,7,11,21,26,25,52]  anim=AAAAAAAAA  badStackPts=[0,1,1,0,0,0,0,0,0]
t=1050ms  px=[64, 0, 0,0, 0, 0, 0,26,52]  anim=AAAAAAAAA  badStackPts=[0,15,6,3,1,1,1,0,0]
t=1079ms  px=[64, 0, 0,0, 0, 0, 0, 0, 0]  anim=AAAAAAAAA  badStackPts=[0,328,328,34,8,7,4,2,1]   <- "only dataset 0"
t=1107ms  px=[62,32,12,0, 0, 0, 0, 0, 0]  anim=...AAAAAA  badStackPts=[0,0,0,139,328,138,32,12,7]
t=1139ms  px=[62,32,10,4,11,22, 0, 0, 0]  anim=......AAA  badStackPts=[0,0,0,0,0,0,225,328,324]
t=1170ms  px=[62,32,10,4,11,21,26,24,52]  anim=.........  badStackPts=[0,0,0,0,0,0,0,0,0]
```

Every frame with a missing band has malformed stack points for exactly that band, and no frame without
malformed points has a missing band. The per-band fill-part count is 0 for broken bands and 1 for healthy ones.

## Bisection (all with the identity-preserving `setDatasets` update)

| Variant | Band drops? | Takeaway |
|---|---|---|
| Baseline (`stack`, 9 ds × 330 pts, tension 0) | yes, 4–6 frames per switch | reproduced headless |
| 2 datasets | yes | one dataset below is enough |
| 4 points per dataset | yes (fewer frames) | point count doesn't matter |
| `y.stacked: false`, still `fill: 'stack'` | yes (malformed stack points) | `stacked: true` isn't needed; only the `'stack'` fill mode matters |
| `beginAtZero: false` | yes | irrelevant |
| **Identical data**, only the y-axis width toggles 60 ↔ 80 px (`afterFit`) | **yes** | the value change is irrelevant; **the animated x shift is the trigger** |
| Identical data, no layout change | no (nothing animates) | – |
| Magnitude jump, but y-axis width pinned (`afterFit`) | no | x never moves, so no bug |
| `animations: { x: { duration: 0 } }` | no | x snaps, so all datasets always agree exactly |
| `Date.now` frozen during `chart.update()` (diagnostic only) | no | proves the staggered start times are what enables it |
| `fill: 'origin'` / `'-1'` | no | doesn't use `_buildStackLine` |
| Chart.js patched: `findPoint` takes `point[0]` when it gets an array | no | fixes the actual defect |

## Checking the working hypothesis

- **Right:** it is specific to `'stack'`, it depends on the sequential per-dataset update order, and dataset 0 is
  immune because nothing sits below it. The cascade and array-order rebuild come from the dataset
  dependency chain, and tension and Bezier curves play no part.
- **Not quite:** it is **not** a stale read of dataset *i-1*'s state captured during `update()`. The stack
  boundary is rebuilt from the *current* animated positions on every draw. The update order matters only because
  it staggers each dataset's animation start time by a few ms. That produces tiny `x` disagreements between
  datasets, which fall into an epsilon edge case in `_boundSegment`/`interpolate`, and `findPoint` doesn't
  handle the resulting array.
- It also explains finding #4. When the datasets array is replaced with fresh objects there is no "from" state,
  so `x` never animates and the bug can't occur.
- It is also **not specific to the %↔absolute switch.** Any animated update that moves points horizontally will
  do it: changing y-tick label width, a left/right legend changing size, x-label rotation changes, or
  adding/removing labels.

## Fix options, best first

1. **`fill: index === 0 ? 'origin' : '-1'`** (keep `scales.y.stacked: true`). *Recommended.*
   - Pure config. Fills each band down to the previous dataset's line instead of building an interpolated stack
     boundary, so the broken code path is never used.
   - Verified: 0 dropped frames across every sampled column (1%, 25%, 50%, 75%, 99% of the width). Stays clean
     even with a deliberate 1e-9 px nudge.
   - At rest it is **pixel-identical** to `'stack'` in both representations: only 5 anti-aliasing pixels differ,
     all at alpha ≤ 11/255. It is also identical with datasets hidden via the legend (hidden `[0]`, `[3]`,
     `[3,4]`, `[0,1,8]`: 0 visibly different pixels), because `plugins.filler.propagate` (default `true`)
     re-targets past hidden datasets.
   - Caveats: `'-1'` refers to the previous *array index*, not "the dataset below in the same stack group". With
     multiple stack groups on one axis, or `null` gaps in the data, `'stack'` and `'-1'` can differ. Neither
     applies to a single `stack: 'interprets'` group of weekly counts. Keep dataset 0 on `'origin'` (or `'start'`).
   - Side benefit: the filler no longer interpolates N-1 lines per band per frame, so drawing is cheaper. The same
     animation ran at about 2× the frame count in headless Chromium.

2. **Keep `fill: 'stack'`, don't animate x:** `options.animations = { x: { duration: 0 } }`. Verified clean.
   Cost: the few-pixel horizontal shift (y-axis width change) snaps instantly while y still animates.

3. **Keep `fill: 'stack'`, pin the y-axis width:** `scales.y.afterFit = (s) => { s.width = 60; }`. Verified
   clean for this trigger only. Any other horizontal layout change (legend, labels) would still set it off.

4. **Patch Chart.js** (`chart.js+4.5.1.patch`, patch-package format, applies to `dist/chart.js` and
   `dist/chart.cjs`). Verified clean with `fill: 'stack'` unchanged. Only worth doing if `'stack'` semantics are
   really needed (multiple stack groups, `null` gaps). It won't cover the CDN `chart.umd.min.js` build.

5. **Last resort (already known):** `fill: 'origin'` on every dataset. No flicker, but the semi-transparent bands
   overlap all the way down to the axis, which is its own visual problem in the application.

## Upstream

I found no existing Chart.js issue describing this. The closest is
[chartjs/Chart.js#12147](https://github.com/chartjs/Chart.js/issues/12147) (a Chrome-only tension+fill edge
glitch), which is different. `findPoint` on `master` is unchanged from 4.5.1. The ready-to-file report is in
[`upstream-issue.md`](upstream-issue.md), and [`minimal-repro.html`](minimal-repro.html) is the attachment.

## Files

- `minimal-repro.html`: 2 datasets, stock Chart.js 4.5.1 from the CDN, the vue-chartjs `setDatasets` update
  verbatim, a per-frame "band missing" log, a deterministic 1e-9 px nudge button (reproduces with no
  animation at all), and a checkbox to A/B the `'origin'`/`'-1'` workaround.
- `jsfiddle/`: the original demo simplified for JSFiddle. It has 9 example datasets and only the
  Relative/Absolute toggle, keeps the vue-chartjs update path, and is all in English. `fiddle.html`, `fiddle.css`
  and `fiddle.js` are the three panes. Open `open-in-jsfiddle.html` in a browser and click the button to get a
  prefilled fiddle, then press Save there. After editing a pane, run `build-launcher.py` to regenerate the
  launcher.
- `upstream-issue.md`: bug report draft for chartjs/Chart.js, including the proposed source fix and test results.
- `chartjs-upstream-fix.patch`: fix plus regression test against the Chart.js source tree (`src/` + `test/specs/`).
  Applies with `git apply` to v4.5.1 and to `master`. The new test fails without the fix and passes with it on
  both, and the full v4.5.1 suite (1686 specs) passes.
- `chart.js+4.5.1.patch`: patch-package patch for the `findPoint` fix in an app's `node_modules` (no tests; those
  live in the upstream patch).

## How this was verified

Everything ran in headless Chromium (Playwright). The CDN script was served from `npm install chart.js@4.5.1`
(the stock `chart.umd.min.js`), plus an esbuild bundle of the same package with counters inserted into
`_buildStackLine`, `fill()`, `clipBounds()`. A global plugin sampled a 1-px canvas column in `afterDraw` on every
frame and classified pixels by dataset colour. requestAnimationFrame fired normally in headless Chromium, with no
sign of the rAF starvation seen in the in-app browser pane.
