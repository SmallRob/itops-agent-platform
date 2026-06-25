from __future__ import annotations

import threading
from typing import Any, Optional

from pydantic import BaseModel, Field

from ..agents import ITOpsAgent


class AgentConfig(BaseModel):
    """Agent configuration"""
    name: str = Field(description="Agent display name")
    system_prompt: str = Field(description="System prompt")
    model: Optional[str] = Field(default=None, description="LLM model")
    tools: Optional[list[str]] = Field(default=None, description="Enabled tools, None means all tools")
    metadata: dict[str, Any] = Field(default_factory=dict, description="Additional metadata")


class AgentRegistry:
    """Dynamic agent registry"""

    def __init__(self):
        self._agents: dict[str, ITOpsAgent] = {}
        self._configs: dict[str, AgentConfig] = {}

    def register(self, agent_type: str, config: AgentConfig) -> None:
        """Register a new agent type"""
        self._configs[agent_type] = config
        agent = self._create_agent_from_config(agent_type, config)
        self._agents[agent_type] = agent

    def unregister(self, agent_type: str) -> bool:
        """Unregister an agent type. Returns True if found and removed."""
        agent_removed = self._agents.pop(agent_type, None) is not None
        self._configs.pop(agent_type, None)
        return agent_removed

    def get_agent(self, agent_type: str) -> Optional[ITOpsAgent]:
        """Get agent instance by type"""
        return self._agents.get(agent_type)

    def list_agents(self) -> list[str]:
        """List all registered agent types"""
        return list(self._agents.keys())

    def get_config(self, agent_type: str) -> Optional[AgentConfig]:
        """Get agent configuration"""
        return self._configs.get(agent_type)

    def _create_agent_from_config(self, agent_type: str, config: AgentConfig) -> ITOpsAgent:
        """Create agent instance from config"""
        return ITOpsAgent(
            name=config.name,
            system_prompt=config.system_prompt,
            model=config.model,
            tools=config.tools,
            metadata=config.metadata if config.metadata else None,
        )


_agent_registry: Optional[AgentRegistry] = None
_registry_lock = threading.Lock()


def get_agent_registry() -> AgentRegistry:
    """Get global agent registry instance"""
    global _agent_registry
    if _agent_registry is None:
        with _registry_lock:
            if _agent_registry is None:
                _agent_registry = AgentRegistry()
    return _agent_registry
