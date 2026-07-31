"""Permission Capability tests. Run: python3 -m unittest capabilities.test_permissions -v"""
import unittest

from kernel import Kernel
from kernel.event import UserSpoke, Event
from capabilities.intent import IntentCapability
from capabilities.permissions import PermissionCapability, decide


class TestDecide(unittest.TestCase):
    def test_policy(self):
        self.assertEqual(decide("ask_time")[0], "allowed")
        self.assertEqual(decide("purchase")[0], "needs_approval")
        self.assertEqual(decide("unknown")[0], "denied")


class TestGateOnKernel(unittest.TestCase):
    def test_intent_is_gated(self):
        k = Kernel()
        PermissionCapability().attach(k)
        k.publish(Event("intent.recognized", "c:1",
                        {"intent": "ask_time", "confidence": 0.95}))
        self.assertEqual(k.store.events()[-1].type, "action.allowed")

    def test_full_chain_speak_intent_permission(self):
        # Two capabilities compose on the bus, in order, without touching each other.
        k = Kernel()
        IntentCapability().attach(k)
        PermissionCapability().attach(k)
        k.publish(UserSpoke("מה השעה עכשיו"))
        self.assertEqual([e.type for e in k.store.events()],
                         ["user.spoke", "intent.recognized", "action.allowed"])

    def test_unknown_intent_is_denied(self):
        k = Kernel()
        IntentCapability().attach(k)
        PermissionCapability().attach(k)
        k.publish(UserSpoke("blergh flooble"))
        self.assertEqual(k.store.events()[-1].type, "action.denied")

    def test_state_still_pure_fold(self):
        from kernel.reducer import build_state
        k = Kernel()
        IntentCapability().attach(k)
        PermissionCapability().attach(k)
        k.publish(UserSpoke("תודה"))
        self.assertEqual(k.state, build_state(k.store.events()))


if __name__ == "__main__":
    unittest.main(verbosity=2)
