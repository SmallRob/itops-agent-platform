from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field

from ..config import settings, LLMProvider


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
        """Load config from settings"""
        return LLMConfig(
            provider=settings.llm_provider.value,
            model=settings.llm_model,
            api_key=settings.openai_api_key,
            api_base=settings.openai_api_base,
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
        """Update LLM provider"""
        self._config.provider = provider
        self._apply_provider(provider)
    
    def update_model(self, model: str) -> None:
        """Update LLM model"""
        self._config.model = model
        settings.llm_model = model
    
    def _apply_to_settings(self, config: LLMConfig) -> None:
        """Apply config to settings"""
        # Update provider
        try:
            settings.llm_provider = LLMProvider(config.provider)
        except ValueError:
            # If invalid provider, keep current
            pass
        
        # Update model
        if config.model:
            settings.llm_model = config.model
        
        # Update API key based on provider
        if config.api_key:
            if config.provider == "openai":
                settings.openai_api_key = config.api_key
            elif config.provider == "doubao":
                settings.doubao_api_key = config.api_key
            elif config.provider == "deepseek":
                settings.deepseek_api_key = config.api_key
            elif config.provider == "qwen":
                settings.qwen_api_key = config.api_key
        
        # Update API base
        if config.api_base:
            if config.provider == "openai":
                settings.openai_api_base = config.api_base
            elif config.provider == "doubao":
                settings.doubao_api_base = config.api_base
            elif config.provider == "deepseek":
                settings.deepseek_api_base = config.api_base
            elif config.provider == "qwen":
                settings.qwen_api_base = config.api_base
        
        # Update temperature and max tokens
        if config.temperature is not None:
            settings.llm_temperature = config.temperature
        if config.max_tokens is not None:
            settings.llm_max_tokens = config.max_tokens
    
    def _apply_provider(self, provider: str) -> None:
        """Apply provider change"""
        try:
            settings.llm_provider = LLMProvider(provider)
        except ValueError:
            pass


# Global config manager instance
_llm_config_manager: Optional[LLMConfigManager] = None


def get_llm_config_manager() -> LLMConfigManager:
    """Get global LLM config manager instance"""
    global _llm_config_manager
    if _llm_config_manager is None:
        _llm_config_manager = LLMConfigManager()
    return _llm_config_manager
