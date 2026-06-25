import pytest
from src.api.agent_registry import AgentRegistry, AgentConfig


@pytest.fixture
def registry():
    return AgentRegistry()


def test_register_agent(registry):
    config = AgentConfig(
        name="test-agent",
        system_prompt="You are a test agent",
        model="openai:gpt-4o"
    )
    registry.register("test", config)
    assert "test" in registry.list_agents()


def test_unregister_agent(registry):
    config = AgentConfig(
        name="test-agent",
        system_prompt="You are a test agent",
        model="openai:gpt-4o"
    )
    registry.register("test", config)
    registry.unregister("test")
    assert "test" not in registry.list_agents()


def test_get_agent(registry):
    config = AgentConfig(
        name="test-agent",
        system_prompt="You are a test agent",
        model="openai:gpt-4o"
    )
    registry.register("test", config)
    agent = registry.get_agent("test")
    assert agent is not None
    assert agent.name == "test-agent"


def test_list_agents(registry):
    config1 = AgentConfig(name="agent1", system_prompt="Agent 1")
    config2 = AgentConfig(name="agent2", system_prompt="Agent 2")
    registry.register("test1", config1)
    registry.register("test2", config2)
    agents = registry.list_agents()
    assert len(agents) == 2
    assert "test1" in agents
    assert "test2" in agents
