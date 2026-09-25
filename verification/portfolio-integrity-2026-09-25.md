# Detach frozen captures from caller and exported payloads

Date: 2026-09-25 UTC

Base commit: `60858114f8495a2ec194919b162e7db9f8e9e1c2`

Status: experimental repair, not merged or promoted.

## Observed failure

Both legacy and weighted captures retained aliases to nested caller payloads. Mutating a caller payload changed a supposedly frozen capture without changing its stored fingerprint. The corrected regression also reproduced session aliasing.

## Repair

Capture boundaries copy source payloads and recipes; dictionary exports copy nested payloads. Existing valid capture identities are preserved and the detached session still replays exactly.

## Verification

Command: `PYTHONPATH=src:. python -m unittest discover -s tests -v`

18 tests passed. Direct mutation of objects owned by a returned dataclass is outside this bounded ownership repair; this does not claim deep immutability or browser-runtime parity.

Regression tests exercise invalid input and valid-state continuity. The full repository command above passed on the repaired working tree. No production-readiness, deployment, or CANON claim is made.
