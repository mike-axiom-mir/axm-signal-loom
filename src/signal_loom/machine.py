from __future__ import annotations

import hashlib
import json
from copy import deepcopy
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Iterable

from .core import SignalLoom
from .internet_eye import ShodanInfluenceAdapter
from .magnet import SignalMagnet
from .model import CreativityPacket, SourceCapture, SourcePacket

RECIPE_VERSION = "axm.signal-machine.recipe/0.5"
SESSION_VERSION = "axm.signal-machine.session/0.5"


def _stable_json(value: object) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def _fingerprint(value: object) -> str:
    return hashlib.sha256(_stable_json(value).encode("utf-8")).hexdigest()


@dataclass(frozen=True)
class SourceOrganSpec:
    id: str
    label: str
    kind: str
    mode: str
    description: str
    provenance_required: bool = False
    enabled_by_default: bool = True

    def as_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "label": self.label,
            "kind": self.kind,
            "mode": self.mode,
            "description": self.description,
            "provenance_required": self.provenance_required,
            "enabled_by_default": self.enabled_by_default,
        }


DEFAULT_SOURCE_ORGANS = (
    SourceOrganSpec(
        "browser-local",
        "Browser Local",
        "local-live",
        "capture",
        "Visible local interaction/state supplied by a browser runtime.",
    ),
    SourceOrganSpec(
        "source-material",
        "Source Material",
        "manual",
        "capture",
        "Explicit text or structured material supplied by a caller.",
    ),
    SourceOrganSpec(
        "working-chat",
        "Working Chat",
        "connector",
        "capture",
        "A structured packet supplied by a working chat or model seat.",
        provenance_required=True,
    ),
    SourceOrganSpec(
        "connector-packet",
        "Connector Packet",
        "connector",
        "capture",
        "Structured data supplied by an authorized external connector.",
        provenance_required=True,
    ),
    SourceOrganSpec(
        "file-packet",
        "File Packet",
        "local",
        "capture",
        "Content or metadata supplied from an explicitly selected file.",
        provenance_required=True,
    ),
    SourceOrganSpec(
        "simulation-state",
        "Simulation State",
        "simulation",
        "capture",
        "State emitted by a simulation, game, world, or deterministic model.",
    ),
    SourceOrganSpec(
        "model-output",
        "Model Output",
        "model",
        "capture",
        "Output explicitly supplied by an AI/model adapter.",
        provenance_required=True,
    ),
    SourceOrganSpec(
        "sensor",
        "Sensor",
        "sensor",
        "capture",
        "Measurements explicitly supplied through a sensor bridge.",
        provenance_required=True,
    ),
    SourceOrganSpec(
        "internet-eye",
        "Internet Eye",
        "public-index",
        "aggregate-only",
        "Target-blind aggregate influence from Shodan-compatible indexed observations.",
        provenance_required=True,
    ),
    SourceOrganSpec(
        "custom",
        "Custom",
        "custom",
        "capture",
        "Caller-defined JSON-serializable source material.",
        provenance_required=True,
    ),
)


class SourceRegistry:
    def __init__(self, specs: Iterable[SourceOrganSpec] = DEFAULT_SOURCE_ORGANS) -> None:
        self._specs: dict[str, SourceOrganSpec] = {}
        for spec in specs:
            self.register(spec)

    def register(self, spec: SourceOrganSpec) -> None:
        if not spec.id.strip():
            raise ValueError("source organ id cannot be empty")
        if spec.id in self._specs:
            raise ValueError(f"source organ already registered: {spec.id}")
        self._specs[spec.id] = spec

    def get(self, organ_id: str) -> SourceOrganSpec:
        try:
            return self._specs[organ_id]
        except KeyError as exc:
            raise ValueError(f"unknown source organ: {organ_id}") from exc

    def list(self) -> tuple[SourceOrganSpec, ...]:
        return tuple(self._specs[key] for key in sorted(self._specs))


@dataclass(frozen=True)
class SourceInput:
    organ_id: str
    payload: Any
    weight: float = 1.0
    label: str = ""
    provenance: str = ""

    def as_dict(self) -> dict[str, Any]:
        return {
            "organ_id": self.organ_id,
            "payload": deepcopy(self.payload),
            "weight": round(self.weight, 8),
            "label": self.label,
            "provenance": self.provenance,
        }

    @classmethod
    def from_dict(cls, value: dict[str, Any]) -> "SourceInput":
        return cls(
            organ_id=str(value["organ_id"]),
            payload=value.get("payload"),
            weight=float(value.get("weight", 1.0)),
            label=str(value.get("label", "")),
            provenance=str(value.get("provenance", "")),
        )


@dataclass(frozen=True)
class CaptureRecipe:
    inputs: tuple[SourceInput, ...]
    name: str = ""
    version: str = RECIPE_VERSION

    def as_dict(self) -> dict[str, Any]:
        return {
            "version": self.version,
            "name": self.name,
            "inputs": [source.as_dict() for source in self.inputs],
        }

    @property
    def fingerprint(self) -> str:
        return _fingerprint(self.as_dict())

    @classmethod
    def from_dict(cls, value: dict[str, Any]) -> "CaptureRecipe":
        inputs = value.get("inputs")
        if not isinstance(inputs, list):
            raise ValueError("capture recipe inputs must be a list")
        return cls(
            version=str(value.get("version", RECIPE_VERSION)),
            name=str(value.get("name", "")),
            inputs=tuple(SourceInput.from_dict(item) for item in inputs),
        )


@dataclass(frozen=True)
class CaptureSession:
    recipe: CaptureRecipe
    capture: SourceCapture
    captured_at: str
    fingerprint: str
    version: str = SESSION_VERSION

    def as_dict(self) -> dict[str, Any]:
        return {
            "version": self.version,
            "captured_at": self.captured_at,
            "recipe": self.recipe.as_dict(),
            "recipe_fingerprint": self.recipe.fingerprint,
            "capture": self.capture.as_dict(),
            "fingerprint": self.fingerprint,
        }


class SignalMachine:
    """Native source-organ machine around Signal Magnet + Signal Loom."""

    def __init__(
        self,
        *,
        width: int = 64,
        registry: SourceRegistry | None = None,
    ) -> None:
        self.width = width
        self.registry = registry or SourceRegistry()
        self.magnet = SignalMagnet(width=width)
        self.loom = SignalLoom(width=width)
        self.internet_eye = ShodanInfluenceAdapter()

    def _adapt_input(self, source: SourceInput) -> SourcePacket:
        spec = self.registry.get(source.organ_id)
        if source.weight < 0:
            raise ValueError("source weights cannot be negative")
        if spec.provenance_required and not source.provenance.strip():
            raise ValueError(f"source organ {spec.id} requires provenance")

        label = source.label.strip() or spec.label
        if source.organ_id != "internet-eye":
            return SourcePacket(
                source=source.organ_id,
                label=label,
                payload=source.payload,
                provenance=source.provenance,
            )

        payload = source.payload
        if isinstance(payload, dict) and isinstance(payload.get("matches"), list):
            influence = self.internet_eye.from_search_response(payload)
        elif isinstance(payload, list):
            influence = self.internet_eye.from_matches(payload)
        else:
            raise ValueError(
                "internet-eye payload must be a Shodan-compatible response or matches list"
            )
        return influence.to_source_packet(
            label=label,
            provenance=source.provenance,
        )

    def capture(
        self,
        recipe: CaptureRecipe,
        *,
        captured_at: str | None = None,
    ) -> CaptureSession:
        recipe = deepcopy(recipe)
        if not recipe.inputs:
            raise ValueError("capture recipe must contain at least one source input")

        weighted: list[tuple[SourcePacket, float]] = []
        for source in recipe.inputs:
            if source.weight == 0:
                continue
            weighted.append((self._adapt_input(source), source.weight))
        if not weighted:
            raise ValueError("capture recipe must contain at least one positive source weight")

        capture = self.magnet.capture_weighted(
            tuple(weighted),
            recipe_fingerprint=recipe.fingerprint,
        )
        session_payload = {
            "version": SESSION_VERSION,
            "recipe_fingerprint": recipe.fingerprint,
            "capture_fingerprint": capture.fingerprint,
        }
        timestamp = captured_at or datetime.now(timezone.utc).isoformat()
        return CaptureSession(
            recipe=recipe,
            capture=capture,
            captured_at=timestamp,
            fingerprint=_fingerprint(session_payload),
        )

    def replay_session(self, value: dict[str, Any]) -> CaptureSession:
        recipe_raw = value.get("recipe")
        if not isinstance(recipe_raw, dict):
            raise ValueError("session recipe is missing")
        recipe = CaptureRecipe.from_dict(recipe_raw)
        replayed = self.capture(
            recipe,
            captured_at=str(value.get("captured_at", "")),
        )

        expected_recipe = value.get("recipe_fingerprint")
        if expected_recipe and expected_recipe != recipe.fingerprint:
            raise ValueError("session recipe fingerprint does not match its contents")

        expected_capture = value.get("capture")
        if isinstance(expected_capture, dict):
            expected_capture_fp = expected_capture.get("fingerprint")
            if expected_capture_fp and expected_capture_fp != replayed.capture.fingerprint:
                raise ValueError("session capture does not replay to the recorded fingerprint")

        expected_session = value.get("fingerprint")
        if expected_session and expected_session != replayed.fingerprint:
            raise ValueError("session fingerprint does not replay")

        return replayed

    def weave(
        self,
        session: CaptureSession,
        *,
        seed: int,
        count: int = 8,
        intent: str = "",
        chaos: float = 0.5,
    ) -> tuple[CreativityPacket, ...]:
        return self.loom.batch_capture(
            session.capture,
            seed=seed,
            count=count,
            intent=intent,
            chaos=chaos,
        )
