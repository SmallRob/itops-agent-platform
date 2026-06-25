"""API模块 - FastAPI后端服务"""

from __future__ import annotations

from typing import Any, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from ..agents import ITOpsAgent, create_agent
from ..config import settings
from ..deps import AgentDeps
from ..knowledge import get_knowledge_base
from ..api.agent_registry import get_agent_registry, AgentConfig
from ..api.llm_config_manager import get_llm_config_manager, LLMConfig


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
    agent_type: str = Field(default="general", description="Agent类型")
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


# Agent缓存
_agents: dict[str, ITOpsAgent] = {}


def get_agent(agent_type: str = "general") -> ITOpsAgent:
    """获取或创建Agent实例"""
    if agent_type not in _agents:
        _agents[agent_type] = create_agent(agent_type)
    return _agents[agent_type]


# API端点
@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """聊天接口
    
    与Agent进行对话
    """
    try:
        agent = get_agent(request.agent_type)
        
        # 构建依赖
        deps = AgentDeps(
            settings=settings,
            user_id="api_user",
            context=request.context or {},
        )
        
        # 运行Agent
        response = await agent.run(
            message=request.message,
            deps=deps,
            context=request.context,
        )
        
        return ChatResponse(
            content=response.content,
            agent_type=request.agent_type,
            thinking=response.thinking,
            tools_used=response.tools_used,
            suggestions=response.suggestions,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/chat/stream")
async def chat_stream(request: ChatRequest):
    """流式聊天接口
    
    与Agent进行流式对话
    """
    try:
        agent = get_agent(request.agent_type)
        
        # 构建依赖
        deps = AgentDeps(
            settings=settings,
            user_id="api_user",
            context=request.context or {},
        )
        
        async def generate():
            async for text in agent.run_stream(
                message=request.message,
                deps=deps,
                context=request.context,
            ):
                yield f"data: {text}\n\n"
            yield "data: [DONE]\n\n"
        
        return StreamingResponse(
            generate(),
            media_type="text/event-stream",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
    """列出可用的Agent"""
    return {
        "agents": [
            {"type": "general", "name": "通用运维Agent", "description": "处理各种运维问题"},
            {"type": "alert", "name": "告警处理Agent", "description": "专注于告警分析和处理"},
            {"type": "diagnosis", "name": "故障诊断Agent", "description": "专注于故障诊断和分析"},
            {"type": "inspection", "name": "巡检Agent", "description": "专注于系统巡检和检查"},
        ]
    }


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
        return {"success": True, "config": manager.get_config().model_dump()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/llm/config")
async def get_llm_config():
    """Get current LLM configuration"""
    manager = get_llm_config_manager()
    config_data = manager.get_config().model_dump()
    if "api_key" in config_data:
        config_data["api_key"] = "***REDACTED***"
    return {"config": config_data}


@app.get("/api/health")
async def health_check_v2():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "version": "0.1.0",
        "agents_registered": len(get_agent_registry().list_agents()),
    }


# 启动事件
@app.on_event("startup")
async def startup_event():
    """应用启动时执行"""
    # 初始化知识库
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
