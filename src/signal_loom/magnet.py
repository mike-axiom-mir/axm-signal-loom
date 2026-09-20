from __future__ import annotations

import hashlib
import json
import random

from .model import Signal, SourceCapture, SourcePacket

CAPTURE_VERSION = "axm.signal-magnet.capture/0.3"


def _stable_json(value: object) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def _seed(value: object) -> int:
    digest = hashlib.sha256(_stable_json(value).encode("utf-8")).digest()
    return int.from_bytes(digest[:8], "big", signed=False)


class SignalMagnet:
    """Capture explicit source packets into one bounded, replayable signal field."""

    def __init__(self, *, width: int = 64) -> None:
        if width < 8:
            raise ValueError("width must be at least 8")
        self.width = width

    def capture(self, *packets: SourcePacket) -> SourceCapture:
        if not packets:
            raise ValueError("at least one source packet is required")

        normalized = [packet.as_dict() for packet in packets]
        randomizers = [random.Random(_seed(packet)) for packet in normalized]
        values: list[float] = []

        for _ in range(self.width):
            samples = [(rng.random() * 2.0) - 1.0 for rng in randomizers]
            values.append(max(-1.0, min(1.0, sum(samples) / len(samples))))

        field = Signal(
            name="magnet:capture",
            values=tuple(values),
            tags=("source-capture", "bounded", "replayable"),
        )
        fingerprint_payload = {
            "version": CAPTURE_VERSION,
            "packets": normalized,
            "field": field.as_dict(),
        }
        fingerprint = hashlib.sha256(
            _stable_json(fingerprint_payload).encode("utf-8")
        ).hexdigest()

        return SourceCapture(
            version=CAPTURE_VERSION,
            packets=packets,
            field=field,
            fingerprint=fingerprint,
        )
