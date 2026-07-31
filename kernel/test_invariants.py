"""Invariant enforcement tests — proves the law holds AND has teeth.

Run: python3 -m unittest kernel.test_invariants -v
"""
import unittest

from kernel import Kernel
from kernel.event import Event, UserSpoke
from kernel.invariants import verify
from capabilities.intent import IntentCapability
from capabilities.permissions import PermissionCapability


class TestInvariantsHold(unittest.TestCase):
    def test_empty_kernel_is_correct(self):
        self.assertEqual(verify(Kernel()), [])

    def test_holds_after_full_capability_chain(self):
        k = Kernel()
        IntentCapability().attach(k)
        PermissionCapability().attach(k)
        for phrase in ["מה השעה עכשיו", "מה הפרויקטים שלנו", "תודה", "blergh"]:
            k.publish(UserSpoke(phrase))
        self.assertEqual(verify(k), [])          # law holds through 12 emitted events

    def test_events_are_immutable(self):
        e = Event("t", "s")
        with self.assertRaises(Exception):
            e.type = "changed"                    # frozen dataclass rejects mutation


class TestInvariantsHaveTeeth(unittest.TestCase):
    """A rule that can't catch a violation is decoration. These prove it catches."""

    def test_catches_direct_state_mutation(self):
        k = Kernel()
        k.publish(UserSpoke("hi"))
        k.state.event_count = 999                 # a rogue capability mutating State
        self.assertIn("State must equal fold(events)", verify(k))

    def test_catches_world_graph_tampering(self):
        k = Kernel()
        k.publish(Event("node.added", "p:1", {"kind": "Person"}))
        k.state.world_graph["nodes"]["ghost"] = {"kind": "Fake"}   # not from any event
        self.assertIn("World Graph must be a projection of events", verify(k))


if __name__ == "__main__":
    unittest.main(verbosity=2)
