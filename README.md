# AXM Signal Loom

**Catch signals first. Make art second.**

Signal Loom is a separate AXM creativity machine. Its proper input is not a prompt: a **Signal Magnet** captures explicit source packets from anywhere a caller can legitimately access — local state, internet research, connectors, simulations, sensors, models, files, games, or custom tools — and freezes them into a replayable source field. The Loom then mutates that field into disposable creative proposals.

> **Root boundary:** sources feed the Magnet. The Loom proposes. The consuming project decides.

## v0.3 direction

- generic `SourcePacket` adapter boundary
- deterministic `SignalMagnet` capture
- frozen capture fingerprints
- source-first weaving
- optional intent text as a **bias**, not the source
- seeded noise / oscillators / bounded mutation
- replayable creativity packets
- browser visual playground
- zero Python runtime dependencies

The older `weave("text", ...)` API remains for compatibility and simple experiments. New integrations should prefer `SignalMagnet.capture(...)` + `SignalLoom.draft_capture(...)`.

## Visual playground

Open the live experiment:

https://axm-signal-loom-playground-1uwyt4.v2.appdeploy.ai/

The browser now visibly captures local signals (pointer, motion, scroll, viewport ratio and clock phase), plus optional source material and a generic external JSON packet. It freezes that source state before weaving. Intent text is optional.

The browser v0.3 runtime and Python v0.3 core follow the same architecture but are **not yet bit-identical across runtimes**. That difference remains explicit.

## Python example

```python
from signal_loom import SignalLoom, SignalMagnet, SourcePacket

magnet = SignalMagnet(width=64)
capture = magnet.capture(
    SourcePacket(
        source="web",
        label="weather snapshot",
        payload={"wind": 0.8, "rain": 0.2},
        provenance="public research",
    ),
    SourcePacket(
        source="local",
        label="game state",
        payload={"danger": 0.6, "speed": 0.9},
    ),
)

loom = SignalLoom(width=64)
packet = loom.draft_capture(
    capture,
    seed=4837291,
    draft=7,
    chaos=0.72,
    intent="eerie architecture",  # optional bias only
)

print(capture.fingerprint)
print(packet.fingerprint)
print(packet.field.values)
```

Any connected system can define a source adapter that emits a JSON-serializable `SourcePacket`. The Magnet does not silently fetch or authorize access by itself; the caller controls what sources are available and records provenance.

## Why keep it separate?

A shared Loom can service games, art, music, world generation, UI, animation, simulations, and other projects without any one consumer becoming its architecture.

Temporary combinations stay disposable. Interesting results become permanent only when a consuming project explicitly promotes them.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the current flow.

## License

PolyForm Noncommercial License 1.0.0. See [LICENSE.md](LICENSE.md).
