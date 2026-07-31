"""Kernel v0 Baseline tests. Locks the 6 Milestone-1 steps.

Run:  python3 -m unittest kernel.test_kernel -v
Any future change must keep these green (RFC-014 Quality Gates).
"""
import unittest

from kernel import Kernel
from kernel.event import Event, UserSpoke
from kernel.event_store import EventStore
from kernel.reducer import build_state
from kernel.bus import Bus


class TestEventStore(unittest.TestCase):
    def test_append_is_read_back_in_order(self):
        s = EventStore()
        s.append(Event("a", "x"))
        s.append(Event("b", "y"))
        seqs = [e.seq for e in s.events()]
        self.assertEqual(seqs, sorted(seqs))
        self.assertEqual(len(s), 2)

    def test_time_travel_reads_past(self):
        s = EventStore()
        e1 = s.append(Event("a", "x"))
        s.append(Event("b", "y"))
        self.assertEqual([e.type for e in s.events(upto_seq=e1.seq)], ["a"])


class TestBus(unittest.TestCase):
    def test_publish_notifies_subscribers(self):
        bus, got = Bus(), []
        bus.subscribe(got.append)
        ev = Event("t", "s")
        bus.publish(ev)
        self.assertEqual(got, [ev])


class TestReducer(unittest.TestCase):
    def test_fold_is_deterministic_and_replayable(self):
        evs = [UserSpoke("hi"), Event("node.added", "p:1", {"kind": "Person"})]
        self.assertEqual(build_state(evs), build_state(evs))  # determinism (INV-5)

    def test_world_graph_edge_last_writer_wins(self):
        evs = [
            Event("node.added", "p:1", {"kind": "Person"}),
            Event("node.added", "p:2", {"kind": "Person"}),
            Event("edge.set", "p:1", {"to": "p:2", "attrs": {"trust": 0.9}}),
            Event("edge.set", "p:1", {"to": "p:2", "attrs": {"trust": 0.3}}),
        ]
        g = build_state(evs).world_graph
        self.assertEqual(g["edges"][("p:1", "p:2")]["trust"], 0.3)


class TestKernelIntegration(unittest.TestCase):
    """The full Milestone-1 flow: Event → Bus → Store → Reducer → State → World Graph."""

    def test_first_living_event(self):
        k = Kernel()
        k.publish(UserSpoke("Hello Merlin"))                 # (1) event (2) bus (3) store
        self.assertEqual(len(k.store), 1)                    # stored
        self.assertEqual(k.state.last_message, "Hello Merlin")  # (4) state updated

    def test_event_moves_the_world_graph(self):
        k = Kernel()
        k.publish(Event("node.added", "person:roei", {"kind": "Person"}))
        k.publish(Event("node.added", "person:noa", {"kind": "Person"}))
        k.publish(Event("edge.set", "person:roei", {"to": "person:noa", "attrs": {"trust": 0.87}}))
        g = k.state.world_graph                              # (5) world graph updated
        self.assertIn("person:roei", g["nodes"])
        self.assertEqual(g["edges"][("person:roei", "person:noa")]["trust"], 0.87)

    def test_state_is_pure_projection_of_store(self):
        k = Kernel()
        k.publish(UserSpoke("hi"))
        k.publish(Event("node.added", "p:1", {"kind": "Person"}))
        # State must equal a fresh fold of the log (RFC-030): no hidden state.
        self.assertEqual(k.state, build_state(k.store.events()))

    def test_health_reports_green(self):
        k = Kernel()
        k.publish(UserSpoke("hi"))
        h = k.health.observe()                               # (6) observable (OBS-001)
        self.assertEqual(h["health"], "green")
        self.assertEqual(h["event_count"], 1)


if __name__ == "__main__":
    unittest.main(verbosity=2)
