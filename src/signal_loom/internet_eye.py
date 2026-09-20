from __future__ import annotations

import hashlib
import json
import math
from collections import Counter
from dataclasses import dataclass
from typing import Any, Iterable

from .model import SourcePacket


def _stable_hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8", errors="ignore")).hexdigest()


def _entropy(counter: Counter[str]) -> float:
    total = sum(counter.values())
    if total <= 1:
        return 0.0
    entropy = 0.0
    for count in counter.values():
        probability = count / total
        entropy -= probability * math.log2(probability)
    maximum = math.log2(max(2, len(counter)))
    return 0.0 if maximum == 0 else min(1.0, entropy / maximum)


def _top(counter: Counter[Any], limit: int = 12) -> dict[str, int]:
    return {
        str(key): value
        for key, value in sorted(
            counter.items(),
            key=lambda item: (-item[1], str(item[0])),
        )[:limit]
    }


@dataclass(frozen=True)
class InternetEyeInfluence:
    """Target-blind aggregate signal derived from indexed internet observations."""

    observation_count: int
    port_mix: dict[str, int]
    transport_mix: dict[str, int]
    country_mix: dict[str, int]
    product_mix: dict[str, int]
    org_diversity: float
    banner_diversity: float
    tls_share: float
    unique_port_ratio: float
    unique_product_ratio: float
    fingerprint: str

    def as_dict(self) -> dict[str, Any]:
        return {
            "observation_count": self.observation_count,
            "port_mix": self.port_mix,
            "transport_mix": self.transport_mix,
            "country_mix": self.country_mix,
            "product_mix": self.product_mix,
            "org_diversity": round(self.org_diversity, 8),
            "banner_diversity": round(self.banner_diversity, 8),
            "tls_share": round(self.tls_share, 8),
            "unique_port_ratio": round(self.unique_port_ratio, 8),
            "unique_product_ratio": round(self.unique_product_ratio, 8),
            "fingerprint": self.fingerprint,
        }

    def to_source_packet(
        self,
        *,
        label: str = "ambient internet influence",
        provenance: str = "Shodan-compatible indexed observations",
    ) -> SourcePacket:
        return SourcePacket(
            source="internet-eye",
            label=label,
            payload=self.as_dict(),
            provenance=provenance,
        )


class ShodanInfluenceAdapter:
    """Convert Shodan-compatible search/export data into coarse creative influence.

    This adapter performs no network requests, active scans, host lookups, or
    vulnerability checks. The caller supplies already-obtained observations.
    Raw IPs, hostnames, organizations and banner text are not preserved.
    """

    def from_search_response(self, response: dict[str, Any]) -> InternetEyeInfluence:
        matches = response.get("matches", [])
        if not isinstance(matches, list):
            raise ValueError("Shodan-compatible response must contain a matches list")
        return self.from_matches(matches)

    def from_matches(self, matches: Iterable[dict[str, Any]]) -> InternetEyeInfluence:
        ports: Counter[int] = Counter()
        transports: Counter[str] = Counter()
        countries: Counter[str] = Counter()
        products: Counter[str] = Counter()
        org_hashes: Counter[str] = Counter()
        banner_hashes: Counter[str] = Counter()
        observation_count = 0
        tls_count = 0

        for match in matches:
            if not isinstance(match, dict):
                continue
            observation_count += 1

            port = match.get("port")
            if isinstance(port, int):
                ports[port] += 1

            transport = match.get("transport")
            if isinstance(transport, str) and transport:
                transports[transport.lower()] += 1

            location = match.get("location")
            if isinstance(location, dict):
                country = location.get("country_code") or location.get("country_name")
                if isinstance(country, str) and country:
                    countries[country.upper()] += 1

            product = match.get("product")
            if not isinstance(product, str) or not product:
                product = "unknown"
            products[product.lower()] += 1

            org = match.get("org")
            if isinstance(org, str) and org:
                org_hashes[_stable_hash(org.lower().strip())] += 1

            banner = match.get("data")
            if isinstance(banner, str) and banner:
                banner_hashes[_stable_hash(banner)] += 1

            ssl = match.get("ssl")
            if isinstance(ssl, dict) and ssl:
                tls_count += 1

        if observation_count == 0:
            raise ValueError("at least one usable observation is required")

        payload_without_fingerprint = {
            "observation_count": observation_count,
            "port_mix": _top(ports),
            "transport_mix": _top(transports),
            "country_mix": _top(countries),
            "product_mix": _top(products),
            "org_diversity": round(_entropy(org_hashes), 8),
            "banner_diversity": round(_entropy(banner_hashes), 8),
            "tls_share": round(tls_count / observation_count, 8),
            "unique_port_ratio": round(len(ports) / observation_count, 8),
            "unique_product_ratio": round(len(products) / observation_count, 8),
        }
        fingerprint = hashlib.sha256(
            json.dumps(
                payload_without_fingerprint,
                sort_keys=True,
                separators=(",", ":"),
            ).encode("utf-8")
        ).hexdigest()

        return InternetEyeInfluence(
            observation_count=observation_count,
            port_mix=payload_without_fingerprint["port_mix"],
            transport_mix=payload_without_fingerprint["transport_mix"],
            country_mix=payload_without_fingerprint["country_mix"],
            product_mix=payload_without_fingerprint["product_mix"],
            org_diversity=payload_without_fingerprint["org_diversity"],
            banner_diversity=payload_without_fingerprint["banner_diversity"],
            tls_share=payload_without_fingerprint["tls_share"],
            unique_port_ratio=payload_without_fingerprint["unique_port_ratio"],
            unique_product_ratio=payload_without_fingerprint["unique_product_ratio"],
            fingerprint=fingerprint,
        )
