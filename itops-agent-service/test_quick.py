#!/usr/bin/env python3
"""快速测试脚本"""

import asyncio
import sys
from pathlib import Path

# 添加项目根目录到Python路径
sys.path.insert(0, str(Path(__file__).parent))


async def test_knowledge():
    """测试知识库"""
    from src.knowledge import get_knowledge_base
    
    print("测试知识库...")
    kb = await get_knowledge_base()
    
    # 搜索测试
    results = await kb.search("CPU使用率过高")
    print(f"搜索结果: {len(results)} 条")
    
    for r in results[:3]:
        print(f"  - {r.article.title} (相关度: {r.score:.2f})")
    
    # 获取文章测试
    article = await kb.get_article("cpu_high")
    if article:
        print(f"获取文章: {article.title}")
    
    # 列出类别测试
    categories = await kb.list_categories()
    print(f"知识类别: {len(categories)} 个")
    
    print("知识库测试完成!\n")


async def test_agent():
    """测试Agent"""
    from src.agents import create_agent
    from src.config import settings
    from src.deps import AgentDeps
    
    print("测试Agent创建...")
    
    # 测试创建不同类型的Agent
    agent_types = ["general", "alert", "diagnosis", "inspection"]
    
    for agent_type in agent_types:
        agent = create_agent(agent_type)
        print(f"  - {agent_type}: {agent.name}")
    
    print("Agent创建测试完成!\n")


def test_config():
    """测试配置"""
    from src.config import settings
    
    print("测试配置...")
    print(f"  - 应用名称: {settings.app_name}")
    print(f"  - 版本: {settings.app_version}")
    print(f"  - LLM提供商: {settings.llm_provider}")
    print(f"  - LLM模型: {settings.llm_model}")
    print("配置测试完成!\n")


async def main():
    """主测试函数"""
    print("=" * 50)
    print("ITOps Agent Service 快速测试")
    print("=" * 50)
    print()
    
    # 测试配置
    test_config()
    
    # 测试知识库
    await test_knowledge()
    
    # 测试Agent
    await test_agent()
    
    print("=" * 50)
    print("所有测试完成!")
    print("=" * 50)


if __name__ == "__main__":
    asyncio.run(main())
