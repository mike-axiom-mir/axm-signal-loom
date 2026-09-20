from __future__ import annotations

import hashlib
import json
import math
import random
from dataclasses import replace

from .model import CreativityPacket, Signal, SourceCapture

PACKET_VERSION = "axm.signal-loom.packet/0.1"


def _clamp(value: float) -> float:
    return max(-1.0, min(1.0, value))


def _seed_int(seed: int, label: str) -> int:
    digest = hashlib.sha256(f"{seed}:{label}".encode("utf-8")).digest()
    return int.from_bytes(digest[:8], "big", signed=False)


def token_signal(text: str, *, width: int = 64) -> Signal:
    if width < 8:
        raise ValueError("width must be at least 8")
    normalized = " ".join(text.lower().split()) or "silence"
    rng = random.Random(_seed_int(0, f"token:{normalized}"))
    values = tuple(rng.uniform(-1.0, 1.0) for _ in range(width))
    return Signal(name=f"concept:{normalized}", values=values, tags=("concept",))


def noise_signal(seed: int, *, name: str, width: int = 64) -> Signal:
    rng = random.Random(_seed_int(seed, f"noise:{name}"))
    values = tuple(rng.uniform(-1.0, 1.0) for _ in range(width))
    return Signal(name=name, values=values, tags=("noise", "seeded"))


def oscillator_signal(
    *, name: str, width: int = 64, cycles: float = 3.0, phase: float = 0.0
) -> Signal:
    if width < 2:
        raise ValueError("width must be at least 2")
    values = tuple(
        math.sin((index / (width - 1)) * math.tau * cycles + phase)
        for index in range(width)
    )
    return Signal(name=name, values=values, tags=("oscillator",))


def mix_signals(signals: tuple[Signal, ...], weights: tuple[float, ...]) -> Signal:
    if not signals:
        raise ValueError("at least one signal is required")
    if len(signals) != len(weights):
        raise ValueError("signals and weights must have the same length")
    width = len(signals[0].values)
    if any(len(signal.values) != width for signal in signals):
        raise ValueError("all signals must share a width")
    denominator = sum(abs(weight) for weight in weights)
    if denominator == 0:
        raise ValueError("weights cannot all be zero")
    values = []
    for index in range(width):
        combined = sum(
            signal.values[index] * weight for signal, weight in zip(signals, weights)
        ) / denominator
        values.append(_clamp(combined))
    return Signal(name="mix", values=tuple(values), tags=("mixed", "bounded"))


def mutate_signal(signal: Signal, *, seed: int, amount: float) -> Signal:
    if not 0.0 <= amount <= 1.0:
        raise ValueError("mutation amount must be between 0 and 1")
    rng = random.Random(_seed_int(seed, f"mutate:{signal.name}"))
    values = tuple(
        _clamp(value + rng.uniform(-amount, amount)) for value in signal.values
    )
    return Signal(
        name=f"{signal.name}:mutated",
        values=values,
        tags=signal.tags + ("mutated",),
    )


def cross_map(source: Signal, carrier: Signal, *, amount: float) -> Signal:
    if len(source.values) != len(carrier.values):
        raise ValueError("source and carrier must share a width")
    if not 0.0 <= amount <= 1.0:
        raise ValueError("cross-map amount must be between 0 and 1")
    values = tuple(
        _clamp(carrier_value * (1.0 - amount) + source_value * carrier_value * amount)
        for source_value, carrier_value in zip(source.values, carrier.values)
    )
    return Signal(
        name=f"cross:{source.name}->{carrier.name}",
        values=values,
        tags=("cross-map", "bounded"),
    )


def _fingerprint(payload: dict) -> str:
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def weave(
    request: str,
    *,
    seed: int,
    draft: int = 0,
    width: int = 64,
    chaos: float = 0.5,
) -> CreativityPacket:
    if not 0.0 <= chaos <= 1.0:
        raise ValueError("chaos must be between 0 and 1")
    if draft < 0:
        raise ValueError("draft must be zero or greater")
    if width < 8:
        raise ValueError("width must be at least 8")

    draft_seed = _seed_int(seed, f"draft:{draft}")
    concept = token_signal(request, width=width)
    noise = noise_signal(draft_seed, name=f"noise:{draft}", width=width)
    rhythm = oscillator_signal(
        name=f"rhythm:{draft}",
        width=width,
        cycles=1.5 + (chaos * 6.5),
        phase=(draft % 11) * 0.37,
    )

    base = mix_signals(
        (concept, noise, rhythm),
        (1.0, 0.15 + chaos * 0.85, 0.25 + chaos * 0.55),
    )
    crossed = cross_map(noise, base, amount=0.15 + chaos * 0.55)
    field = mutate_signal(crossed, seed=draft_seed, amount=chaos * 0.35)
    field = replace(field, name=f"field:{draft}", tags=field.tags + ("proposal",))

    operations = (
        "concept-hash",
        "seeded-noise",
        "oscillator",
        "weighted-mix",
        "cross-map",
        "bounded-mutation",
    )
    pre_fingerprint = {
        "version": PACKET_VERSION,
        "seed": seed,
        "draft": draft,
        "request": request,
        "chaos": round(chaos, 8),
        "width": width,
        "signals": [concept.as_dict(), noise.as_dict(), rhythm.as_dict()],
        "field": field.as_dict(),
        "operations": list(operations),
    }
    return CreativityPacket(
        version=PACKET_VERSION,
        seed=seed,
        draft=draft,
        request=request,
        chaos=chaos,
        width=width,
        signals=(concept, noise, rhythm),
        field=field,
        operations=operations,
        fingerprint=_fingerprint(pre_fingerprint),
    )


def weave_capture(
    capture: SourceCapture,
    *,
    seed: int,
    draft: int = 0,
    intent: str = "",
    chaos: float = 0.5,
) -> CreativityPacket:
    """Weave from a frozen source capture. Intent is only an optional bias."""
    width = len(capture.field.values)
    if not 0.0 <= chaos <= 1.0:
        raise ValueError("chaos must be between 0 and 1")
    if draft < 0:
        raise ValueError("draft must be zero or greater")
    if width < 8:
        raise ValueError("capture width must be at least 8")

    draft_seed = _seed_int(seed, f"capture:{capture.fingerprint}:draft:{draft}")
    if intent.strip():
        bias = token_signal(intent, width=width)
    else:
        bias = Signal(name="intent:none", values=(0.0,) * width, tags=("intent", "empty"))

    noise = noise_signal(draft_seed, name=f"noise:{draft}", width=width)
    rhythm = oscillator_signal(
        name=f"rhythm:{draft}",
        width=width,
        cycles=1.3 + (chaos * 7.7),
        phase=(draft % 11) * 0.37,
    )
    base = mix_signals(
        (capture.field, bias, noise, rhythm),
        (1.0, 0.18, 0.12 + chaos * 0.55, 0.18 + chaos * 0.45),
    )
    crossed = cross_map(noise, base, amount=0.10 + chaos * 0.45)
    field = mutate_signal(crossed, seed=draft_seed, amount=chaos * 0.28)
    field = replace(field, name=f"field:{draft}", tags=field.tags + ("proposal",))

    operations = (
        "source-capture",
        "optional-intent-bias",
        "seeded-noise",
        "oscillator",
        "weighted-mix",
        "cross-map",
        "bounded-mutation",
    )
    pre_fingerprint = {
        "version": "axm.signal-loom.packet/0.3",
        "capture": capture.as_dict(),
        "seed": seed,
        "draft": draft,
        "intent": intent,
        "chaos": round(chaos, 8),
        "field": field.as_dict(),
        "operations": list(operations),
    }
    return CreativityPacket(
        version="axm.signal-loom.packet/0.3",
        seed=seed,
        draft=draft,
        request=intent,
        chaos=chaos,
        width=width,
        signals=(capture.field, bias, noise, rhythm),
        field=field,
        operations=operations,
        fingerprint=_fingerprint(pre_fingerprint),
        source_capture=capture,
    )


class SignalLoom:
    """Small deterministic facade for project integrations."""

    def __init__(self, *, width: int = 64) -> None:
        if width < 8:
            raise ValueError("width must be at least 8")
        self.width = width

    def draft(
        self, request: str, *, seed: int, draft: int = 0, chaos: float = 0.5
    ) -> CreativityPacket:
        return weave(request, seed=seed, draft=draft, width=self.width, chaos=chaos)

    def batch(
        self, request: str, *, seed: int, count: int, chaos: float = 0.5
    ) -> tuple[CreativityPacket, ...]:
        if count < 1:
            raise ValueError("count must be at least 1")
        return tuple(
            self.draft(request, seed=seed, draft=index, chaos=chaos)
            for index in range(count)
        )

    def draft_capture(
        self,
        capture: SourceCapture,
        *,
        seed: int,
        draft: int = 0,
        intent: str = "",
        chaos: float = 0.5,
    ) -> CreativityPacket:
        if len(capture.field.values) != self.width:
            raise ValueError("capture width must match loom width")
        return weave_capture(
            capture,
            seed=seed,
            draft=draft,
            intent=intent,
            chaos=chaos,
        )

    def batch_capture(
        self,
        capture: SourceCapture,
        *,
        seed: int,
        count: int,
        intent: str = "",
        chaos: float = 0.5,
    ) -> tuple[CreativityPacket, ...]:
        if count < 1:
            raise ValueError("count must be at least 1")
        return tuple(
            self.draft_capture(
                capture,
                seed=seed,
                draft=index,
                intent=intent,
                chaos=chaos,
            )
            for index in range(count)
        )
