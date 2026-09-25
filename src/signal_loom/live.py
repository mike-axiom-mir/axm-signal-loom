from __future__ import annotations

from dataclasses import dataclass
from time import time
from typing import Any

from .machine import CaptureRecipe, CaptureSession, SignalMachine, SourceInput
from .model import Signal, SourceContribution


LIVE_STATE_VERSION = "axm.signal-machine.live/0.6"


def _clamp(value: float) -> float:
    return max(-1.0, min(1.0, value))


@dataclass(frozen=True)
class LiveSourceSample:
    source: SourceInput
    updated_at: float

    def as_dict(self) -> dict[str, Any]:
        return {
            "organ_id": self.source.organ_id,
            "weight": round(self.source.weight, 8),
            "label": self.source.label,
            "provenance": self.source.provenance,
            "updated_at": self.updated_at,
        }


class LiveWeaveState:
    """Disposable rolling source state for presentation, not a replay receipt.

    Each organ keeps only its latest valid packet. Source updates recompute a
    deterministic target field; tick() interpolates toward that field. Calling
    freeze() is the explicit bridge into the normal replayable CaptureSession.
    """

    def __init__(
        self,
        *,
        machine: SignalMachine | None = None,
        smoothing: float = 0.18,
        decay: float = 0.2,
        intensity: float = 1.0,
        chaos: float = 0.35,
        live_seed: int = 1,
    ) -> None:
        if not 0.0 <= smoothing <= 1.0:
            raise ValueError("smoothing must be between 0 and 1")
        if not 0.0 <= decay <= 1.0:
            raise ValueError("decay must be between 0 and 1")
        if not 0.0 <= intensity <= 2.0:
            raise ValueError("intensity must be between 0 and 2")
        if not 0.0 <= chaos <= 1.0:
            raise ValueError("chaos must be between 0 and 1")

        self.machine = machine or SignalMachine()
        self.smoothing = smoothing
        self.decay = decay
        self.intensity = intensity
        self.chaos = chaos
        self.live_seed = live_seed
        self._samples: dict[str, LiveSourceSample] = {}
        self._target = (0.0,) * self.machine.width
        self._smoothed = (0.0,) * self.machine.width
        self._previous = (0.0,) * self.machine.width

    @property
    def samples(self) -> tuple[LiveSourceSample, ...]:
        return tuple(self._samples[key] for key in sorted(self._samples))

    @property
    def source_update_timestamps(self) -> dict[str, float]:
        return {sample.source.organ_id: sample.updated_at for sample in self.samples}

    @property
    def target_field(self) -> Signal:
        return Signal(
            name="live:target",
            values=self._target,
            tags=("live", "ephemeral", "target"),
        )

    @property
    def smoothed_field(self) -> Signal:
        values = tuple(_clamp(value * self.intensity) for value in self._smoothed)
        return Signal(
            name="live:smoothed",
            values=values,
            tags=("live", "ephemeral", "smoothed"),
        )

    @property
    def previous_field(self) -> Signal:
        return Signal(
            name="live:previous",
            values=self._previous,
            tags=("live", "ephemeral", "previous"),
        )

    def push(self, source: SourceInput, *, updated_at: float | None = None) -> None:
        """Accept one valid latest sample without altering any frozen session."""
        self.machine.registry.get(source.organ_id)
        self.machine._adapt_input(source)
        stamp = time() if updated_at is None else float(updated_at)
        self._samples[source.organ_id] = LiveSourceSample(source=source, updated_at=stamp)
        self._recompute_target()

    def remove(self, organ_id: str) -> None:
        self._samples.pop(organ_id, None)
        self._recompute_target()

    def clear(self) -> None:
        self._samples.clear()
        self._target = (0.0,) * self.machine.width

    def influences(self) -> tuple[SourceContribution, ...]:
        weighted = self._weighted_packets()
        if not weighted:
            return ()
        capture = self.machine.magnet.capture_weighted(weighted)
        return capture.contributions

    def tick(self) -> Signal:
        """Advance one presentation step toward the latest deterministic target."""
        self._previous = self._smoothed
        alpha = 1.0 - (1.0 - self.smoothing) * (1.0 - self.decay)
        self._smoothed = tuple(
            _clamp(previous * (1.0 - alpha) + target * alpha)
            for previous, target in zip(self._previous, self._target)
        )
        return self.smoothed_field

    def freeze(
        self,
        *,
        captured_at: str | None = None,
        name: str = "Live Weave freeze",
    ) -> CaptureSession:
        """Convert the latest valid samples into a normal replayable capture."""
        inputs = tuple(
            sample.source
            for sample in self.samples
            if sample.source.weight > 0
        )
        if not inputs:
            raise ValueError("live weave has no positive-weight source to freeze")
        return self.machine.capture(
            CaptureRecipe(inputs=inputs, name=name),
            captured_at=captured_at,
        )

    def as_dict(self) -> dict[str, Any]:
        return {
            "version": LIVE_STATE_VERSION,
            "mode": "live/ephemeral",
            "samples": [sample.as_dict() for sample in self.samples],
            "source_update_timestamps": self.source_update_timestamps,
            "live_seed": self.live_seed,
            "smoothing": self.smoothing,
            "decay": self.decay,
            "intensity": self.intensity,
            "chaos": self.chaos,
            "target_field": self.target_field.as_dict(),
            "smoothed_field": self.smoothed_field.as_dict(),
            "previous_field": self.previous_field.as_dict(),
            "replayable": False,
        }

    def _weighted_packets(self) -> tuple[tuple[Any, float], ...]:
        weighted: list[tuple[Any, float]] = []
        for sample in self.samples:
            if sample.source.weight <= 0:
                continue
            weighted.append(
                (self.machine._adapt_input(sample.source), sample.source.weight)
            )
        return tuple(weighted)

    def _recompute_target(self) -> None:
        weighted = self._weighted_packets()
        if not weighted:
            self._target = (0.0,) * self.machine.width
            return
        capture = self.machine.magnet.capture_weighted(weighted)
        self._target = capture.field.values
