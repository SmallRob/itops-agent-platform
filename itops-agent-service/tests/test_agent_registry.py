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


def test_agent_with_tools(registry):
    config = AgentConfig(
        name="tools-agent",
        system_prompt="Agent with specific tools",
        model="openai:gpt-4o",
        tools=["search_knowledge", "execute_command"],
    )
    registry.register("custom", config)
    agent = registry.get_agent("custom")
    assert agent is not None
    assert agent._enabled_tools == ["search_knowledge", "execute_command"]


def test_agent_with_metadata(registry):
    config = AgentConfig(
        name="meta-agent",
        system_prompt="Agent with metadata",
        model="openai:gpt-4o",
        metadata={"team": "ops", "environment": "production"},
    )
    registry.register("custom", config)
    agent = registry.get_agent("custom")
    assert agent is not None
    assert agent.metadata == {"team": "ops", "environment": "production"}


def test_agent_with_tools_and_metadata(registry):
    config = AgentConfig(
        name="full-agent",
        system_prompt="Agent with tools and metadata",
        model="openai:gpt-4o",
        tools=["get_alerts"],
        metadata={"region": "us-east-1", "priority": 1},
    )
    registry.register("custom", config)
    agent = registry.get_agent("custom")
    assert agent is not None
    assert agent._enabled_tools == ["get_alerts"]
    assert agent.metadata == {"region": "us-east-1", "priority": 1}


def test_agent_without_tools_uses_all(registry):
    config = AgentConfig(
        name="all-tools-agent",
        system_prompt="Agent with all tools",
        model="openai:gpt-4o",
    )
    registry.register("custom", config)
    agent = registry.get_agent("custom")
    assert agent is not None
    assert agent._enabled_tools is None
