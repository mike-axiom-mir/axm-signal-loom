# Signal Loom Visual Playground

Hosted experiment: https://axm-signal-loom-playground-1uwyt4.v2.appdeploy.ai/

This folder preserves the source of the first browser-visible Signal Loom experiment.

## Purpose

The playground turns prompt + seed + chaos into multiple disposable visual interpretations. It is a curiosity surface for testing whether Signal Loom can produce useful or surprising artistic directions quickly.

Current browser render modes:

- ribbon
- bloom
- shards
- orbit
- terrain
- mesh
- constellation

Clicking a draft exposes a replay packet with its seed, chaos value, field, render mode and fingerprint.

## Boundary

The browser runtime currently uses a small deterministic JavaScript PRNG and packet format `axm.signal-loom.browser/0.2`. It follows the same seeded/replayable design as the Python core, but it is **not yet cross-runtime bit-identical** with the Python v0.1 generator.

That difference is explicit rather than hidden. A later convergence pass can move both runtimes onto one shared deterministic algorithm if the experiment proves useful.

**The Loom proposes. The consuming project decides.**
