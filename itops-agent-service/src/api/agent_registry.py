from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field

from ..agents import ITOpsAgent, create_agent


class AgentConfig(BaseModel):
    """Agent configuration"""
    name: str = Field(description="Agent display name")
    system_prompt: str = Field(description="System prompt")
    model: Optional[str] = Field(default=None, description="LLM model")
    tools: list[str] = Field(default_factory=list, description="Enabled tools")
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

    def unregister(self, agent_type: str) -> None:
        """Unregister an agent type"""
        self._agents.pop(agent_type, None)
        self._configs.pop(agent_type, None)

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
        predefined_types = ["general", "alert", "diagnosis", "inspection"]

        if agent_type in predefined_types:
            return create_agent(agent_type, model=config.model)

        return ITOpsAgent(
            name=config.name,
            system_prompt=config.system_prompt,
            model=config.model,
            tools=config.tools or None,
            metadata=config.metadata or None,
        )


_agent_registry: Optional[AgentRegistry] = None


def get_agent_registry() -> AgentRegistry:
    """Get global agent registry instance"""
    global _agent_registry
    if _agent_registry is None:
        _agent_registry = AgentRegistry()
    return _agent_registry
