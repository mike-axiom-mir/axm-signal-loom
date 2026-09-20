# Signal Machine Architecture v0.5

Signal Loom remains deliberately separate from Universal Creation, MorphTile, games, world builders and other consumers. v0.5 adds a native machine layer around the Magnet and Loom so source handling is explicit, weighted, replayable and inspectable.

## Machine flow

```text
AUTHORIZED SOURCE CHANNELS
internet research / browser / local / files / connectors /
working chats / models / simulations / sensors / custom
                         |
                    source organs
                         |
                    SOURCE REGISTRY
               identity + mode + boundary
                         |
                  CAPTURE RECIPE
             payload + weight + provenance
                         |
                    SIGNAL MAGNET
          normalize + weight + freeze + receipt
                         |
                    CAPTURE SESSION
       recipe fp + capture fp + contribution receipts
                         |
                     SIGNAL LOOM
       optional intent bias + seeded bounded mutation
                         |
                TEMPORARY PROPOSALS
                         |
                  consuming project
                reject/refine/promote
```

A prompt is not a source. Intent text may optionally bias interpretation after capture.

## Source registry

`SourceRegistry` makes the machine aware of its source organs rather than relying on ad-hoc caller conventions.

Each `SourceOrganSpec` declares:

- stable organ id
- human label
- source kind
- operating mode
- description
- whether provenance is required
- whether it is enabled by default

The default registry contains ten organs:

`browser-local`, `source-material`, `working-chat`, `connector-packet`, `file-packet`, `simulation-state`, `model-output`, `sensor`, `internet-eye`, and `custom`.

## Capture recipe

A `CaptureRecipe` contains one or more `SourceInput` records.

Each source input preserves:

- organ id
- JSON-serializable payload
- requested weight
- optional label
- provenance

The recipe receives a deterministic fingerprint. Weight zero disables that input for the capture. Negative weights are rejected.

## Weighted Magnet

`SignalMagnet.capture_weighted(...)` normalizes all positive weights so their contribution totals 1.0.

Every frozen capture records a `SourceContribution` receipt containing:

- source id
- label
- normalized influence weight
- packet fingerprint
- provenance

Changing a payload, provenance-bearing packet, source set, or weight changes the resulting capture fingerprint.

The older equal-weight v0.3 capture path remains unchanged for replay continuity.

## Capture session

A `CaptureSession` binds:

- the complete recipe
- recipe fingerprint
- weighted source capture
- capture fingerprint
- capture timestamp
- session fingerprint

The session fingerprint intentionally binds the recipe and capture, not wall-clock time. Replaying an exported session reconstructs the capture from the recipe and fails if the recorded fingerprints do not match.

This is the continuity boundary that allows live inputs to become recoverable creative accidents.

## Working-chat bridge

A working chat is one source organ among many.

It does not gain merge or creative authority by being an AI source. Its packet must include provenance and receives an explicit weight like every other source.

Example packet payload:

```json
{
  "themes": ["collapse", "repair", "metallic rain"],
  "weights": [0.7, 0.4, 0.8]
}
```

The machine can blend that packet with browser state, simulations, public internet aggregates or other sources.

## Internet Eye

Internet Eye is now a native registered source organ.

The machine accepts a Shodan-compatible response or matches array, then runs the target-blind reducer before capture.

Preserved aggregate features:

- port mix
- transport mix
- country mix
- product mix
- organization diversity
- banner diversity
- TLS share
- unique-port ratio
- unique-product ratio

Not preserved in the emitted Internet Eye packet:

- raw IP addresses
- hostnames
- organization names
- raw banner text

The organ performs no network request, active scan, host lookup, vulnerability check or exploit logic. Retrieval stays with an authorized caller/source connection.

## Loom

The Loom consumes the frozen weighted field and may add:

- optional intent bias
- seeded RNG
- oscillators/rhythm
- bounded mutation
- cross-mapping
- project-selected interpretation layers

The captured source field remains the dominant input.

## Browser machine

The hosted v0.5 playground mirrors the architecture visibly:

- ten source-organ cards
- explicit enabled state
- per-organ weight
- provenance fields
- frozen session receipt
- normalized influence bars
- inspectable reduced packets
- explicit local save/load
- no automatic persistence
- re-weave without recapture
- target-blind Internet Eye reduction before session exposure

The browser and Python runtimes are deterministic within themselves but are not yet bit-identical.

## Root rules

- **Truth:** distinguish real source capture, aggregate reduction and procedural mutation; never claim unavailable source access.
- **Agency / non-domination:** source access is explicit; source weights are visible; proposals never silently mutate consuming projects.
- **Continuity:** recipes, sessions, contributions, seeds and fingerprints preserve replay.
- **Wisdom before speed:** cheap source fields and proposals precede expensive downstream generation.
- **Provenance:** sources requiring external authority fail closed without provenance.
- **No hidden collection:** the runtime exposes which organs are enabled and what is frozen.
- **Bounded chaos:** weights and fields are normalized/bounded; mutation remains bounded.

## Current boundary

The machine has a native Internet Eye organ, but the public playground does not contain a live Shodan credential or private source connection.

A connected working chat, connector, local process, sensor bridge or future secure backend may gather information through its own authorized capability and feed the relevant organ.

No source organ grants itself permission.
