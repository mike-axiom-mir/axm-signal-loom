# Signal Loom Architecture v0.1

Signal Loom is deliberately separate from Universal Creation, MorphTile, games, world builders, and other consumers. It is a source of bounded proposals, not a project authority.

## Flow

1. A caller supplies a request, seed, draft index, signal width, and chaos value.
2. The loom derives deterministic concept, noise, and oscillator signals.
3. Bounded transforms mix, cross-map, and mutate those signals.
4. The loom emits a portable creativity packet with a stable fingerprint.
5. A cheap SVG preview may be produced for inspection.
6. The consuming project decides whether to reject, refine, vault, render, or promote the proposal.

## Root rules

- **Replayable surprise:** randomness must be seeded and recoverable.
- **Proposal, not authority:** Signal Loom never silently mutates a consuming project.
- **Bounded chaos:** public APIs constrain chaos and signal values.
- **Portable output:** JSON packets are the integration boundary.
- **Cheap exploration first:** preview hundreds of ideas before spending expensive render or model compute.
- **No fake intelligence:** v0.1 uses deterministic procedural signals; it does not claim to capture neural activations.
- **Future adapters, not coupling:** audio, image, embeddings, model activations, physics, UI gestures, and project state should enter through adapters rather than becoming core dependencies.

## Packet identity

A packet fingerprint covers the recipe inputs, source signals, operations, and final field. Repeating the same recipe produces the same packet and fingerprint.

## Intended future adapters

- audio rhythm / spectrum
- image edges / palette / masks
- geometry / transforms
- animation curves
- physics fields
- embeddings
- local-model activation probes where technically and legally appropriate
- game and world state
- human gestures / controller input

Adapters should normalize into bounded numeric signal arrays and preserve source/provenance metadata.
