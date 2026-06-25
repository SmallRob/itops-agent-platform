import concurrent.futures
from unittest.mock import patch

import pytest

from src.api.llm_config_manager import LLMConfig, LLMConfigManager, get_llm_config_manager
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


class TestInvalidProvider:
    """Test that invalid provider raises ValueError instead of silently failing."""

    def test_update_config_invalid_provider(self):
        manager = LLMConfigManager()
        config = LLMConfig(
            provider="invalid_provider",
            model="test-model",
        )
        with pytest.raises(ValueError):
            manager.update_config(config)

    def test_update_provider_invalid(self):
        manager = LLMConfigManager()
        with pytest.raises(ValueError):
            manager.update_provider("nonexistent")


class TestUpdateConfigEdgeCases:
    """Test partial None fields and falsy-but-valid values."""

    def test_partial_none_fields(self):
        """api_key=None should not overwrite existing settings."""
        manager = LLMConfigManager()
        config = LLMConfig(
            provider="openai",
            model="new-model",
            api_key=None,
            api_base=None,
            temperature=None,
            max_tokens=None,
        )
        manager.update_config(config)
        assert manager.get_config().model == "new-model"

    def test_temperature_zero(self):
        """temperature=0.0 is falsy but valid and must be applied."""
        manager = LLMConfigManager()
        config = LLMConfig(
            provider="openai",
            model="test-model",
            temperature=0.0,
            max_tokens=0,
        )
        manager.update_config(config)
        cfg = manager.get_config()
        assert cfg.temperature == 0.0
        assert cfg.max_tokens == 0

    def test_update_provider_reloads_config(self):
        """After switching provider, config should reflect new provider's settings."""
        with patch("src.api.llm_config_manager.settings") as mock_settings:
            mock_settings.llm_provider = LLMProvider.OPENAI
            mock_settings.llm_model = "gpt-4o"
            mock_settings.llm_temperature = 0.7
            mock_settings.llm_max_tokens = 4096
            mock_settings.get_llm_config.return_value = {
                "api_key": "sk-openai",
                "api_base": "https://api.openai.com/v1",
                "model": "gpt-4o",
            }
            manager = LLMConfigManager()

            mock_settings.llm_provider = LLMProvider.DEEPSEEK
            mock_settings.get_llm_config.return_value = {
                "api_key": "sk-deepseek",
                "api_base": "https://api.deepseek.com/v1",
                "model": "deepseek-chat",
            }
            manager.update_provider("deepseek")

            cfg = manager.get_config()
            assert cfg.provider == "deepseek"
            assert cfg.api_key == "sk-deepseek"
            assert cfg.model == "deepseek-chat"


class TestThreadSafety:
    """Test concurrent access to singleton."""

    def test_concurrent_singleton_access(self):
        """Multiple threads calling get_llm_config_manager should return the same instance."""
        import src.api.llm_config_manager as mod
        mod._llm_config_manager = None

        results = []

        def get_manager():
            results.append(get_llm_config_manager())

        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(get_manager) for _ in range(20)]
            concurrent.futures.wait(futures)

        assert all(r is results[0] for r in results)
