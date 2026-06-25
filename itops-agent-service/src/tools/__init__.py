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


class SystemInfoTool(BaseTool):
    """系统信息工具"""
    
    @property
    def name(self) -> str:
        return "get_system_info"
    
    @property
    def description(self) -> str:
        return "获取系统信息（CPU、内存、磁盘、网络）"
    
    async def execute(
        self,
        info_type: str = "all",
    ) -> ToolResult:
        """获取系统信息
        
        Args:
            info_type: 信息类型（cpu/memory/disk/network/all）
            
        Returns:
            ToolResult: 系统信息
        """
        commands = {
            "cpu": "top -bn1 | head -20",
            "memory": "free -h",
            "disk": "df -h",
            "network": "ip addr show",
            "all": "uname -a && uptime && free -h && df -h",
        }
        
        command = commands.get(info_type, commands["all"])
        
        try:
            proc = await asyncio.create_subprocess_shell(
                command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=10)
            
            return ToolResult(
                success=proc.returncode == 0,
                output=stdout.decode("utf-8", errors="replace"),
                error=stderr.decode("utf-8", errors="replace") if proc.returncode != 0 else None,
                metadata={"info_type": info_type},
            )
        except Exception as e:
            return ToolResult(
                success=False,
                output="",
                error=str(e),
            )


class ProcessTool(BaseTool):
    """进程管理工具"""
    
    @property
    def name(self) -> str:
        return "manage_processes"
    
    @property
    def description(self) -> str:
        return "查看和管理系统进程"
    
    async def execute(
        self,
        action: str = "list",
        process_name: Optional[str] = None,
        top_n: int = 10,
    ) -> ToolResult:
        """管理进程
        
        Args:
            action: 操作类型（list/top/kill）
            process_name: 进程名称
            top_n: 显示前N个进程
            
        Returns:
            ToolResult: 执行结果
        """
        if action == "list":
            command = f"ps aux --sort=-%mem | head -{top_n + 1}"
        elif action == "top":
            command = f"ps aux --sort=-%cpu | head -{top_n + 1}"
        elif action == "kill" and process_name:
            command = f"pkill -f {process_name}"
        else:
            return ToolResult(
                success=False,
                output="",
                error=f"无效的操作: {action}",
            )
        
        try:
            proc = await asyncio.create_subprocess_shell(
                command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=10)
            
            return ToolResult(
                success=proc.returncode == 0,
                output=stdout.decode("utf-8", errors="replace"),
                error=stderr.decode("utf-8", errors="replace") if proc.returncode != 0 else None,
                metadata={"action": action},
            )
        except Exception as e:
            return ToolResult(
                success=False,
                output="",
                error=str(e),
            )


class NetworkTool(BaseTool):
    """网络诊断工具"""
    
    @property
    def name(self) -> str:
        return "network_diagnostics"
    
    @property
    def description(self) -> str:
        return "网络诊断和检查"
    
    async def execute(
        self,
        action: str = "ping",
        target: str = "8.8.8.8",
        port: Optional[int] = None,
    ) -> ToolResult:
        """网络诊断
        
        Args:
            action: 操作类型（ping/port_check/dns/traceroute）
            target: 目标地址
            port: 端口号
            
        Returns:
            ToolResult: 诊断结果
        """
        if action == "ping":
            command = f"ping -c 4 {target}"
        elif action == "port_check" and port:
            command = f"nc -zv {target} {port} 2>&1"
        elif action == "dns":
            command = f"nslookup {target}"
        elif action == "traceroute":
            command = f"traceroute -m 15 {target}"
        else:
            return ToolResult(
                success=False,
                output="",
                error=f"无效的操作: {action}",
            )
        
        try:
            proc = await asyncio.create_subprocess_shell(
                command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=30)
            
            return ToolResult(
                success=proc.returncode == 0,
                output=stdout.decode("utf-8", errors="replace"),
                error=stderr.decode("utf-8", errors="replace") if proc.returncode != 0 else None,
                metadata={"action": action, "target": target},
            )
        except Exception as e:
            return ToolResult(
                success=False,
                output="",
                error=str(e),
            )


class LogAnalysisTool(BaseTool):
    """日志分析工具"""
    
    @property
    def name(self) -> str:
        return "analyze_logs"
    
    @property
    def description(self) -> str:
        return "分析系统日志"
    
    async def execute(
        self,
        log_file: str = "/var/log/syslog",
        lines: int = 100,
        keyword: Optional[str] = None,
        level: Optional[str] = None,
    ) -> ToolResult:
        """分析日志
        
        Args:
            log_file: 日志文件路径
            lines: 显示行数
            keyword: 关键词过滤
            level: 日志级别（error/warning/info）
            
        Returns:
            ToolResult: 日志分析结果
        """
        if keyword:
            command = f"tail -n {lines} {log_file} | grep -i '{keyword}'"
        elif level:
            command = f"tail -n {lines} {log_file} | grep -i '{level}'"
        else:
            command = f"tail -n {lines} {log_file}"
        
        try:
            proc = await asyncio.create_subprocess_shell(
                command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=10)
            
            return ToolResult(
                success=proc.returncode == 0,
                output=stdout.decode("utf-8", errors="replace"),
                error=stderr.decode("utf-8", errors="replace") if proc.returncode != 0 else None,
                metadata={"log_file": log_file, "lines": lines},
            )
        except Exception as e:
            return ToolResult(
                success=False,
                output="",
                error=str(e),
            )


class ServiceTool(BaseTool):
    """服务管理工具"""
    
    @property
    def name(self) -> str:
        return "manage_services"
    
    @property
    def description(self) -> str:
        return "管理系统服务"
    
    async def execute(
        self,
        action: str = "status",
        service_name: str = "",
    ) -> ToolResult:
        """管理服务
        
        Args:
            action: 操作类型（status/start/stop/restart/reload）
            service_name: 服务名称
            
        Returns:
            ToolResult: 执行结果
        """
        if not service_name:
            return ToolResult(
                success=False,
                output="",
                error="请指定服务名称",
            )
        
        if action == "status":
            command = f"systemctl status {service_name}"
        elif action == "start":
            command = f"sudo systemctl start {service_name}"
        elif action == "stop":
            command = f"sudo systemctl stop {service_name}"
        elif action == "restart":
            command = f"sudo systemctl restart {service_name}"
        elif action == "reload":
            command = f"sudo systemctl reload {service_name}"
        else:
            return ToolResult(
                success=False,
                output="",
                error=f"无效的操作: {action}",
            )
        
        try:
            proc = await asyncio.create_subprocess_shell(
                command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=30)
            
            return ToolResult(
                success=proc.returncode == 0,
                output=stdout.decode("utf-8", errors="replace"),
                error=stderr.decode("utf-8", errors="replace") if proc.returncode != 0 else None,
                metadata={"action": action, "service": service_name},
            )
        except Exception as e:
            return ToolResult(
                success=False,
                output="",
                error=str(e),
            )


class DiskTool(BaseTool):
    """磁盘管理工具"""
    
    @property
    def name(self) -> str:
        return "disk_management"
    
    @property
    def description(self) -> str:
        return "磁盘空间分析和管理"
    
    async def execute(
        self,
        action: str = "usage",
        path: str = "/",
        top_n: int = 10,
    ) -> ToolResult:
        """磁盘管理
        
        Args:
            action: 操作类型（usage/cleanup/inodes）
            path: 路径
            top_n: 显示前N个大文件
            
        Returns:
            ToolResult: 执行结果
        """
        if action == "usage":
            command = f"df -h {path}"
        elif action == "cleanup":
            command = f"du -sh {path}/* 2>/dev/null | sort -rh | head -{top_n}"
        elif action == "inodes":
            command = f"df -i {path}"
        else:
            return ToolResult(
                success=False,
                output="",
                error=f"无效的操作: {action}",
            )
        
        try:
            proc = await asyncio.create_subprocess_shell(
                command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=10)
            
            return ToolResult(
                success=proc.returncode == 0,
                output=stdout.decode("utf-8", errors="replace"),
                error=stderr.decode("utf-8", errors="replace") if proc.returncode != 0 else None,
                metadata={"action": action, "path": path},
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
    "get_system_info": SystemInfoTool,
    "manage_processes": ProcessTool,
    "network_diagnostics": NetworkTool,
    "analyze_logs": LogAnalysisTool,
    "manage_services": ServiceTool,
    "disk_management": DiskTool,
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
