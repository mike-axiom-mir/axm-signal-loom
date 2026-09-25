# AXM Signal Loom

**Many eyes. One frozen accident.**

Signal Loom is a separate AXM creativity machine. Its input is not a prompt. A native **Signal Machine** owns a registry of source organs, explicitly captures and weights the sources a caller provides, freezes the mixture into a replayable session, then hands that session to the Loom for bounded creative mutation.

> **Root boundary:** sources feed the Magnet. The Loom proposes. The consuming project decides.

## v0.6 — Frozen Weave + Live Weave

Signal Machine now exposes two first-class presentations over the same explicit source organs:

- **Frozen Weave — memory:** fingerprinted, inspectable, replayable CaptureSessions and deterministic Loom proposals.
- **Live Weave — motion:** a separate ephemeral rolling source field with Flow Field, Particle Current, and Liquid Mesh renderers.
- Live Weave keeps only the latest valid signal per organ and never silently overwrites Frozen Weave state.
- **Freeze this moment** is the explicit bridge from live motion into the normal replayable CaptureRecipe/CaptureSession path.
- Live controls include smoothing, trail/memory, intensity, chaos, speed, color drift, play/pause, fullscreen, and a compact influence panel.
- Internet Eye capture packets are target-blind aggregates; frozen session recipes retain caller-supplied sources for replay (see the retention boundary below). No live Shodan connection is implied.
- The browser and Python live runtimes follow the same architecture but are not claimed bit-identical.

See [docs/LIVE_WEAVE.md](docs/LIVE_WEAVE.md) for the live runtime and truth boundaries.

## v0.5 — native Signal Machine

v0.5 promotes the source system from helper functions into one machine contract:

- native `SignalMachine` facade
- ten registered source organs
- explicit per-source weights
- normalized influence receipts
- provenance requirements for connector/model/sensor/working-chat sources
- replayable `CaptureRecipe` and `CaptureSession`
- exact session/capture/recipe fingerprints
- working-chat packet bridge
- target-blind Internet Eye as a native source organ
- weighted `SignalMagnet.capture_weighted(...)`
- recipe-driven CLI
- browser source registry + influence breakdown
- explicit save/reload of frozen browser sessions
- no automatic project mutation or promotion
- zero Python runtime dependencies

The legacy equal-weight `SignalMagnet.capture(...)` and text-first `weave(...)` APIs remain for continuity. New integrations should use `SignalMachine`.

## Native source organs

The default registry currently exposes:

- `browser-local`
- `source-material`
- `working-chat`
- `connector-packet`
- `file-packet`
- `simulation-state`
- `model-output`
- `sensor`
- `internet-eye`
- `custom`

A source organ does **not** grant itself access. It normalizes data already supplied by an authorized caller, connector, browser, local process, sensor bridge, model seat, or other explicit source.

## Python example

```python
from signal_loom import CaptureRecipe, SignalMachine, SourceInput

machine = SignalMachine(width=64)

recipe = CaptureRecipe(
    name="curious machine ecology",
    inputs=(
        SourceInput(
            "working-chat",
            {"themes": ["metal rain", "repair", "tiny garden"]},
            weight=1.0,
            provenance="working-chat packet",
        ),
        SourceInput(
            "simulation-state",
            {"storm": 0.65, "motion": 0.81},
            weight=0.45,
        ),
        SourceInput(
            "internet-eye",
            shodan_compatible_response,
            weight=0.7,
            provenance="public indexed observations",
        ),
    ),
)

session = machine.capture(recipe)
drafts = machine.weave(
    session,
    seed=4837291,
    count=12,
    chaos=0.72,
    intent="impossible civic garden",  # optional bias only
)

print(session.fingerprint)
print(session.capture.contributions)
print(drafts[0].fingerprint)
```

The Internet Eye payload is reduced before it reaches the capture packet. Raw IP addresses, hostnames, organization names and banner text are not preserved in that aggregate packet.

**Retention boundary:** `CaptureSession.recipe` and saved session JSON retain the caller-supplied Internet Eye input for replay. A complete frozen session is therefore not target-blind. Keep it within the source data's permitted scope; an aggregate-only replay format and migration remain unimplemented.

## Recipe-driven CLI

```bash
PYTHONPATH=src python -m signal_loom.machine_cli \
  --recipe examples/recipes/working-chat-internet-eye.json \
  --seed 4837291 \
  --count 12 \
  --chaos 0.72 \
  --intent "curious machine ecology" \
  --out signal-machine-output
```

The output includes:

- `capture-session.json`
- proposal JSON packets
- SVG inspection previews
- a manifest binding recipe/session/seed/intent/chaos to the generated proposals

## Visual playground

Live experiment:

https://axm-signal-loom-playground-1uwyt4.v2.appdeploy.ai/

The v0.5 browser surface exposes the machine directly:

- enable/disable source organs
- weight every enabled organ
- supply provenance where required
- freeze a capture session
- see normalized influence percentages
- inspect reduced source packets
- save/reload a session only when explicitly requested
- re-weave a frozen session without silently recapturing live state
- pass source/working-chat data through URL inputs
- inspect proposal packets and fingerprints

The browser and Python implementations share the v0.5 machine architecture but are **not yet bit-identical across runtimes**. That remains an explicit boundary.

## Internet Eye

Internet Eye is a native organ, not a side helper.

It consumes already-obtained Shodan-compatible observations and reduces them to coarse artistic influence such as:

- port mix
- transport mix
- country mix
- product mix
- organization diversity
- banner diversity
- TLS share
- unique-port ratio
- unique-product ratio

It performs no active scans, vulnerability checks, exploit logic, or autonomous host lookups.

Live Shodan retrieval is **not configured** in the public playground because no authorized credential/source connection is installed there. A caller with legitimate access may supply observations through the organ.

## Why keep it separate?

A shared Signal Machine can feed games, art, music, world generation, interfaces, animation, simulation and other projects without any one consumer becoming its architecture.

Temporary combinations remain disposable. A consuming project explicitly decides whether any proposal becomes permanent.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## License

AXM-owned Signal Loom software is licensed under the Mozilla Public License 2.0 (MPL-2.0). Third-party material, if any, remains under its own terms.
