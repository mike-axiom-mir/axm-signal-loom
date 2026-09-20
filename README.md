# AXM Signal Loom

**Fast, replayable creative chaos that can feed any project.**

Signal Loom is a separate AXM machine for generating bounded, deterministic creativity signals. It does not own Universal Creation, MorphTile, a game, a renderer, or any other consumer. A project asks for variation; the Loom proposes possibilities; the project decides what survives.

> **Root boundary:** the Loom proposes. The consuming project decides.

## v0.1

The first implementation is intentionally small and offline:

- deterministic concept signals from text
- seeded noise signals
- oscillator/rhythm signals
- weighted mixing
- cross-mapping
- bounded mutation
- reproducible JSON creativity packets
- stable SHA-256 packet fingerprints
- cheap SVG inspection previews
- batch generation for rapid draft exploration
- zero runtime dependencies

This is not yet neural-signal capture. Neural/model adapters belong later, behind explicit adapters and provenance boundaries.

## Visual playground

Open the live browser experiment:

https://axm-signal-loom-playground-1uwyt4.v2.appdeploy.ai/

It generates multiple replayable visual drafts from a prompt, seed and chaos value. The browser source is preserved in [playground/](playground/).

The browser v0.2 runtime is deterministic within itself but is not yet bit-identical to the Python v0.1 generator; that boundary is documented rather than hidden.

## Try it

Python 3.11+ is enough.

```bash
PYTHONPATH=src python -m signal_loom \
  --prompt "storm ceramic insect jazz" \
  --seed 4837291 \
  --count 12 \
  --chaos 0.72 \
  --out loom-output
```

The output directory receives one JSON packet and optional SVG preview per draft plus a manifest.

Run the exact command again and every packet fingerprint and field value will replay exactly.

## Integration

```python
from signal_loom import SignalLoom

loom = SignalLoom(width=64)
packet = loom.draft(
    "unusual vehicle idea",
    seed=4837291,
    draft=7,
    chaos=0.65,
)

# The caller chooses what to do next.
print(packet.fingerprint)
print(packet.field.values)
```

The JSON packet is the generic handoff format. Consumers can map its bounded field into geometry, color, motion, procedural parameters, game RNG, music, layout, simulation settings, or other project-specific meanings.

## Why keep it separate?

A shared Loom can service many projects without any one project becoming its architecture. It also keeps experimentation disposable: thousands of temporary combinations can exist without entering a project's permanent state.

Interesting outputs become permanent only when the consumer explicitly promotes them.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the current boundary and future adapter direction.

## License

PolyForm Noncommercial License 1.0.0. See [LICENSE.md](LICENSE.md).
