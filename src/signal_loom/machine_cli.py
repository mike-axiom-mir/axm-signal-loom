from __future__ import annotations

import argparse
import json
from pathlib import Path

from .machine import CaptureRecipe, SignalMachine
from .render import svg_preview


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Run Signal Machine from a replayable source-organ recipe."
    )
    parser.add_argument("--recipe", type=Path, required=True, help="Capture recipe JSON.")
    parser.add_argument("--seed", type=int, required=True, help="Replayable Loom seed.")
    parser.add_argument("--count", type=int, default=8, help="Number of visual proposals.")
    parser.add_argument("--chaos", type=float, default=0.5, help="0..1 bounded mutation.")
    parser.add_argument("--intent", default="", help="Optional interpretation bias.")
    parser.add_argument("--width", type=int, default=64, help="Signal width.")
    parser.add_argument("--out", type=Path, default=Path("signal-machine-output"))
    return parser


def main() -> int:
    args = build_parser().parse_args()
    recipe_data = json.loads(args.recipe.read_text(encoding="utf-8"))
    recipe = CaptureRecipe.from_dict(recipe_data)

    machine = SignalMachine(width=args.width)
    session = machine.capture(recipe)
    drafts = machine.weave(
        session,
        seed=args.seed,
        count=args.count,
        intent=args.intent,
        chaos=args.chaos,
    )

    args.out.mkdir(parents=True, exist_ok=True)
    (args.out / "capture-session.json").write_text(
        json.dumps(session.as_dict(), indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )

    manifest = []
    for packet in drafts:
        stem = f"draft-{packet.draft:03d}-{packet.fingerprint[:10]}"
        packet_name = f"{stem}.json"
        preview_name = f"{stem}.svg"
        (args.out / packet_name).write_text(
            json.dumps(packet.as_dict(), indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
        (args.out / preview_name).write_text(
            svg_preview(packet) + "\n",
            encoding="utf-8",
        )
        manifest.append(
            {
                "draft": packet.draft,
                "fingerprint": packet.fingerprint,
                "packet": packet_name,
                "preview": preview_name,
            }
        )

    (args.out / "manifest.json").write_text(
        json.dumps(
            {
                "session_fingerprint": session.fingerprint,
                "recipe_fingerprint": recipe.fingerprint,
                "seed": args.seed,
                "chaos": args.chaos,
                "intent": args.intent,
                "drafts": manifest,
            },
            indent=2,
            sort_keys=True,
        )
        + "\n",
        encoding="utf-8",
    )

    print(
        f"captured {len(session.capture.contributions)} source organs and "
        f"wrote {len(drafts)} replayable drafts to {args.out}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
