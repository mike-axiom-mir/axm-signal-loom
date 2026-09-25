import unittest

from signal_loom import LiveWeaveState, SignalMachine, SourceInput


class LiveWeaveTests(unittest.TestCase):
    def test_latest_valid_sample_replaces_same_organ(self):
        live = LiveWeaveState(machine=SignalMachine(width=16))
        live.push(SourceInput("simulation-state", {"motion": 0.1}), updated_at=1.0)
        first = live.target_field.values
        live.push(SourceInput("simulation-state", {"motion": 0.9}), updated_at=2.0)
        second = live.target_field.values

        self.assertEqual(len(live.samples), 1)
        self.assertEqual(live.source_update_timestamps["simulation-state"], 2.0)
        self.assertNotEqual(first, second)

    def test_invalid_update_does_not_replace_last_valid_sample(self):
        live = LiveWeaveState(machine=SignalMachine(width=16))
        valid = SourceInput(
            "working-chat",
            {"themes": ["repair"]},
            provenance="working chat fixture",
        )
        live.push(valid, updated_at=1.0)

        with self.assertRaises(ValueError):
            live.push(SourceInput("working-chat", {"themes": ["bad"]}), updated_at=2.0)

        self.assertEqual(live.samples[0].source, valid)
        self.assertEqual(live.source_update_timestamps["working-chat"], 1.0)

    def test_tick_smooths_without_mutating_target(self):
        live = LiveWeaveState(
            machine=SignalMachine(width=16),
            smoothing=0.2,
            decay=0.1,
        )
        live.push(SourceInput("simulation-state", {"motion": 0.8}), updated_at=1.0)
        target = live.target_field.values
        first = live.tick().values
        second = live.tick().values

        self.assertEqual(live.target_field.values, target)
        self.assertNotEqual(first, target)
        self.assertNotEqual(first, second)

    def test_freeze_creates_normal_replayable_session(self):
        machine = SignalMachine(width=16)
        live = LiveWeaveState(machine=machine)
        live.push(SourceInput("browser-local", {"pointerX": 0.2}), updated_at=1.0)
        live.push(
            SourceInput(
                "working-chat",
                {"themes": ["rain", "repair", "glass"]},
                weight=0.7,
                provenance="working chat fixture",
            ),
            updated_at=2.0,
        )

        session = live.freeze(captured_at="2026-09-20T03:00:00+00:00")
        replayed = machine.replay_session(session.as_dict())

        self.assertEqual(session, replayed)
        self.assertEqual(len(session.capture.contributions), 2)
        self.assertEqual(live.as_dict()["replayable"], False)

    def test_live_state_clear_does_not_change_existing_frozen_session(self):
        machine = SignalMachine(width=16)
        live = LiveWeaveState(machine=machine)
        live.push(SourceInput("simulation-state", {"motion": 0.5}), updated_at=1.0)
        session = live.freeze(captured_at="2026-09-20T03:00:00+00:00")

        live.clear()
        live.tick()

        self.assertEqual(machine.replay_session(session.as_dict()), session)
        self.assertEqual(live.samples, ())


if __name__ == "__main__":
    unittest.main()
