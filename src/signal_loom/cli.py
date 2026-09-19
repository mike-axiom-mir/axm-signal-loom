from __future__ import annotations

import argparse
import json
from pathlib import Path

from .core import SignalLoom
from .render import svg_preview


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Generate deterministic Signal Loom creativity packets."
    )
    parser.add_argument("--prompt", required=True, help="Concept or signal request to explore.")
    parser.add_argument("--seed", type=int, required=True, help="Replayable root seed.")
    parser.add_argument("--count", type=int, default=8, help="Number of temporary drafts.")
    parser.add_argument("--chaos", type=float, default=0.5, help="0..1 bounded variation amount.")
    parser.add_argument("--width", type=int, default=64, help="Signal field width.")
    parser.add_argument("--out", type=Path, default=Path("loom-output"), help="Output directory.")
    parser.add_argument("--packet-only", action="store_true", help="Skip SVG preview generation.")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    loom = SignalLoom(width=args.width)
    packets = loom.batch(
        args.prompt, seed=args.seed, count=args.count, chaos=args.chaos
    )
    args.out.mkdir(parents=True, exist_ok=True)

    manifest = []
    for packet in packets:
        stem = f"draft-{packet.draft:03d}-{packet.fingerprint[:10]}"
        packet_path = args.out / f"{stem}.json"
        packet_path.write_text(
            json.dumps(packet.as_dict(), indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
        if not args.packet_only:
            (args.out / f"{stem}.svg").write_text(
                svg_preview(packet) + "\n", encoding="utf-8"
            )
        manifest.append(
            {
                "draft": packet.draft,
                "fingerprint": packet.fingerprint,
                "packet": packet_path.name,
                "preview": None if args.packet_only else f"{stem}.svg",
            }
        )

    (args.out / "manifest.json").write_text(
        json.dumps(
            {"request": args.prompt, "seed": args.seed, "drafts": manifest},
            indent=2,
            sort_keys=True,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"wrote {len(packets)} replayable drafts to {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
