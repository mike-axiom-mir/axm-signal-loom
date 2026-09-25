# Live Weave v0.6

Live Weave is the second presentation mode of Signal Machine.

It is deliberately **not** a replacement for Frozen Weave.

## Two honest personalities

### Frozen Weave — memory

```text
source organs
  -> weighted recipe
  -> frozen CaptureSession
  -> deterministic Loom proposals
```

Frozen Weave remains fingerprinted, replayable, inspectable and suitable for receipts/export.

### Live Weave — motion

```text
active source organs
  -> latest valid source samples
  -> rolling weighted target field
  -> smoothed ephemeral field
  -> animated renderer
```

Live Weave is reactive and disposable. It does not silently become source history.

## Runtime contract

The Python `LiveWeaveState` keeps one latest valid `SourceInput` per organ. A rejected update does not replace the last valid sample. Source updates recompute a deterministic weighted target field; `tick()` interpolates toward that target for presentation.

The browser mirrors that contract over the existing v0.5 source controls. It samples source state at a bounded cadence and renders with `requestAnimationFrame`.

The browser and Python live runtimes are conceptually aligned but are not claimed bit-identical.

## Freeze bridge

`Freeze this moment` does not save a screenshot.

It invokes the existing Frozen Weave capture path using the current source controls. That creates a normal:

- `CaptureRecipe`
- `CaptureSession`
- recipe fingerprint
- capture fingerprint
- normalized influence receipt
- replayable Frozen Weave state

The running live field itself remains ephemeral.

## Browser renderers

v0.6 starts with three interpretations of the same rolling field:

- **Flow Field** — layered moving current lines
- **Particle Current** — particles advected by the field
- **Liquid Mesh** — a deforming connected grid

Presentation controls include play/pause, smoothing, trail/memory, intensity, chaos, speed, color drift, render mode and fullscreen.

## Source timing

Sources do not need a shared update frequency.

The browser source sampler runs at a bounded cadence while each organ keeps its latest valid state. Browser-local motion changes frequently; manually supplied packets remain static until replaced.

Rendering continues even when no source changes.

## Truth boundaries

- Live Weave is labeled **LIVE / EPHEMERAL**.
- Frozen Weave remains **FROZEN / REPLAYABLE**.
- Missing enabled organs remain waiting rather than failing the whole field.
- External/provenance-required packets remain invalid until provenance exists.
- Working Chat has no extra authority.
- Internet Eye is reduced to target-blind aggregate data before live-field contribution.
- There is no live Shodan connection in this mode.
- Fullscreen is presentation only.
- No video recording/export claim is made in v0.6.

## Performance boundary

The browser uses:

- one canvas
- bounded particle count
- source sampling around 10 Hz
- source target recomputation only when source/weight state changes
- frame-rate smoothing/rendering via `requestAnimationFrame`
- no per-frame external source work

Recording remains a later feature, after runtime/visual acceptance.
