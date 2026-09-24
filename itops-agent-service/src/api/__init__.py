"""API模块 - FastAPI后端服务"""

from __future__ import annotations

from typing import Any, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from ..agents import ITOpsAgent, LLMNotConfiguredError, create_agent
from ..config import settings
from ..deps import AgentDeps
from ..knowledge import get_knowledge_base
from ..sessions import SESSION_KEY_FIELDS, session_store
from .agent_registry import get_agent_registry, AgentConfig
from .llm_config_manager import get_llm_config_manager, LLMConfig


# 创建FastAPI应用
app = FastAPI(
    title="ITOps Agent Service",
    description="智能运维Agent服务",
    version="0.1.0",
)

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# 请求/响应模型
class ChatRequest(BaseModel):
    """聊天请求"""
    message: str = Field(description="用户消息")
    agent_type: str = Field(
        default="general",
        pattern=r"^[A-Za-z0-9_-]{1,64}$",
        description="Agent类型（内置类型或已注册的 Agent ID）",
    )
    context: Optional[dict[str, Any]] = Field(default=None, description="上下文")
    stream: bool = Field(default=False, description="是否流式输出")


class ChatResponse(BaseModel):
    """聊天响应"""
    content: str = Field(description="响应内容")
    agent_type: str = Field(description="Agent类型")
    thinking: Optional[str] = Field(default=None, description="思考过程")
    tools_used: list[str] = Field(default_factory=list, description="使用的工具")
    suggestions: list[str] = Field(default_factory=list, description="后续建议")


class KnowledgeSearchRequest(BaseModel):
    """知识库搜索请求"""
    query: str = Field(description="搜索查询")
    category: Optional[str] = Field(default=None, description="知识类别")
    limit: int = Field(default=5, description="返回数量限制")


class KnowledgeSearchResponse(BaseModel):
    """知识库搜索响应"""
    results: list[dict[str, Any]] = Field(description="搜索结果")
    total: int = Field(description="结果总数")


# Agent缓存（实例只保存配置；模型在运行时解析，LLM 配置变更无需失效）
_agents: dict[str, ITOpsAgent] = {}


def get_agent(agent_type: str = "general") -> ITOpsAgent:
    """获取或创建内置 Agent 实例"""
    if agent_type not in _agents:
        _agents[agent_type] = create_agent(agent_type)
    return _agents[agent_type]


def get_chat_agent(agent_type: str = "general") -> ITOpsAgent:
    """解析对话 Agent：动态注册表优先（平台注册的 Agent ID），内置类型兜底"""
    registered = get_agent_registry().get_agent(agent_type)
    if registered is not None:
        return registered
    return get_agent(agent_type)


def _extract_session_key(context: Optional[dict[str, Any]]) -> str:
    """从请求上下文提取会话标识（远端 Provider 透传的 sessionKey）"""
    if context:
        for field_name in SESSION_KEY_FIELDS:
            value = context.get(field_name)
            if isinstance(value, str) and value.strip():
                return value.strip()[:128]
    return "default"


# API端点
@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """聊天接口

    与Agent进行对话
    """
    try:
        agent = get_chat_agent(request.agent_type)
        session_key = _extract_session_key(request.context)

        # 构建依赖（注入知识库，供 search_knowledge 工具使用）
        deps = AgentDeps(
            settings=settings,
            user_id="api_user",
            context=request.context or {},
            knowledge_base=await get_knowledge_base(),
        )

        # 注入会话历史，执行后回写
        history = session_store.render(session_key)
        response = await agent.run(
            message=request.message,
            deps=deps,
            context=request.context,
            history=history,
        )
        session_store.remember(session_key, request.message, response.content)

        return ChatResponse(
            content=response.content,
            agent_type=request.agent_type,
            thinking=response.thinking,
            tools_used=response.tools_used,
            suggestions=response.suggestions,
        )
    except LLMNotConfiguredError as e:
        # 配置缺失与故障区分开：503 语义让上层降级链/调用方可识别
        raise HTTPException(status_code=503, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post("/api/chat/stream")
async def chat_stream(request: ChatRequest):
    """流式聊天接口

    与Agent进行流式对话
    """
    try:
        agent = get_chat_agent(request.agent_type)
        session_key = _extract_session_key(request.context)

        # 构建依赖
        deps = AgentDeps(
            settings=settings,
            user_id="api_user",
            context=request.context or {},
            knowledge_base=await get_knowledge_base(),
        )
        history = session_store.render(session_key)

        async def generate():
            chunks: list[str] = []
            async for text in agent.run_stream(
                message=request.message,
                deps=deps,
                context=request.context,
                history=history,
            ):
                chunks.append(text)
                yield f"data: {text}\n\n"
            yield "data: [DONE]\n\n"
            session_store.remember(session_key, request.message, "".join(chunks))

        return StreamingResponse(
            generate(),
            media_type="text/event-stream",
        )
    except LLMNotConfiguredError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post("/api/knowledge/search", response_model=KnowledgeSearchResponse)
async def knowledge_search(request: KnowledgeSearchRequest):
    """知识库搜索接口"""
    try:
        kb = await get_knowledge_base()
        results = await kb.search(
            query=request.query,
            category=request.category,
            limit=request.limit,
        )

        return KnowledgeSearchResponse(
            results=[{
                "title": r.article.title,
                "category": r.article.category,
                "summary": r.article.summary,
                "content": r.article.content,
                "score": r.score,
                "highlights": r.highlights,
            } for r in results],
            total=len(results),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/knowledge/categories")
async def knowledge_categories():
    """获取知识库类别"""
    try:
        kb = await get_knowledge_base()
        categories = await kb.list_categories()
        return {"categories": [c.model_dump() for c in categories]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/agents")
async def list_agents():
    """列出可用的Agent（内置类型 + 动态注册）"""
    builtin = [
        {"type": "general", "name": "通用运维Agent", "description": "处理各种运维问题"},
        {"type": "alert", "name": "告警处理Agent", "description": "专注于告警分析和处理"},
        {"type": "diagnosis", "name": "故障诊断Agent", "description": "专注于故障诊断和分析"},
        {"type": "inspection", "name": "巡检Agent", "description": "专注于系统巡检和检查"},
    ]
    registry = get_agent_registry()
    dynamic = [
        {"type": agent_type, "name": (config.name if config else agent_type), "description": "平台注册 Agent"}
        for agent_type in registry.list_agents()
        if (config := registry.get_config(agent_type)) is not None
    ]
    return {"agents": builtin + dynamic}


@app.post("/api/agents/{agent_type}/register")
async def register_agent(agent_type: str, config: AgentConfig):
    """Register a new agent type"""
    if not agent_type or not agent_type.strip():
        raise HTTPException(status_code=422, detail="agent_type must be a non-empty string")
    try:
        registry = get_agent_registry()
        registry.register(agent_type.strip(), config)
        return {"success": True, "agent_type": agent_type.strip()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/agents/{agent_type}/unregister")
async def unregister_agent(agent_type: str):
    """Unregister an agent type"""
    if not agent_type or not agent_type.strip():
        raise HTTPException(status_code=422, detail="agent_type must be a non-empty string")
    try:
        registry = get_agent_registry()
        if not registry.unregister(agent_type.strip()):
            raise HTTPException(status_code=404, detail=f"Agent '{agent_type.strip()}' not found")
        return {"success": True, "agent_type": agent_type.strip()}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/agents/registered")
async def list_registered_agents():
    """List all registered agents"""
    registry = get_agent_registry()
    agents = registry.list_agents()
    configs = {
        agent_type: config.model_dump()
        for agent_type in agents
        if (config := registry.get_config(agent_type)) is not None
    }
    return {"agents": agents, "configs": configs}


@app.post("/api/llm/config")
async def update_llm_config(config: LLMConfig):
    """Update LLM configuration"""
    try:
        manager = get_llm_config_manager()
        manager.update_config(config)
        return {"success": True, "config": _redact_config(manager.get_config())}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/llm/config")
async def get_llm_config():
    """Get current LLM configuration"""
    manager = get_llm_config_manager()
    return {"config": _redact_config(manager.get_config())}


def _redact_config(config: LLMConfig) -> dict[str, Any]:
    """导出配置时脱敏 API Key"""
    config_data = config.model_dump()
    if config_data.get("api_key"):
        config_data["api_key"] = "***REDACTED***"
    return config_data


@app.get("/api/health")
async def health_check_v2():
    """Health check endpoint"""
    llm_configured = bool(get_llm_config_manager().get_config().api_key)
    return {
        "status": "healthy",
        "version": "0.1.0",
        "agents_registered": len(get_agent_registry().list_agents()),
        "llm_configured": llm_configured,
    }


# 启动事件
@app.on_event("startup")
async def startup_event():
    """应用启动时执行"""
    # 初始化知识库（预热，chat 请求即可注入）
    await get_knowledge_base()


# 运行入口
def run_api():
    """运行API服务"""
    import uvicorn
    uvicorn.run(
        "src.api:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )


if __name__ == "__main__":
    run_api()
