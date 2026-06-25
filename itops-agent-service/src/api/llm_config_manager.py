from __future__ import annotations

import threading
from typing import Optional

from pydantic import BaseModel, Field

from ..config import LLMProvider, settings

_PROVIDER_SETTINGS_MAP: dict[str, dict[str, str]] = {
    "openai": {"api_key": "openai_api_key", "api_base": "openai_api_base"},
    "doubao": {"api_key": "doubao_api_key", "api_base": "doubao_api_base"},
    "deepseek": {"api_key": "deepseek_api_key", "api_base": "deepseek_api_base"},
    "qwen": {"api_key": "qwen_api_key", "api_base": "qwen_api_base"},
}


class LLMConfig(BaseModel):
    """LLM configuration"""
    provider: str = Field(description="LLM provider (openai, doubao, deepseek, etc.)")
    model: str = Field(description="Model name")
    api_key: Optional[str] = Field(default=None, description="API key")
    api_base: Optional[str] = Field(default=None, description="API base URL")
    temperature: Optional[float] = Field(default=None, description="Temperature")
    max_tokens: Optional[int] = Field(default=None, description="Max tokens")


class LLMConfigManager:
    """LLM configuration manager"""

    def __init__(self):
        self._config: LLMConfig = self._load_from_settings()

    def _load_from_settings(self) -> LLMConfig:
        """Load config from settings based on current provider"""
        provider = settings.llm_provider
        llm_config = settings.get_llm_config()

        return LLMConfig(
            provider=provider.value,
            model=llm_config.get("model", settings.llm_model),
            api_key=llm_config.get("api_key"),
            api_base=llm_config.get("api_base"),
            temperature=settings.llm_temperature,
            max_tokens=settings.llm_max_tokens,
        )

    def get_config(self) -> LLMConfig:
        """Get current LLM configuration"""
        return self._config

    def update_config(self, config: LLMConfig) -> None:
        """Update LLM configuration"""
        self._config = config
        self._apply_to_settings(config)

    def update_provider(self, provider: str) -> None:
        """Update LLM provider and reload provider-specific config"""
        settings.llm_provider = LLMProvider(provider)
        self._config = self._load_from_settings()

    def update_model(self, model: str) -> None:
        """Update LLM model"""
        self._config.model = model
        settings.llm_model = model

    def _apply_to_settings(self, config: LLMConfig) -> None:
        """Apply config to settings"""
        settings.llm_provider = LLMProvider(config.provider)

        if config.model:
            settings.llm_model = config.model

        if config.api_key:
            attrs = _PROVIDER_SETTINGS_MAP.get(config.provider)
            if attrs:
                setattr(settings, attrs["api_key"], config.api_key)

        if config.api_base:
            attrs = _PROVIDER_SETTINGS_MAP.get(config.provider)
            if attrs:
                setattr(settings, attrs["api_base"], config.api_base)

        if config.temperature is not None:
            settings.llm_temperature = config.temperature
        if config.max_tokens is not None:
            settings.llm_max_tokens = config.max_tokens


_lock = threading.Lock()
_llm_config_manager: Optional[LLMConfigManager] = None


def get_llm_config_manager() -> LLMConfigManager:
    """Get global LLM config manager instance (thread-safe)"""
    global _llm_config_manager
    if _llm_config_manager is None:
        with _lock:
            if _llm_config_manager is None:
                _llm_config_manager = LLMConfigManager()
    return _llm_config_manager
