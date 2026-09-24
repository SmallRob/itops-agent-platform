"""测试对话链路语义：注册表优先、LLM 配置解析、503 结构化错误"""

import json

import pytest
from fastapi.testclient import TestClient

from src.agents import LLMNotConfiguredError, resolve_model
from src.api import app, get_chat_agent
from src.api.agent_registry import AgentConfig, get_agent_registry
from src.api.llm_config_manager import LLMConfig, get_llm_config_manager


@pytest.fixture
def client():
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


class TestChatAgentResolution:
    def test_registered_agent_takes_priority(self):
        registry = get_agent_registry()
        registry.register("a71d6d4e-f29f-4a90", AgentConfig(name="平台Agent", system_prompt="平台提示词"))
        agent = get_chat_agent("a71d6d4e-f29f-4a90")
        assert agent is registry.get_agent("a71d6d4e-f29f-4a90")
        assert agent.system_prompt == "平台提示词"

    def test_builtin_fallback(self):
        agent = get_chat_agent("alert")
        assert agent.name == "alert-agent"

    def test_unknown_type_falls_back_to_general(self):
        agent = get_chat_agent("not-exist-type")
        assert agent.name == "itops-agent"


class TestChatErrors:
    def test_chat_without_llm_config_returns_503(self, client):
        """未配置 LLM 时应返回 503 与可行动的错误信息（而非裸 500）"""
        response = client.post("/api/chat", json={"message": "你好", "agent_type": "general"})
        assert response.status_code == 503
        assert "LLM" in response.json()["detail"]

    def test_chat_rejects_invalid_agent_type(self, client):
        response = client.post("/api/chat", json={"message": "你好", "agent_type": "../evil"})
        assert response.status_code == 422


class TestResolveModel:
    def test_raises_without_api_key(self):
        with pytest.raises(LLMNotConfiguredError):
            resolve_model()

    def test_builds_model_with_config(self):
        manager = get_llm_config_manager()
        manager.update_config(LLMConfig(
            provider="deepseek",
            model="deepseek-v4-flash",
            api_key="test-key",
            api_base="https://api.deepseek.com/v1",
        ))
        model = resolve_model()
        assert getattr(model, "model_name", "") == "deepseek-v4-flash"

    def test_strips_provider_prefix(self):
        manager = get_llm_config_manager()
        manager.update_config(LLMConfig(
            provider="deepseek",
            model="deepseek-v4-flash",
            api_key="test-key",
            api_base="https://api.deepseek.com/v1",
        ))
        model = resolve_model("openai:gpt-4o")
        # 前缀串只用于取模型名，凭据/端点仍来自配置管理器
        assert getattr(model, "model_name", "") == "gpt-4o"


class TestLLMPersistence:
    def test_config_survives_manager_restart(self):
        """配置更新后，新建的 manager 实例应从持久化文件恢复（模拟容器重启）"""
        manager = get_llm_config_manager()
        manager.update_config(LLMConfig(
            provider="deepseek",
            model="deepseek-v4-flash",
            api_key="sk-persist-test",
            api_base="https://api.deepseek.com/v1",
            max_tokens=4096,
        ))

        from src.api import llm_config_manager as lcm
        lcm._llm_config_manager = None  # 模拟进程重启
        restored = get_llm_config_manager().get_config()
        assert restored.provider == "deepseek"
        assert restored.model == "deepseek-v4-flash"
        assert restored.api_key == "sk-persist-test"

    def test_persisted_file_is_0600(self):
        import os

        manager = get_llm_config_manager()
        manager.update_config(LLMConfig(provider="openai", model="gpt-4o", api_key="k"))
        path = manager._config_path
        assert path.is_file()
        mode = os.stat(path).st_mode & 0o777
        assert mode == 0o600

    def test_redacted_in_get_response(self, client):
        get_llm_config_manager().update_config(LLMConfig(provider="openai", model="m", api_key="secret"))
        response = client.get("/api/llm/config")
        assert response.status_code == 200
        assert response.json()["config"]["api_key"] == "***REDACTED***"
