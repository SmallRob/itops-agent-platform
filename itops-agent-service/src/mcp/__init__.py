"""MCP模块 - Model Context Protocol服务端"""

from __future__ import annotations

import asyncio
import json
from typing import Any, Optional

from mcp import types
from mcp.server import Server
from mcp.server.stdio import stdio_server

from ..agents import create_agent
from ..config import settings
from ..deps import AgentDeps
from ..knowledge import get_knowledge_base


# 创建MCP服务器
server = Server("itops-agent")


@server.list_tools()
async def list_tools() -> list[types.Tool]:
    """列出可用工具"""
    return [
        types.Tool(
            name="chat",
            description="与IT运维Agent对话",
            inputSchema={
                "type": "object",
                "properties": {
                    "message": {
                        "type": "string",
                        "description": "用户消息",
                    },
                    "agent_type": {
                        "type": "string",
                        "enum": ["general", "alert", "diagnosis", "inspection"],
                        "description": "Agent类型",
                        "default": "general",
                    },
                },
                "required": ["message"],
            },
        ),
        types.Tool(
            name="search_knowledge",
            description="搜索运维知识库",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "搜索查询",
                    },
                    "category": {
                        "type": "string",
                        "description": "知识类别（可选）",
                    },
                    "limit": {
                        "type": "integer",
                        "description": "返回数量限制",
                        "default": 5,
                    },
                },
                "required": ["query"],
            },
        ),
        types.Tool(
            name="list_agents",
            description="列出可用的Agent类型",
            inputSchema={
                "type": "object",
                "properties": {},
            },
        ),
        types.Tool(
            name="list_knowledge_categories",
            description="列出知识库类别",
            inputSchema={
                "type": "object",
                "properties": {},
            },
        ),
    ]


@server.call_tool()
async def call_tool(name: str, arguments: dict[str, Any]) -> list[types.TextContent]:
    """调用工具"""
    try:
        if name == "chat":
            return await handle_chat(arguments)
        elif name == "search_knowledge":
            return await handle_search_knowledge(arguments)
        elif name == "list_agents":
            return await handle_list_agents(arguments)
        elif name == "list_knowledge_categories":
            return await handle_list_knowledge_categories(arguments)
        else:
            return [types.TextContent(
                type="text",
                text=json.dumps({"error": f"Unknown tool: {name}"}),
            )]
    except Exception as e:
        return [types.TextContent(
            type="text",
            text=json.dumps({"error": str(e)}),
        )]


async def handle_chat(arguments: dict[str, Any]) -> list[types.TextContent]:
    """处理聊天请求"""
    message = arguments.get("message", "")
    agent_type = arguments.get("agent_type", "general")
    
    agent = create_agent(agent_type)
    deps = AgentDeps(settings=settings)
    
    response = await agent.run(message, deps=deps)
    
    return [types.TextContent(
        type="text",
        text=json.dumps({
            "content": response.content,
            "agent_type": agent_type,
            "thinking": response.thinking,
            "tools_used": response.tools_used,
            "suggestions": response.suggestions,
        }, ensure_ascii=False),
    )]


async def handle_search_knowledge(arguments: dict[str, Any]) -> list[types.TextContent]:
    """处理知识库搜索请求"""
    query = arguments.get("query", "")
    category = arguments.get("category")
    limit = arguments.get("limit", 5)
    
    kb = await get_knowledge_base()
    results = await kb.search(query, category, limit)
    
    return [types.TextContent(
        type="text",
        text=json.dumps({
            "results": [
                {
                    "title": r.article.title,
                    "category": r.article.category,
                    "summary": r.article.summary,
                    "content": r.article.content,
                    "score": r.score,
                }
                for r in results
            ],
            "total": len(results),
        }, ensure_ascii=False),
    )]


async def handle_list_agents(arguments: dict[str, Any]) -> list[types.TextContent]:
    """处理列出Agent请求"""
    return [types.TextContent(
        type="text",
        text=json.dumps({
            "agents": [
                {"type": "general", "name": "通用运维Agent", "description": "处理各种运维问题"},
                {"type": "alert", "name": "告警处理Agent", "description": "专注于告警分析和处理"},
                {"type": "diagnosis", "name": "故障诊断Agent", "description": "专注于故障诊断和分析"},
                {"type": "inspection", "name": "巡检Agent", "description": "专注于系统巡检和检查"},
            ]
        }, ensure_ascii=False),
    )]


async def handle_list_knowledge_categories(arguments: dict[str, Any]) -> list[types.TextContent]:
    """处理列出知识库类别请求"""
    kb = await get_knowledge_base()
    categories = await kb.list_categories()
    
    return [types.TextContent(
        type="text",
        text=json.dumps({
            "categories": [
                {
                    "id": c.id,
                    "name": c.name,
                    "description": c.description,
                }
                for c in categories
            ]
        }, ensure_ascii=False),
    )]


async def run_mcp_server():
    """运行MCP服务器"""
    # 初始化知识库
    await get_knowledge_base()
    
    # 运行服务器
    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            server.create_initialization_options(),
        )


def main():
    """MCP服务入口"""
    asyncio.run(run_mcp_server())


if __name__ == "__main__":
    main()
