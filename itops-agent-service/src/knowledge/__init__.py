"""知识库模块 - 运维知识管理"""

from __future__ import annotations

import json
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any, Optional

import yaml
from pydantic import BaseModel, Field


class KnowledgeArticle(BaseModel):
    """知识文章"""
    id: str = Field(description="文章ID")
    title: str = Field(description="标题")
    category: str = Field(description="类别")
    tags: list[str] = Field(default_factory=list, description="标签")
    content: str = Field(description="内容")
    summary: Optional[str] = Field(default=None, description="摘要")
    metadata: dict[str, Any] = Field(default_factory=dict, description="元数据")


class KnowledgeCategory(BaseModel):
    """知识类别"""
    id: str = Field(description="类别ID")
    name: str = Field(description="类别名称")
    description: Optional[str] = Field(default=None, description="类别描述")
    parent_id: Optional[str] = Field(default=None, description="父类别ID")


class SearchResult(BaseModel):
    """搜索结果"""
    article: KnowledgeArticle = Field(description="文章")
    score: float = Field(description="相关度分数")
    highlights: list[str] = Field(default_factory=list, description="高亮片段")


class BaseKnowledgeBase(ABC):
    """知识库基类"""
    
    @abstractmethod
    async def initialize(self) -> None:
        """初始化知识库"""
        ...
    
    @abstractmethod
    async def search(
        self,
        query: str,
        category: Optional[str] = None,
        limit: int = 5,
    ) -> list[SearchResult]:
        """搜索知识库"""
        ...
    
    @abstractmethod
    async def get_article(self, article_id: str) -> Optional[KnowledgeArticle]:
        """获取文章"""
        ...
    
    @abstractmethod
    async def list_categories(self) -> list[KnowledgeCategory]:
        """列出类别"""
        ...


class FileKnowledgeBase(BaseKnowledgeBase):
    """基于文件的知识库"""
    
    def __init__(self, knowledge_path: Path):
        self.knowledge_path = knowledge_path
        self.articles: dict[str, KnowledgeArticle] = {}
        self.categories: dict[str, KnowledgeCategory] = {}
    
    async def initialize(self) -> None:
        """初始化知识库，加载所有知识文件"""
        self.knowledge_path.mkdir(parents=True, exist_ok=True)

        has_files = any(self.knowledge_path.iterdir())
        if not has_files:
            await self._create_default_knowledge()
        
        # 加载YAML文件
        for yaml_file in self.knowledge_path.glob("**/*.yaml"):
            await self._load_yaml_file(yaml_file)
        
        for yml_file in self.knowledge_path.glob("**/*.yml"):
            await self._load_yaml_file(yml_file)
        
        # 加载JSON文件
        for json_file in self.knowledge_path.glob("**/*.json"):
            await self._load_json_file(json_file)
        
        # 加载Markdown文件
        for md_file in self.knowledge_path.glob("**/*.md"):
            await self._load_markdown_file(md_file)
    
    async def _load_yaml_file(self, file_path: Path) -> None:
        """加载YAML文件"""
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f)
            
            if isinstance(data, dict):
                if "articles" in data:
                    for article_data in data["articles"]:
                        article = KnowledgeArticle(**article_data)
                        self.articles[article.id] = article
                
                if "categories" in data:
                    for cat_data in data["categories"]:
                        category = KnowledgeCategory(**cat_data)
                        self.categories[category.id] = category
        except Exception as e:
            print(f"Error loading {file_path}: {e}")
    
    async def _load_json_file(self, file_path: Path) -> None:
        """加载JSON文件"""
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            
            if isinstance(data, dict):
                if "articles" in data:
                    for article_data in data["articles"]:
                        article = KnowledgeArticle(**article_data)
                        self.articles[article.id] = article
                
                if "categories" in data:
                    for cat_data in data["categories"]:
                        category = KnowledgeCategory(**cat_data)
                        self.categories[category.id] = category
        except Exception as e:
            print(f"Error loading {file_path}: {e}")
    
    async def _load_markdown_file(self, file_path: Path) -> None:
        """加载Markdown文件"""
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
            
            # 解析YAML frontmatter
            if content.startswith("---"):
                parts = content.split("---", 2)
                if len(parts) >= 3:
                    frontmatter = yaml.safe_load(parts[1])
                    body = parts[2].strip()
                    
                    article = KnowledgeArticle(
                        id=file_path.stem,
                        title=frontmatter.get("title", file_path.stem),
                        category=frontmatter.get("category", "general"),
                        tags=frontmatter.get("tags", []),
                        content=body,
                        summary=frontmatter.get("summary"),
                        metadata={"source": str(file_path)},
                    )
                    self.articles[article.id] = article
        except Exception as e:
            print(f"Error loading {file_path}: {e}")
    
    async def _create_default_knowledge(self) -> None:
        """创建默认知识库"""
        default_articles = [
            {
                "id": "cpu_high",
                "title": "CPU使用率过高排查指南",
                "category": "troubleshooting",
                "tags": ["cpu", "性能", "排查"],
                "content": """# CPU使用率过高排查指南

## 常见原因
1. 进程异常占用
2. 死循环或无限递归
3. 资源争用
4. 僵尸进程

## 排查步骤
1. 使用 `top` 或 `htop` 查看CPU占用最高的进程
2. 使用 `ps aux --sort=-%cpu` 排序查看
3. 检查是否有异常进程
4. 分析进程堆栈

## 常用命令
```bash
# 查看CPU使用情况
top -bn1 | head -20

# 查看CPU占用最高的进程
ps aux --sort=-%cpu | head -10

# 查看进程树
pstree -p

# 查看特定进程的线程
ps -T -p <pid>
```

## 解决方案
1. 优化代码逻辑
2. 增加CPU资源
3. 配置资源限制
4. 重启异常进程""",
            },
            {
                "id": "memory_leak",
                "title": "内存泄漏分析与解决",
                "category": "troubleshooting",
                "tags": ["memory", "内存", "oom"],
                "content": """# 内存泄漏分析与解决

## 常见原因
1. 应用内存泄漏
2. 内存分配过多
3. 缓存未清理
4. 连接未释放

## 排查步骤
1. 使用 `free -m` 查看内存使用情况
2. 使用 `top` 或 `ps` 查看内存占用最高的进程
3. 检查应用日志中的OOM错误
4. 使用内存分析工具

## 常用命令
```bash
# 查看内存使用情况
free -m

# 查看内存占用最高的进程
ps aux --sort=-%mem | head -10

# 查看OOM Killer日志
dmesg | grep -i oom

# 查看进程内存映射
cat /proc/<pid>/smaps
```

## 解决方案
1. 修复内存泄漏代码
2. 增加物理内存
3. 配置swap空间
4. 优化内存使用""",
            },
            {
                "id": "disk_full",
                "title": "磁盘空间不足处理",
                "category": "troubleshooting",
                "tags": ["disk", "磁盘", "存储"],
                "content": """# 磁盘空间不足处理

## 常见原因
1. 日志文件过大
2. 临时文件积累
3. 数据文件增长
4. 备份文件过多

## 排查步骤
1. 使用 `df -h` 查看各分区使用情况
2. 使用 `du -sh` 定位大目录
3. 查找大文件
4. 检查日志轮转配置

## 常用命令
```bash
# 查看磁盘使用情况
df -h

# 查看当前目录大小
du -sh *

# 查找大文件
find / -type f -size +100M 2>/dev/null

# 查看日志文件大小
ls -lh /var/log/
```

## 解决方案
1. 清理过期日志
2. 配置日志轮转
3. 清理临时文件
4. 扩容磁盘空间""",
            },
            {
                "id": "service_down",
                "title": "服务宕机处理",
                "category": "troubleshooting",
                "tags": ["service", "服务", "宕机"],
                "content": """# 服务宕机处理

## 常见原因
1. 进程异常退出
2. 配置错误
3. 依赖服务故障
4. 资源不足

## 排查步骤
1. 检查服务状态
2. 查看服务日志
3. 检查配置文件
4. 检查依赖服务

## 常用命令
```bash
# 检查服务状态
systemctl status <service>

# 查看服务日志
journalctl -u <service> -n 100

# 检查服务端口
netstat -tlnp | grep <port>

# 重启服务
systemctl restart <service>
```

## 解决方案
1. 修复配置错误
2. 解决依赖问题
3. 增加资源配额
4. 配置自动重启""",
            },
            {
                "id": "network_issue",
                "title": "网络故障排查",
                "category": "troubleshooting",
                "tags": ["network", "网络", "连接"],
                "content": """# 网络故障排查

## 常见原因
1. 网卡故障
2. 路由问题
3. 防火墙规则
4. DNS解析问题

## 排查步骤
1. 检查网卡状态
2. 测试网络连通性
3. 检查路由表
4. 检查防火墙规则

## 常用命令
```bash
# 查看网卡状态
ip addr show

# 测试网络连通性
ping -c 4 <host>

# 查看路由表
ip route show

# 查看防火墙规则
iptables -L -n

# 查看DNS配置
cat /etc/resolv.conf
```

## 解决方案
1. 修复网卡配置
2. 调整路由规则
3. 修改防火墙规则
4. 配置DNS服务器""",
            },
        ]
        
        # 创建默认类别
        self.categories["troubleshooting"] = KnowledgeCategory(
            id="troubleshooting",
            name="故障排查",
            description="常见故障的排查和解决方法",
        )
        
        # 创建默认文章
        for article_data in default_articles:
            article = KnowledgeArticle(**article_data)
            self.articles[article.id] = article
        
        # 保存到文件
        await self._save_to_file()
    
    async def _save_to_file(self) -> None:
        """保存知识库到文件"""
        data = {
            "categories": [cat.model_dump() for cat in self.categories.values()],
            "articles": [article.model_dump() for article in self.articles.values()],
        }
        
        file_path = self.knowledge_path / "default.yaml"
        with open(file_path, "w", encoding="utf-8") as f:
            yaml.dump(data, f, allow_unicode=True, default_flow_style=False)
    
    async def search(
        self,
        query: str,
        category: Optional[str] = None,
        limit: int = 5,
    ) -> list[SearchResult]:
        """搜索知识库
        
        使用简单的关键词匹配，实际项目中应使用向量搜索
        """
        results: list[SearchResult] = []
        query_lower = query.lower()
        query_words = set(query_lower.split())
        
        for article in self.articles.values():
            # 类别过滤
            if category and article.category != category:
                continue
            
            # 计算相关度分数
            score = 0.0
            highlights: list[str] = []
            
            # 标题匹配
            title_lower = article.title.lower()
            for word in query_words:
                if word in title_lower:
                    score += 0.4
                    highlights.append(f"标题匹配: {word}")
            
            # 标签匹配
            for tag in article.tags:
                if tag.lower() in query_lower:
                    score += 0.3
                    highlights.append(f"标签匹配: {tag}")
            
            # 内容匹配
            content_lower = article.content.lower()
            for word in query_words:
                if word in content_lower:
                    score += 0.1
            
            # 摘要匹配
            if article.summary:
                summary_lower = article.summary.lower()
                for word in query_words:
                    if word in summary_lower:
                        score += 0.2
            
            if score > 0:
                results.append(SearchResult(
                    article=article,
                    score=min(score, 1.0),
                    highlights=highlights,
                ))
        
        # 按分数排序
        results.sort(key=lambda x: x.score, reverse=True)
        return results[:limit]
    
    async def get_article(self, article_id: str) -> Optional[KnowledgeArticle]:
        """获取文章"""
        return self.articles.get(article_id)
    
    async def list_categories(self) -> list[KnowledgeCategory]:
        """列出类别"""
        return list(self.categories.values())


# 全局知识库实例
_knowledge_base: Optional[BaseKnowledgeBase] = None


async def get_knowledge_base(knowledge_path: Optional[Path] = None) -> BaseKnowledgeBase:
    """获取知识库实例"""
    global _knowledge_base
    
    if _knowledge_base is None:
        if knowledge_path is None:
            knowledge_path = Path("knowledge")
        _knowledge_base = FileKnowledgeBase(knowledge_path)
        await _knowledge_base.initialize()
    
    return _knowledge_base
