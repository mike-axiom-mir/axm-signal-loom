import json
import unittest

from signal_loom import (
    CaptureRecipe,
    ShodanInfluenceAdapter,
    SignalLoom,
    SignalMachine,
    SignalMagnet,
    SourceInput,
    SourcePacket,
    weave,
)
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


    def test_signal_magnet_replays_same_sources(self):
        magnet = SignalMagnet(width=32)
        source = SourcePacket(
            source="web",
            label="weather snapshot",
            payload={"wind": 0.8, "rain": 0.2},
            provenance="example",
        )
        first = magnet.capture(source)
        second = magnet.capture(source)
        self.assertEqual(first, second)
        self.assertEqual(first.fingerprint, second.fingerprint)

    def test_source_change_changes_capture(self):
        magnet = SignalMagnet(width=32)
        first = magnet.capture(
            SourcePacket(source="local", label="state", payload={"x": 0.2})
        )
        second = magnet.capture(
            SourcePacket(source="local", label="state", payload={"x": 0.3})
        )
        self.assertNotEqual(first.fingerprint, second.fingerprint)

    def test_capture_weave_uses_optional_intent_bias(self):
        magnet = SignalMagnet(width=32)
        loom = SignalLoom(width=32)
        capture = magnet.capture(
            SourcePacket(
                source="connector",
                label="machine state",
                payload={"load": 0.61, "pulse": [0.1, 0.4, 0.9]},
            )
        )
        neutral = loom.draft_capture(capture, seed=42, draft=0, intent="", chaos=0.5)
        biased = loom.draft_capture(
            capture, seed=42, draft=0, intent="eerie architecture", chaos=0.5
        )
        self.assertNotEqual(neutral.fingerprint, biased.fingerprint)
        self.assertEqual(neutral.signals[0], capture.field)
        self.assertEqual(biased.signals[0], capture.field)


    def test_internet_eye_aggregates_without_targets(self):
        adapter = ShodanInfluenceAdapter()
        influence = adapter.from_matches(
            [
                {
                    "ip_str": "203.0.113.10",
                    "hostnames": ["example.invalid"],
                    "port": 443,
                    "transport": "tcp",
                    "location": {"country_code": "NL"},
                    "product": "nginx",
                    "org": "Example ISP",
                    "data": "HTTP/1.1 200 OK\\nServer: nginx",
                    "ssl": {"versions": ["TLSv1.3"]},
                },
                {
                    "ip_str": "198.51.100.20",
                    "hostnames": ["other.invalid"],
                    "port": 22,
                    "transport": "tcp",
                    "location": {"country_code": "DE"},
                    "product": "OpenSSH",
                    "org": "Other ISP",
                    "data": "SSH-2.0-OpenSSH_9.x",
                },
            ]
        )
        packet = influence.to_source_packet()
        encoded = json.dumps(packet.as_dict(), sort_keys=True)
        self.assertEqual(packet.source, "internet-eye")
        self.assertIn('"443": 1', encoded)
        self.assertIn('"22": 1', encoded)
        self.assertNotIn("203.0.113.10", encoded)
        self.assertNotIn("198.51.100.20", encoded)
        self.assertNotIn("example.invalid", encoded)
        self.assertNotIn("SSH-2.0", encoded)

    def test_internet_eye_can_influence_magnet(self):
        adapter = ShodanInfluenceAdapter()
        influence = adapter.from_search_response(
            {
                "matches": [
                    {
                        "port": 80,
                        "transport": "tcp",
                        "location": {"country_code": "US"},
                        "product": "Apache",
                        "org": "Org A",
                        "data": "banner-a",
                    },
                    {
                        "port": 443,
                        "transport": "tcp",
                        "location": {"country_code": "NL"},
                        "product": "nginx",
                        "org": "Org B",
                        "data": "banner-b",
                        "ssl": {"enabled": True},
                    },
                ]
            }
        )
        magnet = SignalMagnet(width=32)
        capture = magnet.capture(influence.to_source_packet())
        loom = SignalLoom(width=32)
        packet = loom.draft_capture(capture, seed=123, draft=0, chaos=0.8)
        self.assertEqual(packet.source_capture, capture)
        self.assertTrue(all(-1.0 <= value <= 1.0 for value in packet.field.values))


if __name__ == "__main__":
    unittest.main()
