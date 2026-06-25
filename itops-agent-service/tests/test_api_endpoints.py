"""Tests for agent registration and LLM config API endpoints"""

import pytest
from fastapi.testclient import TestClient
from src.api import app
from src.api.agent_registry import AgentConfig, get_agent_registry
from src.api.llm_config_manager import LLMConfig, get_llm_config_manager


@pytest.fixture
def client():
    """Create test client"""
    return TestClient(app)


@pytest.fixture(autouse=True)
def reset_singletons():
    """Reset singleton instances between tests"""
    import src.api.agent_registry as ar
    import src.api.llm_config_manager as lcm
    ar._agent_registry = None
    lcm._llm_config_manager = None
    yield
    ar._agent_registry = None
    lcm._llm_config_manager = None


class TestHealthEndpoint:
    def test_health_check(self, client):
        response = client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["version"] == "0.1.0"
        assert data["agents_registered"] == 0


class TestAgentRegistration:
    def test_register_agent(self, client):
        config = {
            "name": "test-agent",
            "system_prompt": "You are a test agent",
            "model": "openai:gpt-4o"
        }
        response = client.post(
            "/api/agents/register",
            json=config,
            params={"agent_type": "test"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["agent_type"] == "test"

    def test_unregister_agent(self, client):
        config = {
            "name": "test-agent",
            "system_prompt": "You are a test agent",
            "model": "openai:gpt-4o"
        }
        client.post("/api/agents/register", json=config, params={"agent_type": "test"})

        response = client.post("/api/agents/unregister", params={"agent_type": "test"})
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["agent_type"] == "test"

    def test_list_registered_agents_empty(self, client):
        response = client.get("/api/agents/registered")
        assert response.status_code == 200
        data = response.json()
        assert data["agents"] == []
        assert data["configs"] == {}

    def test_list_registered_agents(self, client):
        config = {
            "name": "agent1",
            "system_prompt": "Agent 1",
            "model": "openai:gpt-4o"
        }
        client.post("/api/agents/register", json=config, params={"agent_type": "test1"})

        config2 = {
            "name": "agent2",
            "system_prompt": "Agent 2",
            "model": "openai:gpt-4o"
        }
        client.post("/api/agents/register", json=config2, params={"agent_type": "test2"})

        response = client.get("/api/agents/registered")
        assert response.status_code == 200
        data = response.json()
        assert len(data["agents"]) == 2
        assert "test1" in data["agents"]
        assert "test2" in data["agents"]
        assert "test1" in data["configs"]
        assert "test2" in data["configs"]

    def test_register_agent_with_tools(self, client):
        config = {
            "name": "tools-agent",
            "system_prompt": "Agent with tools",
            "model": "openai:gpt-4o",
            "tools": ["search_knowledge", "execute_command"]
        }
        response = client.post(
            "/api/agents/register",
            json=config,
            params={"agent_type": "custom"}
        )
        assert response.status_code == 200
        assert response.json()["success"] is True

        response = client.get("/api/agents/registered")
        data = response.json()
        assert "custom" in data["agents"]
        assert data["configs"]["custom"]["tools"] == ["search_knowledge", "execute_command"]


class TestLLMConfig:
    def test_get_llm_config(self, client):
        response = client.get("/api/llm/config")
        assert response.status_code == 200
        data = response.json()
        assert "config" in data
        assert "provider" in data["config"]
        assert "model" in data["config"]

    def test_update_llm_config(self, client):
        config = {
            "provider": "openai",
            "model": "gpt-4o",
            "temperature": 0.7,
            "max_tokens": 4096
        }
        response = client.post("/api/llm/config", json=config)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["config"]["provider"] == "openai"
        assert data["config"]["model"] == "gpt-4o"
        assert data["config"]["temperature"] == 0.7
        assert data["config"]["max_tokens"] == 4096

    def test_update_llm_config_persists(self, client):
        config = {
            "provider": "openai",
            "model": "gpt-4-turbo",
            "temperature": 0.5
        }
        client.post("/api/llm/config", json=config)

        response = client.get("/api/llm/config")
        data = response.json()
        assert data["config"]["model"] == "gpt-4-turbo"
        assert data["config"]["temperature"] == 0.5
