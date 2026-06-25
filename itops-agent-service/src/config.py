"""配置管理模块"""

from __future__ import annotations

from enum import Enum
from pathlib import Path
from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class LogLevel(str, Enum):
    """日志级别"""
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"


class LLMProvider(str, Enum):
    """LLM提供商"""
    OPENAI = "openai"
    DOUBAO = "doubao"
    DEEPSEEK = "deepseek"
    QWEN = "qwen"
    LOCAL = "local"


class Settings(BaseSettings):
    """应用配置"""
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # 应用配置
    app_name: str = "ITOps Agent Service"
    app_version: str = "0.1.0"
    debug: bool = False
    log_level: LogLevel = LogLevel.INFO

    # 服务配置
    host: str = "0.0.0.0"
    port: int = 8000
    
    # 数据库配置
    database_url: str = "sqlite+aiosqlite:///./data/itops_agent.db"
    
    # LLM配置
    llm_provider: LLMProvider = LLMProvider.OPENAI
    llm_model: str = "gpt-4o"
    llm_temperature: float = 0.7
    llm_max_tokens: int = 4096
    
    # OpenAI配置
    openai_api_key: Optional[str] = None
    openai_api_base: str = "https://api.openai.com/v1"
    
    # 豆包配置
    doubao_api_key: Optional[str] = None
    doubao_api_base: str = "https://ark.cn-beijing.volces.com/api/v3"
    doubao_model: str = "doubao-4o"
    
    # DeepSeek配置
    deepseek_api_key: Optional[str] = None
    deepseek_api_base: str = "https://api.deepseek.com/v1"
    
    # 通义千问配置
    qwen_api_key: Optional[str] = None
    qwen_api_base: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    
    # 本地模型配置
    local_api_base: Optional[str] = None
    local_model: Optional[str] = None
    
    # 知识库配置
    knowledge_base_path: Path = Field(default_factory=lambda: Path("knowledge"))
    vector_store_path: Path = Field(default_factory=lambda: Path("data/vectors"))
    
    # MCP配置
    mcp_enabled: bool = True
    mcp_host: str = "0.0.0.0"
    mcp_port: int = 8001
    
    # 安全配置
    api_key: Optional[str] = None
    cors_origins: list[str] = ["*"]
    
    def get_llm_config(self) -> dict:
        """获取当前LLM配置"""
        if self.llm_provider == LLMProvider.OPENAI:
            return {
                "api_key": self.openai_api_key,
                "api_base": self.openai_api_base,
                "model": self.llm_model,
            }
        elif self.llm_provider == LLMProvider.DOUBAO:
            return {
                "api_key": self.doubao_api_key,
                "api_base": self.doubao_api_base,
                "model": self.doubao_model,
            }
        elif self.llm_provider == LLMProvider.DEEPSEEK:
            return {
                "api_key": self.deepseek_api_key,
                "api_base": self.deepseek_api_base,
                "model": self.llm_model,
            }
        elif self.llm_provider == LLMProvider.QWEN:
            return {
                "api_key": self.qwen_api_key,
                "api_base": self.qwen_api_base,
                "model": self.llm_model,
            }
        elif self.llm_provider == LLMProvider.LOCAL:
            return {
                "api_key": "ollama",
                "api_base": self.local_api_base,
                "model": self.local_model,
            }
        return {}


# 全局配置实例
settings = Settings()
