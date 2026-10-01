import random
import unittest

from app.aar import build_aar
from app.communication_intel import information_quality
from app.degradation import DegradationPolicy, Message, decide


class SpecialFeatureTests(unittest.TestCase):
    def test_priority_changes_delay_and_is_deterministic(self):
        policy = DegradationPolicy(drop_prob=0, min_delay_s=10, max_delay_s=10)
        base = dict(id="m1", source="player", sender="p1", sender_team="alpha",
                    to_teams=("bravo",), content="contact", sent_clock=0)
        urgent = decide(policy, Message(**base, priority="URGENT"), "p2", "bravo",
                        {"alpha": True, "bravo": True}, random.Random(1))
        low = decide(policy, Message(**base, priority="LOW"), "p2", "bravo",
                     {"alpha": True, "bravo": True}, random.Random(1))
        self.assertEqual(urgent.delay_s, 6.0)
        self.assertEqual(low.delay_s, 14.0)
        self.assertEqual(urgent.priority, "URGENT")

    def test_information_quality_becomes_stale_and_tampered(self):
        fresh = information_quality(delay_s=2, priority="HIGH", tampered=False, max_delay_s=30)
        stale = information_quality(delay_s=25, priority="NORMAL", tampered=True, max_delay_s=30)
        self.assertEqual(fresh["status"], "FRESH")
        self.assertEqual(stale["status"], "STALE")
        self.assertLess(stale["confidence"], fresh["confidence"])

    def test_aar_contains_communication_bottleneck_and_decision_context(self):
        events = [
            {"id": 1, "ts": 1, "type": "message_delivered", "actor": "p2", "payload": {
                "sender_team": "alpha", "recipient_team": "bravo", "message_id": "m1",
                "sender": "p1", "content": "contact", "sent_clock": 0,
                "deliver_at_clock": 20, "delivered_clock": 20, "delivery_delay_s": 20,
                "priority": "NORMAL", "tampered": False,
                "information_quality": {"status": "STALE", "confidence": 0.4},
            }},
            {"id": 2, "ts": 2, "type": "order_issued", "actor": "p2", "payload": {
                "order_id": "o1", "unit_id": "b1", "action": "move", "target": {"lat": 1, "lon": 2},
            }},
            {"id": 3, "ts": 3, "type": "message_dropped", "actor": "p2", "payload": {
                "sender_team": "alpha", "recipient_team": "bravo", "message_id": "m2",
                "reason": "random_loss", "priority": "LOW",
            }},
        ]
        aar = build_aar(events, {"p1": "alpha", "p2": "bravo"}, {"id": "s1"})
        self.assertIn("communication_analysis", aar)
        self.assertIsNotNone(aar["communication_analysis"]["bottleneck"])
        order = next(x for x in aar["leaders"][1]["timeline"] if x["kind"] == "order_issued")
        self.assertEqual(order["decision_context"]["based_on_message_id"], "m1")
        self.assertEqual(order["decision_context"]["source_quality"]["status"], "STALE")


if __name__ == "__main__":
    unittest.main()
