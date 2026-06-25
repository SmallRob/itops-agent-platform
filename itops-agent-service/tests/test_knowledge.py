"""测试知识库模块"""

import pytest
from pathlib import Path

from src.knowledge import FileKnowledgeBase, KnowledgeArticle, SearchResult


@pytest.fixture
def knowledge_path(tmp_path):
    """创建临时知识库路径"""
    return tmp_path / "knowledge"


@pytest.fixture
def knowledge_base(knowledge_path):
    """创建知识库实例"""
    return FileKnowledgeBase(knowledge_path)


@pytest.mark.asyncio
async def test_initialize_knowledge_base(knowledge_base):
    """测试初始化知识库"""
    await knowledge_base.initialize()
    
    # 应该有默认文章
    assert len(knowledge_base.articles) > 0
    assert len(knowledge_base.categories) > 0


@pytest.mark.asyncio
async def test_search_knowledge(knowledge_base):
    """测试搜索知识库"""
    await knowledge_base.initialize()
    
    # 搜索CPU相关知识
    results = await knowledge_base.search("CPU使用率过高")
    
    assert len(results) > 0
    assert any("CPU" in r.article.title for r in results)


@pytest.mark.asyncio
async def test_search_by_category(knowledge_base):
    """测试按类别搜索"""
    await knowledge_base.initialize()
    
    # 搜索故障排查类别
    results = await knowledge_base.search("排查", category="troubleshooting")
    
    assert len(results) > 0
    assert all(r.article.category == "troubleshooting" for r in results)


@pytest.mark.asyncio
async def test_get_article(knowledge_base):
    """测试获取文章"""
    await knowledge_base.initialize()
    
    # 获取CPU相关文章
    article = await knowledge_base.get_article("cpu_high")
    
    assert article is not None
    assert "CPU" in article.title


@pytest.mark.asyncio
async def test_list_categories(knowledge_base):
    """测试列出类别"""
    await knowledge_base.initialize()
    
    categories = await knowledge_base.list_categories()
    
    assert len(categories) > 0
    assert any(c.id == "troubleshooting" for c in categories)


def test_knowledge_article_model():
    """测试知识文章模型"""
    article = KnowledgeArticle(
        id="test",
        title="测试文章",
        category="test",
        tags=["test", "example"],
        content="测试内容",
        summary="测试摘要",
    )
    
    assert article.id == "test"
    assert article.title == "测试文章"
    assert len(article.tags) == 2


def test_search_result_model():
    """测试搜索结果模型"""
    article = KnowledgeArticle(
        id="test",
        title="测试文章",
        category="test",
        content="测试内容",
    )
    
    result = SearchResult(
        article=article,
        score=0.95,
        highlights=["匹配1", "匹配2"],
    )
    
    assert result.score == 0.95
    assert len(result.highlights) == 2
