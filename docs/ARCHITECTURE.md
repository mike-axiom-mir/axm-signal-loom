# Signal Loom Architecture v0.3

Signal Loom is deliberately separate from Universal Creation, MorphTile, games, world builders, and other consumers. It generates bounded proposals; it does not own the systems that consume them.

## Correct flow

```text
INTERNET / LOCAL / CONNECTORS / FILES / SENSORS / MODELS / SIMULATIONS
                              |
                         source adapters
                              |
                         SIGNAL MAGNET
                    capture + provenance + freeze
                              |
                     replayable source field
                              |
                         SIGNAL LOOM
             mix + cross-map + mutate + oscillate
                              |
                     temporary visual/data drafts
                              |
                       consuming project
                    reject / refine / promote
```

A prompt is **not** the source. Text intent may optionally bias interpretation after capture.

## Source adapter contract

The Python core exposes `SourcePacket` with:

- `source`: source class such as `web`, `local`, `connector`, `sensor`, `model`, `simulation`, `custom`
- `label`: human-readable description
- `payload`: JSON-serializable source material
- `provenance`: optional source/provenance note

Signal Magnet never grants itself access to a system. The caller obtains data through an authorized channel and hands the resulting packet to the Magnet.

## Capture

A capture:

1. receives one or more explicit source packets;
2. normalizes them into one bounded numeric field;
3. fingerprints the packet set and field;
4. freezes the result for replay;
5. passes that frozen source field to the Loom.

Live signals are useful only if the capture is preserved. Otherwise "live randomness" becomes unrecoverable noise.

## Loom

The Loom may add:

- optional intent bias
- seeded RNG
- oscillators / rhythm
- bounded mutation
- cross-mapping
- project-selected interpretation layers

Intent is deliberately weaker than the captured field.

## Root rules

- **Truth:** distinguish real source capture from procedural generation and never claim unavailable internal model signals.
- **Agency / non-domination:** source access is explicit; Loom output is a proposal; consuming projects decide whether anything survives.
- **Continuity:** source packets, captures, seeds, operations and fingerprints support replay and diagnosis.
- **Wisdom before speed:** cheap exploratory fields come before expensive downstream creation.
- **Provenance:** adapters should retain where a signal came from.
- **Bounded chaos:** public APIs constrain signal fields and mutation.
- **No hidden collection:** a runtime should expose what it captures.

## Current boundaries

The browser playground captures visible browser-local signals and accepts source material / external JSON packets. It does not autonomously browse the internet or open private connections.

A working chat, connector, local process, sensor bridge or future adapter can gather information through its own authorized capability and submit a source packet.

The Python and browser runtimes are deterministic inside themselves but are not yet cross-runtime bit-identical.
