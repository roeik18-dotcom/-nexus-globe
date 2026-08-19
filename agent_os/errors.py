"""Typed errors for the P0 agent foundation."""


class AgentOSError(Exception):
    """Base for all agent_os errors."""


class ManifestValidationError(AgentOSError):
    """A manifest is structurally invalid or violates a default-deny / authority rule."""


class DomainError(ManifestValidationError):
    """A referenced domain is unknown, or a protected domain was used without grant."""


class CapabilityError(ManifestValidationError):
    """A referenced capability is unknown / not in the controlled vocabulary."""


class DuplicateAgentError(AgentOSError):
    """An agent_id already exists in the registry."""
