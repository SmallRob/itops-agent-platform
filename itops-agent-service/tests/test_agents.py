"""测试Agent模块"""

import pytest
from unittest.mock import AsyncMock, MagicMock

from src.agents import ITOpsAgent, create_agent, AgentResponse
from src.config import Settings
from src.deps import AgentDeps


@pytest.fixture
def settings():
    """创建测试配置"""
    return Settings(
        llm_provider="openai",
        llm_model="gpt-4o",
        openai_api_key="test-key",
    )


@pytest.fixture
def deps(settings):
    """创建测试依赖"""
    return AgentDeps(settings=settings)


def test_create_agent():
    """测试创建Agent"""
    agent = create_agent("general")
    assert agent is not None
    assert agent.name == "itops-agent"


def test_create_alert_agent():
    """测试创建告警Agent"""
    agent = create_agent("alert")
    assert agent is not None
    assert agent.name == "alert-agent"


def test_create_diagnosis_agent():
    """测试创建诊断Agent"""
    agent = create_agent("diagnosis")
    assert agent is not None
    assert agent.name == "diagnosis-agent"


def test_create_inspection_agent():
    """测试创建巡检Agent"""
    agent = create_agent("inspection")
    assert agent is not None
    assert agent.name == "inspection-agent"


def test_agent_response_model():
    """测试Agent响应模型"""
    response = AgentResponse(
        content="测试响应",
        thinking="思考过程",
        tools_used=["tool1", "tool2"],
        confidence=0.95,
        suggestions=["建议1", "建议2"],
    )
    
    assert response.content == "测试响应"
    assert response.thinking == "思考过程"
    assert len(response.tools_used) == 2
    assert response.confidence == 0.95
    assert len(response.suggestions) == 2
