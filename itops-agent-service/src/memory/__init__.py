"""记忆模块 - Agent记忆管理"""

from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class MemoryEntry(BaseModel):
    """记忆条目"""
    id: str = Field(description="记忆ID")
    content: str = Field(description="记忆内容")
    role: str = Field(description="角色（user/assistant/system）")
    timestamp: datetime = Field(default_factory=datetime.now, description="时间戳")
    metadata: dict[str, Any] = Field(default_factory=dict, description="元数据")


class ConversationMemory(BaseModel):
    """对话记忆"""
    conversation_id: str = Field(description="对话ID")
    user_id: str = Field(description="用户ID")
    messages: list[MemoryEntry] = Field(default_factory=list, description="消息历史")
    created_at: datetime = Field(default_factory=datetime.now, description="创建时间")
    updated_at: datetime = Field(default_factory=datetime.now, description="更新时间")
    metadata: dict[str, Any] = Field(default_factory=dict, description="元数据")


class BaseMemory(ABC):
    """记忆基类"""
    
    @abstractmethod
    async def add_message(
        self,
        conversation_id: str,
        role: str,
        content: str,
        metadata: Optional[dict[str, Any]] = None,
    ) -> MemoryEntry:
        """添加消息"""
        ...
    
    @abstractmethod
    async def get_history(
        self,
        conversation_id: str,
        limit: Optional[int] = None,
    ) -> list[MemoryEntry]:
        """获取历史消息"""
        ...
    
    @abstractmethod
    async def search(
        self,
        query: str,
        conversation_id: Optional[str] = None,
        limit: int = 5,
    ) -> list[MemoryEntry]:
        """搜索记忆"""
        ...
    
    @abstractmethod
    async def clear(self, conversation_id: str) -> None:
        """清除对话记忆"""
        ...


class InMemoryStore(BaseMemory):
    """内存存储实现"""
    
    def __init__(self):
        self.conversations: dict[str, ConversationMemory] = {}
    
    async def add_message(
        self,
        conversation_id: str,
        role: str,
        content: str,
        metadata: Optional[dict[str, Any]] = None,
    ) -> MemoryEntry:
        """添加消息"""
        if conversation_id not in self.conversations:
            self.conversations[conversation_id] = ConversationMemory(
                conversation_id=conversation_id,
                user_id=metadata.get("user_id", "system") if metadata else "system",
            )
        
        entry = MemoryEntry(
            id=f"{conversation_id}_{len(self.conversations[conversation_id].messages)}",
            content=content,
            role=role,
            metadata=metadata or {},
        )
        
        self.conversations[conversation_id].messages.append(entry)
        self.conversations[conversation_id].updated_at = datetime.now()
        
        return entry
    
    async def get_history(
        self,
        conversation_id: str,
        limit: Optional[int] = None,
    ) -> list[MemoryEntry]:
        """获取历史消息"""
        if conversation_id not in self.conversations:
            return []
        
        messages = self.conversations[conversation_id].messages
        
        if limit:
            return messages[-limit:]
        return messages
    
    async def search(
        self,
        query: str,
        conversation_id: Optional[str] = None,
        limit: int = 5,
    ) -> list[MemoryEntry]:
        """搜索记忆
        
        使用简单的关键词匹配
        """
        results: list[MemoryEntry] = []
        query_lower = query.lower()
        
        conversations = (
            {conversation_id: self.conversations[conversation_id]}
            if conversation_id and conversation_id in self.conversations
            else self.conversations
        )
        
        for conv in conversations.values():
            for entry in conv.messages:
                if query_lower in entry.content.lower():
                    results.append(entry)
        
        return results[:limit]
    
    async def clear(self, conversation_id: str) -> None:
        """清除对话记忆"""
        if conversation_id in self.conversations:
            del self.conversations[conversation_id]


class SummaryMemory(BaseMemory):
    """带摘要的记忆实现"""
    
    def __init__(self, max_messages: int = 100):
        self.store = InMemoryStore()
        self.max_messages = max_messages
        self.summaries: dict[str, str] = {}
    
    async def add_message(
        self,
        conversation_id: str,
        role: str,
        content: str,
        metadata: Optional[dict[str, Any]] = None,
    ) -> MemoryEntry:
        """添加消息"""
        entry = await self.store.add_message(conversation_id, role, content, metadata)
        
        # 检查是否需要压缩
        history = await self.store.get_history(conversation_id)
        if len(history) > self.max_messages:
            await self._compress(conversation_id)
        
        return entry
    
    async def get_history(
        self,
        conversation_id: str,
        limit: Optional[int] = None,
    ) -> list[MemoryEntry]:
        """获取历史消息"""
        return await self.store.get_history(conversation_id, limit)
    
    async def search(
        self,
        query: str,
        conversation_id: Optional[str] = None,
        limit: int = 5,
    ) -> list[MemoryEntry]:
        """搜索记忆"""
        return await self.store.search(query, conversation_id, limit)
    
    async def clear(self, conversation_id: str) -> None:
        """清除对话记忆"""
        await self.store.clear(conversation_id)
        if conversation_id in self.summaries:
            del self.summaries[conversation_id]
    
    async def _compress(self, conversation_id: str) -> None:
        """压缩历史消息"""
        history = await self.store.get_history(conversation_id)
        
        # 保留最近的消息
        keep_count = self.max_messages // 2
        recent_messages = history[-keep_count:]
        
        # 生成摘要（这里简化处理，实际应该调用LLM）
        old_messages = history[:-keep_count]
        summary = self._generate_summary(old_messages)
        
        # 更新摘要
        self.summaries[conversation_id] = summary
        
        # 清除旧消息并添加摘要
        await self.store.clear(conversation_id)
        
        # 添加摘要作为系统消息
        await self.store.add_message(
            conversation_id,
            "system",
            f"对话摘要：{summary}",
        )
        
        # 添加最近的消息
        for msg in recent_messages:
            await self.store.add_message(
                conversation_id,
                msg.role,
                msg.content,
                msg.metadata,
            )
    
    def _generate_summary(self, messages: list[MemoryEntry]) -> str:
        """生成摘要（简化版本）"""
        # 简单提取关键信息
        topics = set()
        for msg in messages:
            if msg.role == "user":
                # 提取前50个字符作为主题
                topics.add(msg.content[:50])
        
        return f"对话涉及以下主题：{', '.join(list(topics)[:5])}"


# 全局记忆实例
_memory: Optional[BaseMemory] = None


def get_memory(memory_type: str = "in_memory") -> BaseMemory:
    """获取记忆实例"""
    global _memory
    
    if _memory is None:
        if memory_type == "summary":
            _memory = SummaryMemory()
        else:
            _memory = InMemoryStore()
    
    return _memory
