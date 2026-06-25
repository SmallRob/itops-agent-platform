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


def test_unregister_returns_true_for_existing(registry):
    config = AgentConfig(name="a", system_prompt="A")
    registry.register("to-remove", config)
    assert registry.unregister("to-remove") is True


def test_unregister_returns_false_for_missing(registry):
    assert registry.unregister("nonexistent") is False


def test_reregister_overwrites(registry):
    config1 = AgentConfig(name="v1", system_prompt="Version 1", model="openai:gpt-4o")
    config2 = AgentConfig(name="v2", system_prompt="Version 2", model="openai:gpt-4o")
    registry.register("dup", config1)
    registry.register("dup", config2)
    assert len(registry.list_agents()) == 1
    assert registry.get_agent("dup").name == "v2"
    assert registry.get_config("dup").system_prompt == "Version 2"


def test_get_agent_unregistered_returns_none(registry):
    assert registry.get_agent("nope") is None


def test_get_config_unregistered_returns_none(registry):
    assert registry.get_config("nope") is None


def test_predefined_type_preserves_config(registry):
    config = AgentConfig(
        name="custom-alert",
        system_prompt="Custom alert prompt",
        model="openai:gpt-4o",
        tools=["get_alerts"],
        metadata={"priority": "high"},
    )
    registry.register("alert", config)
    agent = registry.get_agent("alert")
    assert agent is not None
    assert agent.name == "custom-alert"
    assert agent.system_prompt == "Custom alert prompt"
    assert agent._enabled_tools == ["get_alerts"]
    assert agent.metadata == {"priority": "high"}


def test_empty_tools_list_means_no_tools(registry):
    config = AgentConfig(
        name="no-tools-agent",
        system_prompt="Agent with no tools",
        model="openai:gpt-4o",
        tools=[],
    )
    registry.register("empty", config)
    agent = registry.get_agent("empty")
    assert agent is not None
    assert agent._enabled_tools == []
