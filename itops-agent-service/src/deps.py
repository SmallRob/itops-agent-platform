"""依赖注入模块 - Agent运行时依赖"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from .config import Settings


@dataclass
class AgentDeps:
    """Agent运行时依赖"""
    settings: Settings
    db_session: Optional[AsyncSession] = None
    user_id: str = "system"
    context: dict[str, Any] = field(default_factory=dict)
    
    # 服务引用
    knowledge_base: Any = None
    vector_store: Any = None
    ssh_manager: Any = None
    alert_manager: Any = None


@dataclass
class ITOpsContext:
    """运维上下文信息"""
    servers: list[dict[str, Any]] = field(default_factory=list)
    alerts: list[dict[str, Any]] = field(default_factory=list)
    recent_tasks: list[dict[str, Any]] = field(default_factory=list)
    system_status: dict[str, Any] = field(default_factory=dict)
