from unittest.mock import patch

import pytest

from src.api.llm_config_manager import LLMConfig, LLMConfigManager
from src.config import LLMProvider


@pytest.fixture
def manager():
    return LLMConfigManager()


def test_update_config(manager):
    config = LLMConfig(
        provider="openai",
        model="gpt-4o",
        api_key="test-key",
        api_base="https://api.openai.com/v1"
    )
    manager.update_config(config)
    assert manager.get_config().provider == "openai"
    assert manager.get_config().model == "gpt-4o"


def test_get_config(manager):
    config = manager.get_config()
    assert config is not None
    assert hasattr(config, 'provider')
    assert hasattr(config, 'model')


def test_update_provider(manager):
    manager.update_provider("doubao")
    assert manager.get_config().provider == "doubao"


def test_update_model(manager):
    manager.update_model("gpt-4o-mini")
    assert manager.get_config().model == "gpt-4o-mini"


class TestLoadFromSettings:
    """Test _load_from_settings loads correct API key and base per provider."""

    def _make_manager(self, provider, **kwargs):
        """Create a manager with mocked settings for a given provider."""
        with patch("src.api.llm_config_manager.settings") as mock_settings:
            mock_settings.llm_provider = provider
            mock_settings.llm_model = kwargs.get("model", "test-model")
            mock_settings.llm_temperature = 0.7
            mock_settings.llm_max_tokens = 4096
            mock_settings.get_llm_config.return_value = {
                "api_key": kwargs.get("api_key"),
                "api_base": kwargs.get("api_base"),
                "model": kwargs.get("model", "test-model"),
            }
            return LLMConfigManager()

    def test_openai(self):
        mgr = self._make_manager(
            LLMProvider.OPENAI,
            api_key="sk-openai-123",
            api_base="https://api.openai.com/v1",
        )
        cfg = mgr.get_config()
        assert cfg.provider == "openai"
        assert cfg.api_key == "sk-openai-123"
        assert cfg.api_base == "https://api.openai.com/v1"

    def test_deepseek(self):
        mgr = self._make_manager(
            LLMProvider.DEEPSEEK,
            api_key="sk-deepseek-456",
            api_base="https://api.deepseek.com/v1",
        )
        cfg = mgr.get_config()
        assert cfg.provider == "deepseek"
        assert cfg.api_key == "sk-deepseek-456"
        assert cfg.api_base == "https://api.deepseek.com/v1"

    def test_doubao(self):
        mgr = self._make_manager(
            LLMProvider.DOUBAO,
            api_key="sk-doubao-789",
            api_base="https://ark.cn-beijing.volces.com/api/v3",
        )
        cfg = mgr.get_config()
        assert cfg.provider == "doubao"
        assert cfg.api_key == "sk-doubao-789"
        assert cfg.api_base == "https://ark.cn-beijing.volces.com/api/v3"

    def test_qwen(self):
        mgr = self._make_manager(
            LLMProvider.QWEN,
            api_key="sk-qwen-abc",
            api_base="https://dashscope.aliyuncs.com/compatible-mode/v1",
        )
        cfg = mgr.get_config()
        assert cfg.provider == "qwen"
        assert cfg.api_key == "sk-qwen-abc"
        assert cfg.api_base == "https://dashscope.aliyuncs.com/compatible-mode/v1"

    def test_local(self):
        mgr = self._make_manager(
            LLMProvider.LOCAL,
            api_key="ollama",
            api_base="http://localhost:11434/v1",
        )
        cfg = mgr.get_config()
        assert cfg.provider == "local"
        assert cfg.api_key == "ollama"
        assert cfg.api_base == "http://localhost:11434/v1"
