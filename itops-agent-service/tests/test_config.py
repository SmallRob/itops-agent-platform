"""测试配置"""

import pytest
from src.config import Settings, LLMProvider, LogLevel


def test_default_settings():
    """测试默认配置"""
    settings = Settings()
    
    assert settings.app_name == "ITOps Agent Service"
    assert settings.app_version == "0.1.0"
    assert settings.debug is False
    assert settings.log_level == LogLevel.INFO
    assert settings.host == "0.0.0.0"
    assert settings.port == 8000
    assert settings.llm_provider == LLMProvider.OPENAI
    assert settings.llm_model == "gpt-4o"
    assert settings.llm_temperature == 0.7
    assert settings.llm_max_tokens == 4096


def test_custom_settings():
    """测试自定义配置"""
    settings = Settings(
        debug=True,
        log_level=LogLevel.DEBUG,
        port=9000,
        llm_provider=LLMProvider.DOUBAO,
        llm_model="doubao-4o",
    )
    
    assert settings.debug is True
    assert settings.log_level == LogLevel.DEBUG
    assert settings.port == 9000
    assert settings.llm_provider == LLMProvider.DOUBAO
    assert settings.llm_model == "doubao-4o"


def test_llm_config_openai():
    """测试OpenAI配置"""
    settings = Settings(
        llm_provider=LLMProvider.OPENAI,
        openai_api_key="test-key",
        openai_api_base="https://api.openai.com/v1",
        llm_model="gpt-4o",
    )
    
    config = settings.get_llm_config()
    
    assert config["api_key"] == "test-key"
    assert config["api_base"] == "https://api.openai.com/v1"
    assert config["model"] == "gpt-4o"


def test_llm_config_doubao():
    """测试豆包配置"""
    settings = Settings(
        llm_provider=LLMProvider.DOUBAO,
        doubao_api_key="test-key",
        doubao_api_base="https://ark.cn-beijing.volces.com/api/v3",
        doubao_model="doubao-4o",
    )
    
    config = settings.get_llm_config()
    
    assert config["api_key"] == "test-key"
    assert config["api_base"] == "https://ark.cn-beijing.volces.com/api/v3"
    assert config["model"] == "doubao-4o"


def test_llm_provider_enum():
    """测试LLM提供商枚举"""
    assert LLMProvider.OPENAI == "openai"
    assert LLMProvider.DOUBAO == "doubao"
    assert LLMProvider.DEEPSEEK == "deepseek"
    assert LLMProvider.QWEN == "qwen"
    assert LLMProvider.LOCAL == "local"


def test_log_level_enum():
    """测试日志级别枚举"""
    assert LogLevel.DEBUG == "DEBUG"
    assert LogLevel.INFO == "INFO"
    assert LogLevel.WARNING == "WARNING"
    assert LogLevel.ERROR == "ERROR"
