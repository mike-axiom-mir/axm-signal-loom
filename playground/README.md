# Signal Loom Visual Playground

Hosted experiment: https://axm-signal-loom-playground-1uwyt4.v2.appdeploy.ai/

## v0.3 experiment

The playground is now **capture-first** rather than prompt-first.

Visible local browser signals feed the Signal Magnet:

- pointer position
- pointer motion
- scroll position
- viewport ratio
- clock phase

It also accepts:

- arbitrary source material text
- a generic external JSON signal packet from a working chat, connector, local tool, web research process, simulation, sensor bridge, or anything else able to produce JSON

The Magnet freezes those sources into a capture fingerprint. The Loom then generates visual drafts from that frozen capture. Intent text is optional and only biases the result.

## Render modes

- ribbon
- bloom
- shards
- orbit
- terrain
- mesh
- constellation

Click a result to inspect the full captured source packet, capture fingerprint, seed, chaos, visual field and result fingerprint.

## Boundary

The browser packet format is `axm.signal-loom.browser/0.3`.

The browser and Python v0.3 core share the source-first architecture but are not yet bit-identical across runtimes. The playground also does not silently fetch URLs or private data: outside systems must explicitly provide source material or a signal packet.

**Sources feed the Magnet. The Loom proposes. The consuming project decides.**
