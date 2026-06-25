import pytest
from src.api.llm_config_manager import LLMConfigManager, LLMConfig

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
