# AXM Signal Loom

**Many eyes. One frozen accident.**

Signal Loom is a separate AXM creativity machine. Its input is not a prompt. A native **Signal Machine** owns a registry of source organs, explicitly captures and weights the sources a caller provides, freezes the mixture into a replayable session, then hands that session to the Loom for bounded creative mutation.

> **Root boundary:** sources feed the Magnet. The Loom proposes. The consuming project decides.

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

The Internet Eye payload is reduced inside the machine before it reaches the frozen session. Raw IP addresses, hostnames, organization names and banner text are not preserved in its output packet.

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
