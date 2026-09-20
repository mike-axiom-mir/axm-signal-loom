from __future__ import annotations

import hashlib
import json
import random

from .model import Signal, SourceCapture, SourceContribution, SourcePacket

CAPTURE_VERSION = "axm.signal-magnet.capture/0.3"
WEIGHTED_CAPTURE_VERSION = "axm.signal-magnet.capture/0.5"


def _stable_json(value: object) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def _seed(value: object) -> int:
    digest = hashlib.sha256(_stable_json(value).encode("utf-8")).digest()
    return int.from_bytes(digest[:8], "big", signed=False)


def packet_fingerprint(packet: SourcePacket) -> str:
    return hashlib.sha256(_stable_json(packet.as_dict()).encode("utf-8")).hexdigest()


class SignalMagnet:
    """Capture explicit source packets into one bounded, replayable signal field."""

    def __init__(self, *, width: int = 64) -> None:
        if width < 8:
            raise ValueError("width must be at least 8")
        self.width = width

    def capture(self, *packets: SourcePacket) -> SourceCapture:
        """Legacy equal-weight capture retained exactly for v0.3 continuity."""
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

    def capture_weighted(
        self,
        weighted_packets: tuple[tuple[SourcePacket, float], ...],
        *,
        recipe_fingerprint: str = "",
    ) -> SourceCapture:
        """Capture a deterministic weighted blend and preserve influence receipts."""
        if not weighted_packets:
            raise ValueError("at least one weighted source packet is required")

        for _, weight in weighted_packets:
            if weight < 0:
                raise ValueError("source weights cannot be negative")
        total_weight = sum(weight for _, weight in weighted_packets)
        if total_weight <= 0:
            raise ValueError("at least one source weight must be greater than zero")

        normalized_weights = tuple(
            weight / total_weight for _, weight in weighted_packets
        )
        packet_dicts = [packet.as_dict() for packet, _ in weighted_packets]
        randomizers = [random.Random(_seed(packet)) for packet in packet_dicts]

        values: list[float] = []
        for _ in range(self.width):
            samples = [(rng.random() * 2.0) - 1.0 for rng in randomizers]
            combined = sum(
                sample * weight
                for sample, weight in zip(samples, normalized_weights)
            )
            values.append(max(-1.0, min(1.0, combined)))

        contributions = tuple(
            SourceContribution(
                source=packet.source,
                label=packet.label,
                weight=weight,
                packet_fingerprint=packet_fingerprint(packet),
                provenance=packet.provenance,
            )
            for (packet, _), weight in zip(weighted_packets, normalized_weights)
        )
        field = Signal(
            name="magnet:weighted-capture",
            values=tuple(values),
            tags=("source-capture", "weighted", "bounded", "replayable"),
        )
        fingerprint_payload = {
            "version": WEIGHTED_CAPTURE_VERSION,
            "packets": packet_dicts,
            "contributions": [
                contribution.as_dict() for contribution in contributions
            ],
            "field": field.as_dict(),
            "recipe_fingerprint": recipe_fingerprint,
        }
        fingerprint = hashlib.sha256(
            _stable_json(fingerprint_payload).encode("utf-8")
        ).hexdigest()

        return SourceCapture(
            version=WEIGHTED_CAPTURE_VERSION,
            packets=tuple(packet for packet, _ in weighted_packets),
            field=field,
            fingerprint=fingerprint,
            contributions=contributions,
            recipe_fingerprint=recipe_fingerprint,
        )
