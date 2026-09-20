# Signal Machine Visual Playground v0.5

Hosted experiment:

https://axm-signal-loom-playground-1uwyt4.v2.appdeploy.ai/

## What changed

The browser surface now represents the Signal Machine itself instead of a prompt-driven demo.

It exposes ten native source organs with:

- explicit enable/disable
- influence weight
- provenance where required
- visible input boundary

The default organs match the Python registry:

- Browser Local
- Source Material
- Working Chat
- Simulation State
- Internet Eye
- Connector Packet
- File Packet
- Model Output
- Sensor
- Custom

## Capture session

**Capture + weave** freezes the enabled source packets and normalizes their weights into a replayable influence receipt.

The frozen session shows:

- session fingerprint
- recipe fingerprint
- normalized source percentages
- per-source packet fingerprints
- provenance
- reduced source packets

**Weave frozen session** changes nothing about the sources. It only reinterprets the already-frozen session using the current seed, chaos and optional intent bias.

## Internet Eye

Internet Eye accepts Shodan-compatible JSON and reduces it before the session is exposed.

The frozen session contains aggregate internet influence, not raw IPs, hostnames, organization names or banner text.

There is no live Shodan credential in this public playground.

## Working-chat bridge

A working chat can open the playground and either fill the Working Chat organ directly or use the existing URL bridge:

- `?packet=<URL-encoded JSON>`
- `?source=<URL-encoded text>`
- `?intent=...`
- `?seed=...`
- `?chaos=...`

Working Chat is just one weighted source. It does not replace the other organs or gain promotion authority.

## Persistence

Nothing is silently saved.

The **Save session locally** button explicitly writes only the currently frozen session to browser local storage. **Load saved session** explicitly restores it.

## Render modes

- ribbon
- bloom
- shards
- orbit
- terrain
- mesh
- constellation

## Boundary

Browser packet/session format: `axm.signal-machine.session/0.5` and `axm.signal-loom.browser/0.5`.

The browser and Python machines share the v0.5 architecture but are not yet bit-identical across runtimes.

**Sources feed the Magnet. The Loom proposes. The consuming project decides.**
