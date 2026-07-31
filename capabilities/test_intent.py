"""Intent Capability tests. Run: python3 -m unittest capabilities.test_intent -v"""
import unittest

from kernel import Kernel
from kernel.event import UserSpoke
from capabilities.intent import IntentCapability, classify


class TestClassify(unittest.TestCase):
    def test_deterministic_rules(self):
        self.assertEqual(classify("מה השעה עכשיו")[0], "ask_time")
        self.assertEqual(classify("מה הפרויקטים שלנו")[0], "list_projects")
        self.assertEqual(classify("תודה רבה")[0], "acknowledge")
        self.assertEqual(classify("שלום מרלין")[0], "greet")
        self.assertEqual(classify("blergh")[0], "unknown")

    def test_same_input_same_output(self):
        self.assertEqual(classify("מה השעה"), classify("מה השעה"))  # INV-6


class TestIntentOnKernel(unittest.TestCase):
    def test_user_spoke_produces_intent_recognized(self):
        k = Kernel()
        IntentCapability().attach(k)
        k.publish(UserSpoke("מה השעה עכשיו"))
        types = [e.type for e in k.store.events()]
        self.assertEqual(types, ["user.spoke", "intent.recognized"])   # order preserved
        rec = k.store.events()[-1]
        self.assertEqual(rec.payload["intent"], "ask_time")
        self.assertEqual(rec.payload["source_event"], "user.spoke")
        self.assertEqual(rec.actor, "capability:intent")

    def test_capability_does_not_mutate_state_directly(self):
        # State still equals a pure fold of the log (RFC-030) even with a capability.
        from kernel.reducer import build_state
        k = Kernel()
        IntentCapability().attach(k)
        k.publish(UserSpoke("תודה"))
        self.assertEqual(k.state, build_state(k.store.events()))

    def test_registered_in_capability_registry(self):
        k = Kernel()
        IntentCapability().attach(k)
        self.assertIn("user.spoke", k.registry.types())


if __name__ == "__main__":
    unittest.main(verbosity=2)
