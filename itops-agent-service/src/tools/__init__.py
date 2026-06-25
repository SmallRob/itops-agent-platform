"""工具模块 - Agent可用的工具"""

from __future__ import annotations

import asyncio
import subprocess
from abc import ABC, abstractmethod
from typing import Any, Optional

from pydantic import BaseModel, Field


class ToolResult(BaseModel):
    """工具执行结果"""
    success: bool = Field(description="是否成功")
    output: str = Field(description="输出内容")
    error: Optional[str] = Field(default=None, description="错误信息")
    metadata: dict[str, Any] = Field(default_factory=dict, description="元数据")


class BaseTool(ABC):
    """工具基类"""
    
    @property
    @abstractmethod
    def name(self) -> str:
        """工具名称"""
        ...
    
    @property
    @abstractmethod
    def description(self) -> str:
        """工具描述"""
        ...
    
    @abstractmethod
    async def execute(self, **kwargs) -> ToolResult:
        """执行工具"""
        ...


class CommandTool(BaseTool):
    """命令执行工具"""
    
    @property
    def name(self) -> str:
        return "execute_command"
    
    @property
    def description(self) -> str:
        return "在本地或远程服务器上执行命令"
    
    async def execute(
        self,
        command: str,
        timeout: int = 30,
        shell: bool = True,
    ) -> ToolResult:
        """执行命令
        
        Args:
            command: 要执行的命令
            timeout: 超时时间（秒）
            shell: 是否使用shell
            
        Returns:
            ToolResult: 执行结果
        """
        try:
            proc = await asyncio.create_subprocess_shell(
                command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            
            try:
                stdout, stderr = await asyncio.wait_for(
                    proc.communicate(),
                    timeout=timeout,
                )
            except asyncio.TimeoutError:
                proc.kill()
                return ToolResult(
                    success=False,
                    output="",
                    error=f"命令执行超时（{timeout}秒）",
                )
            
            return ToolResult(
                success=proc.returncode == 0,
                output=stdout.decode("utf-8", errors="replace"),
                error=stderr.decode("utf-8", errors="replace") if proc.returncode != 0 else None,
                metadata={"return_code": proc.returncode},
            )
        except Exception as e:
            return ToolResult(
                success=False,
                output="",
                error=str(e),
            )


class SSHCommandTool(BaseTool):
    """SSH命令执行工具"""
    
    def __init__(self, ssh_manager: Any = None):
        self._ssh_manager = ssh_manager
    
    @property
    def name(self) -> str:
        return "ssh_command"
    
    @property
    def description(self) -> str:
        return "在远程服务器上通过SSH执行命令"
    
    async def execute(
        self,
        server_id: str,
        command: str,
        timeout: int = 30,
    ) -> ToolResult:
        """通过SSH执行命令
        
        Args:
            server_id: 服务器ID
            command: 要执行的命令
            timeout: 超时时间（秒）
            
        Returns:
            ToolResult: 执行结果
        """
        if not self._ssh_manager:
            return ToolResult(
                success=False,
                output="",
                error="SSH管理器未初始化",
            )
        
        try:
            result = await self._ssh_manager.execute(
                server_id=server_id,
                command=command,
                timeout=timeout,
            )
            return ToolResult(
                success=result.get("success", False),
                output=result.get("stdout", ""),
                error=result.get("stderr"),
                metadata={"server_id": server_id},
            )
        except Exception as e:
            return ToolResult(
                success=False,
                output="",
                error=str(e),
                metadata={"server_id": server_id},
            )


class KnowledgeSearchTool(BaseTool):
    """知识库搜索工具"""
    
    def __init__(self, knowledge_base: Any = None):
        self._knowledge_base = knowledge_base
    
    @property
    def name(self) -> str:
        return "search_knowledge"
    
    @property
    def description(self) -> str:
        return "搜索运维知识库"
    
    async def execute(
        self,
        query: str,
        category: Optional[str] = None,
        limit: int = 5,
    ) -> ToolResult:
        """搜索知识库
        
        Args:
            query: 搜索查询
            category: 知识类别
            limit: 返回数量限制
            
        Returns:
            ToolResult: 搜索结果
        """
        if not self._knowledge_base:
            return ToolResult(
                success=False,
                output="",
                error="知识库未初始化",
            )
        
        try:
            results = await self._knowledge_base.search(
                query=query,
                category=category,
                limit=limit,
            )
            return ToolResult(
                success=True,
                output=str(results),
                metadata={"result_count": len(results)},
            )
        except Exception as e:
            return ToolResult(
                success=False,
                output="",
                error=str(e),
            )


class AlertQueryTool(BaseTool):
    """告警查询工具"""
    
    def __init__(self, alert_manager: Any = None):
        self._alert_manager = alert_manager
    
    @property
    def name(self) -> str:
        return "query_alerts"
    
    @property
    def description(self) -> str:
        return "查询系统告警"
    
    async def execute(
        self,
        status: Optional[str] = None,
        severity: Optional[str] = None,
        limit: int = 10,
    ) -> ToolResult:
        """查询告警
        
        Args:
            status: 告警状态过滤
            severity: 告警级别过滤
            limit: 返回数量限制
            
        Returns:
            ToolResult: 查询结果
        """
        if not self._alert_manager:
            return ToolResult(
                success=False,
                output="",
                error="告警管理器未初始化",
            )
        
        try:
            alerts = await self._alert_manager.list(
                status=status,
                severity=severity,
                limit=limit,
            )
            return ToolResult(
                success=True,
                output=str(alerts),
                metadata={"alert_count": len(alerts)},
            )
        except Exception as e:
            return ToolResult(
                success=False,
                output="",
                error=str(e),
            )


# 工具注册表
TOOL_REGISTRY: dict[str, type[BaseTool]] = {
    "execute_command": CommandTool,
    "ssh_command": SSHCommandTool,
    "search_knowledge": KnowledgeSearchTool,
    "query_alerts": AlertQueryTool,
}


def get_tool(name: str, **kwargs) -> Optional[BaseTool]:
    """获取工具实例
    
    Args:
        name: 工具名称
        **kwargs: 工具参数
        
    Returns:
        Optional[BaseTool]: 工具实例
    """
    tool_class = TOOL_REGISTRY.get(name)
    if tool_class:
        return tool_class(**kwargs)
    return None
