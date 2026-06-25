"""Pytest配置"""

import pytest
from pathlib import Path

from src.config import Settings


@pytest.fixture
def test_settings():
    """测试配置"""
    return Settings(
        debug=True,
        log_level="DEBUG",
        llm_provider="openai",
        llm_model="gpt-4o",
        openai_api_key="test-key",
        knowledge_base_path=Path("tests/knowledge"),
    )


@pytest.fixture
def knowledge_path(tmp_path):
    """临时知识库路径"""
    return tmp_path / "knowledge"


@pytest.fixture(autouse=True)
def setup_test_env(tmp_path, monkeypatch):
    """设置测试环境"""
    # 设置临时目录
    monkeypatch.chdir(tmp_path)
    
    # 创建必要的目录
    (tmp_path / "data").mkdir(exist_ok=True)
    (tmp_path / "knowledge").mkdir(exist_ok=True)
