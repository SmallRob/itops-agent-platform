"""测试新运维工具"""

import pytest
from src.tools import (
    SystemInfoTool,
    ProcessTool,
    NetworkTool,
    LogAnalysisTool,
    ServiceTool,
    DiskTool,
    get_tool,
    TOOL_REGISTRY,
)


class TestSystemInfoTool:
    """测试系统信息工具"""
    
    def test_tool_name(self):
        tool = SystemInfoTool()
        assert tool.name == "get_system_info"
    
    def test_tool_description(self):
        tool = SystemInfoTool()
        assert "系统信息" in tool.description
    
    @pytest.mark.asyncio
    async def test_get_all_info(self):
        tool = SystemInfoTool()
        result = await tool.execute(info_type="all")
        assert result.success is True
        assert len(result.output) > 0
    
    @pytest.mark.asyncio
    async def test_get_cpu_info(self):
        tool = SystemInfoTool()
        result = await tool.execute(info_type="cpu")
        assert result.success is True
    
    @pytest.mark.asyncio
    async def test_get_memory_info(self):
        tool = SystemInfoTool()
        result = await tool.execute(info_type="memory")
        assert result.success is True
    
    @pytest.mark.asyncio
    async def test_get_disk_info(self):
        tool = SystemInfoTool()
        result = await tool.execute(info_type="disk")
        assert result.success is True


class TestProcessTool:
    """测试进程管理工具"""
    
    def test_tool_name(self):
        tool = ProcessTool()
        assert tool.name == "manage_processes"
    
    @pytest.mark.asyncio
    async def test_list_processes(self):
        tool = ProcessTool()
        result = await tool.execute(action="list", top_n=5)
        assert result.success is True
        assert len(result.output) > 0
    
    @pytest.mark.asyncio
    async def test_top_processes(self):
        tool = ProcessTool()
        result = await tool.execute(action="top", top_n=5)
        assert result.success is True


class TestNetworkTool:
    """测试网络诊断工具"""
    
    def test_tool_name(self):
        tool = NetworkTool()
        assert tool.name == "network_diagnostics"
    
    @pytest.mark.asyncio
    async def test_ping_localhost(self):
        tool = NetworkTool()
        result = await tool.execute(action="ping", target="127.0.0.1")
        assert result.success is True
        assert "PING" in result.output or "bytes from" in result.output
    
    @pytest.mark.asyncio
    async def test_dns_lookup(self):
        tool = NetworkTool()
        result = await tool.execute(action="dns", target="localhost")
        assert result.success is True


class TestLogAnalysisTool:
    """测试日志分析工具"""
    
    def test_tool_name(self):
        tool = LogAnalysisTool()
        assert tool.name == "analyze_logs"
    
    @pytest.mark.asyncio
    async def test_read_syslog(self):
        tool = LogAnalysisTool()
        result = await tool.execute(log_file="/var/log/syslog", lines=10)
        # 可能需要root权限，所以检查成功或权限错误
        assert result.success is True or "Permission denied" in str(result.error)


class TestServiceTool:
    """测试服务管理工具"""
    
    def test_tool_name(self):
        tool = ServiceTool()
        assert tool.name == "manage_services"
    
    @pytest.mark.asyncio
    async def test_service_status(self):
        tool = ServiceTool()
        result = await tool.execute(action="status", service_name="ssh")
        # 服务可能存在或不存在
        assert result.success is True or "not found" in str(result.error).lower()


class TestDiskTool:
    """测试磁盘管理工具"""
    
    def test_tool_name(self):
        tool = DiskTool()
        assert tool.name == "disk_management"
    
    @pytest.mark.asyncio
    async def test_disk_usage(self):
        tool = DiskTool()
        result = await tool.execute(action="usage", path="/")
        assert result.success is True
        assert "Filesystem" in result.output or "/" in result.output
    
    @pytest.mark.asyncio
    async def test_disk_cleanup(self):
        tool = DiskTool()
        result = await tool.execute(action="cleanup", path="/tmp", top_n=5)
        assert result.success is True


class TestToolRegistry:
    """测试工具注册表"""
    
    def test_all_tools_registered(self):
        expected_tools = [
            "execute_command",
            "ssh_command",
            "search_knowledge",
            "query_alerts",
            "get_system_info",
            "manage_processes",
            "network_diagnostics",
            "analyze_logs",
            "manage_services",
            "disk_management",
        ]
        for tool_name in expected_tools:
            assert tool_name in TOOL_REGISTRY, f"工具 {tool_name} 未注册"
    
    def test_get_tool(self):
        tool = get_tool("get_system_info")
        assert tool is not None
        assert tool.name == "get_system_info"
    
    def test_get_unknown_tool(self):
        tool = get_tool("unknown_tool")
        assert tool is None
