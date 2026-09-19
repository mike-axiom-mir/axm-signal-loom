from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class Signal:
    name: str
    values: tuple[float, ...]
    tags: tuple[str, ...] = ()

    def as_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "values": [round(value, 8) for value in self.values],
            "tags": list(self.tags),
        }


@dataclass(frozen=True)
class CreativityPacket:
    version: str
    seed: int
    draft: int
    request: str
    chaos: float
    width: int
    signals: tuple[Signal, ...]
    field: Signal
    operations: tuple[str, ...]
    fingerprint: str

    def as_dict(self) -> dict[str, Any]:
        return {
            "version": self.version,
            "seed": self.seed,
            "draft": self.draft,
            "request": self.request,
            "chaos": self.chaos,
            "width": self.width,
            "signals": [signal.as_dict() for signal in self.signals],
            "field": self.field.as_dict(),
            "operations": list(self.operations),
            "fingerprint": self.fingerprint,
        }
