"""Capabilities — event-driven layers on top of kernel-v0.

Each capability reacts to events on the Kernel Bus and emits NEW events. It never
mutates State directly (that's the reducer's job) and never reaches into another
capability (RFC-000 §8). Independently testable and replaceable.
"""
