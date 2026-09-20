import json
import unittest

from signal_loom import SignalLoom, weave
from signal_loom.render import svg_preview


class SignalLoomTests(unittest.TestCase):
    def test_same_recipe_replays_exactly(self):
        first = weave(
            "storm ceramic insect jazz", seed=4837291, draft=4, chaos=0.72
        )
        second = weave(
            "storm ceramic insect jazz", seed=4837291, draft=4, chaos=0.72
        )
        self.assertEqual(first, second)
        self.assertEqual(first.fingerprint, second.fingerprint)

    def test_different_draft_changes_fingerprint(self):
        first = weave("storm ceramic insect jazz", seed=4837291, draft=0)
        second = weave("storm ceramic insect jazz", seed=4837291, draft=1)
        self.assertNotEqual(first.fingerprint, second.fingerprint)

    def test_packet_is_json_serializable(self):
        packet = weave("vehicle idea", seed=99)
        encoded = json.dumps(packet.as_dict(), sort_keys=True)
        self.assertIn(packet.fingerprint, encoded)

    def test_batch_is_bounded_and_counted(self):
        packets = SignalLoom(width=32).batch(
            "world variation", seed=42, count=12, chaos=1.0
        )
        self.assertEqual(len(packets), 12)
        for packet in packets:
            self.assertTrue(
                all(-1.0 <= value <= 1.0 for value in packet.field.values)
            )

    def test_chaos_outside_range_is_rejected(self):
        with self.assertRaises(ValueError):
            weave("bad", seed=1, chaos=1.01)

    def test_preview_is_inspection_only_svg(self):
        packet = weave("strange machine", seed=7)
        preview = svg_preview(packet)
        self.assertTrue(preview.startswith("<svg"))
        self.assertIn(packet.fingerprint[:12], preview)


if __name__ == "__main__":
    unittest.main()
