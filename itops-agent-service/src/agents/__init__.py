"""Agent模块 - 智能运维Agent实现"""

from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field
from pydantic_ai import Agent, RunContext

from ..deps import AgentDeps
from ..config import settings


# 系统提示词
ITOPS_SYSTEM_PROMPT = """你是一个专业的IT运维助手（ITOps Agent），帮助运维人员监控系统、处理告警、执行任务。

你的能力范围：
1. **告警管理**：分析告警、提供处理建议、触发修复工作流
2. **服务器管理**：服务器状态查询、健康检查、命令执行
3. **故障诊断**：分析日志、定位问题根因、提供解决方案
4. **系统巡检**：执行合规检查、生成巡检报告
5. **知识库检索**：查询运维知识、最佳实践、故障处理手册

回答要求：
- 使用中文回答
- 回答要简洁明了，重点突出
- 使用Markdown格式组织内容
- 提供可执行的操作建议
- 注意安全，避免执行危险命令"""


class AgentResponse(BaseModel):
    """Agent响应"""
    content: str = Field(description="响应内容")
    thinking: Optional[str] = Field(default=None, description="思考过程")
    tools_used: list[str] = Field(default_factory=list, description="使用的工具")
    confidence: float = Field(default=1.0, description="置信度")
    suggestions: list[str] = Field(default_factory=list, description="后续建议")


class ITOpsAgent:
    """IT运维Agent基类"""
    
    def __init__(
        self,
        name: str = "itops-agent",
        system_prompt: str = ITOPS_SYSTEM_PROMPT,
        model: Optional[str] = None,
        tools: Optional[list[str]] = None,
        metadata: Optional[dict[str, Any]] = None,
    ):
        self.name = name
        self.system_prompt = system_prompt
        self.model = model or f"openai:{settings.llm_model}"
        self.metadata: dict[str, Any] = metadata or {}
        self._enabled_tools: Optional[list[str]] = tools
        
        # 创建PydanticAI Agent
        self._agent = Agent(
            self.model,
            system_prompt=self.system_prompt,
            deps_type=AgentDeps,
            output_type=str,
            defer_model_check=True,
        )
        
        # 注册工具
        self._register_tools()
    
    def _register_tools(self):
        """注册Agent工具"""
        from ..tools import get_tool
        
        enabled = self._enabled_tools
        
        if enabled is None or "search_knowledge" in enabled:
            @self._agent.tool
            async def search_knowledge(
                ctx: RunContext[AgentDeps],
                query: str,
                category: Optional[str] = None,
            ) -> str:
                """搜索运维知识库
                
                Args:
                    query: 搜索查询
                    category: 知识类别（可选）
                """
                if ctx.deps.knowledge_base:
                    results = await ctx.deps.knowledge_base.search(query, category)
                    return str(results)
                return "知识库未初始化"
        
        if enabled is None or "execute_command" in enabled:
            @self._agent.tool
            async def execute_command(
                ctx: RunContext[AgentDeps],
                server_id: str,
                command: str,
            ) -> str:
                """在服务器上执行命令
                
                Args:
                    server_id: 服务器ID
                    command: 要执行的命令
                """
                if ctx.deps.ssh_manager:
                    result = await ctx.deps.ssh_manager.execute(server_id, command)
                    return str(result)
                return "SSH管理器未初始化"
        
        if enabled is None or "get_alerts" in enabled:
            @self._agent.tool
            async def get_alerts(
                ctx: RunContext[AgentDeps],
                status: Optional[str] = None,
                severity: Optional[str] = None,
                limit: int = 10,
            ) -> str:
                """获取系统告警
                
                Args:
                    status: 告警状态过滤
                    severity: 告警级别过滤
                    limit: 返回数量限制
                """
                if ctx.deps.alert_manager:
                    alerts = await ctx.deps.alert_manager.list(
                        status=status,
                        severity=severity,
                        limit=limit,
                    )
                    return str(alerts)
                return "告警管理器未初始化"
        
        if enabled is None or "get_server_status" in enabled:
            @self._agent.tool
            async def get_server_status(
                ctx: RunContext[AgentDeps],
                server_id: Optional[str] = None,
            ) -> str:
                """获取服务器状态
                
                Args:
                    server_id: 服务器ID（可选，不传则返回所有服务器）
                """
                # 这里简化处理，实际应该调用服务器管理服务
                return f"获取服务器状态: {server_id or 'all'}"
        
        # 新增运维工具
        if enabled is None or "get_system_info" in enabled:
            @self._agent.tool
            async def get_system_info(
                ctx: RunContext[AgentDeps],
                info_type: str = "all",
            ) -> str:
                """获取系统信息（CPU、内存、磁盘、网络）
                
                Args:
                    info_type: 信息类型（cpu/memory/disk/network/all）
                """
                tool = get_tool("get_system_info")
                if tool:
                    result = await tool.execute(info_type=info_type)
                    return result.output if result.success else f"错误: {result.error}"
                return "系统信息工具未初始化"
        
        if enabled is None or "manage_processes" in enabled:
            @self._agent.tool
            async def manage_processes(
                ctx: RunContext[AgentDeps],
                action: str = "list",
                process_name: Optional[str] = None,
                top_n: int = 10,
            ) -> str:
                """查看和管理系统进程
                
                Args:
                    action: 操作类型（list/top/kill）
                    process_name: 进程名称
                    top_n: 显示前N个进程
                """
                tool = get_tool("manage_processes")
                if tool:
                    result = await tool.execute(action=action, process_name=process_name, top_n=top_n)
                    return result.output if result.success else f"错误: {result.error}"
                return "进程管理工具未初始化"
        
        if enabled is None or "network_diagnostics" in enabled:
            @self._agent.tool
            async def network_diagnostics(
                ctx: RunContext[AgentDeps],
                action: str = "ping",
                target: str = "8.8.8.8",
                port: Optional[int] = None,
            ) -> str:
                """网络诊断和检查
                
                Args:
                    action: 操作类型（ping/port_check/dns/traceroute）
                    target: 目标地址
                    port: 端口号
                """
                tool = get_tool("network_diagnostics")
                if tool:
                    result = await tool.execute(action=action, target=target, port=port)
                    return result.output if result.success else f"错误: {result.error}"
                return "网络诊断工具未初始化"
        
        if enabled is None or "analyze_logs" in enabled:
            @self._agent.tool
            async def analyze_logs(
                ctx: RunContext[AgentDeps],
                log_file: str = "/var/log/syslog",
                lines: int = 100,
                keyword: Optional[str] = None,
                level: Optional[str] = None,
            ) -> str:
                """分析系统日志
                
                Args:
                    log_file: 日志文件路径
                    lines: 显示行数
                    keyword: 关键词过滤
                    level: 日志级别（error/warning/info）
                """
                tool = get_tool("analyze_logs")
                if tool:
                    result = await tool.execute(log_file=log_file, lines=lines, keyword=keyword, level=level)
                    return result.output if result.success else f"错误: {result.error}"
                return "日志分析工具未初始化"
        
        if enabled is None or "manage_services" in enabled:
            @self._agent.tool
            async def manage_services(
                ctx: RunContext[AgentDeps],
                action: str = "status",
                service_name: str = "",
            ) -> str:
                """管理系统服务
                
                Args:
                    action: 操作类型（status/start/stop/restart/reload）
                    service_name: 服务名称
                """
                tool = get_tool("manage_services")
                if tool:
                    result = await tool.execute(action=action, service_name=service_name)
                    return result.output if result.success else f"错误: {result.error}"
                return "服务管理工具未初始化"
        
        if enabled is None or "disk_management" in enabled:
            @self._agent.tool
            async def disk_management(
                ctx: RunContext[AgentDeps],
                action: str = "usage",
                path: str = "/",
                top_n: int = 10,
            ) -> str:
                """磁盘空间分析和管理
                
                Args:
                    action: 操作类型（usage/cleanup/inodes）
                    path: 路径
                    top_n: 显示前N个大文件
                """
                tool = get_tool("disk_management")
                if tool:
                    result = await tool.execute(action=action, path=path, top_n=top_n)
                    return result.output if result.success else f"错误: {result.error}"
                return "磁盘管理工具未初始化"
    
    async def run(
        self,
        message: str,
        deps: Optional[AgentDeps] = None,
        context: Optional[dict[str, Any]] = None,
    ) -> AgentResponse:
        """运行Agent
        
        Args:
            message: 用户消息
            deps: 运行时依赖
            context: 额外上下文
            
        Returns:
            AgentResponse: Agent响应
        """
        if deps is None:
            deps = AgentDeps(settings=settings)
        
        # 构建完整提示词
        full_prompt = message
        if context:
            context_str = "\n".join(f"- {k}: {v}" for k, v in context.items())
            full_prompt = f"上下文信息：\n{context_str}\n\n用户问题：{message}"
        
        # 运行Agent
        result = await self._agent.run(full_prompt, deps=deps)
        
        return AgentResponse(
            content=result.data,
            confidence=1.0,
        )
    
    async def run_stream(
        self,
        message: str,
        deps: Optional[AgentDeps] = None,
        context: Optional[dict[str, Any]] = None,
    ):
        """流式运行Agent
        
        Args:
            message: 用户消息
            deps: 运行时依赖
            context: 额外上下文
            
        Yields:
            str: 流式输出的文本片段
        """
        if deps is None:
            deps = AgentDeps(settings=settings)
        
        # 构建完整提示词
        full_prompt = message
        if context:
            context_str = "\n".join(f"- {k}: {v}" for k, v in context.items())
            full_prompt = f"上下文信息：\n{context_str}\n\n用户问题：{message}"
        
        # 流式运行Agent
        async with self._agent.run_stream(full_prompt, deps=deps) as stream:
            async for text in stream.stream_text():
                yield text


# 预定义的Agent类型
class AlertAgent(ITOpsAgent):
    """告警处理Agent"""
    
    def __init__(self, model: Optional[str] = None):
        super().__init__(
            name="alert-agent",
            system_prompt="""你是告警处理专家，专注于分析和处理系统告警。

你的职责：
1. 分析告警内容，识别告警类型和严重程度
2. 提供告警处理建议和操作步骤
3. 关联历史告警，识别告警模式
4. 评估告警影响范围

回答要求：
- 优先处理严重告警
- 提供明确的操作步骤
- 注意告警之间的关联性""",
            model=model,
        )


class DiagnosisAgent(ITOpsAgent):
    """故障诊断Agent"""
    
    def __init__(self, model: Optional[str] = None):
        super().__init__(
            name="diagnosis-agent",
            system_prompt="""你是故障诊断专家，专注于分析系统故障和性能问题。

你的职责：
1. 分析系统日志和错误信息
2. 定位问题根因
3. 提供解决方案和修复步骤
4. 预防类似问题再次发生

回答要求：
- 系统性分析问题
- 提供多种可能的解决方案
- 给出预防措施""",
            model=model,
        )


class InspectionAgent(ITOpsAgent):
    """巡检Agent"""
    
    def __init__(self, model: Optional[str] = None):
        super().__init__(
            name="inspection-agent",
            system_prompt="""你是系统巡检专家，专注于执行系统健康检查和合规检查。

你的职责：
1. 执行系统健康检查
2. 检查安全合规性
3. 生成巡检报告
4. 提供优化建议

回答要求：
- 全面检查系统状态
- 识别潜在风险
- 提供改进建议""",
            model=model,
        )


# Agent工厂
def create_agent(
    agent_type: str = "general",
    model: Optional[str] = None,
) -> ITOpsAgent:
    """创建Agent实例
    
    Args:
        agent_type: Agent类型（general/alert/diagnosis/inspection）
        model: LLM模型
        
    Returns:
        ITOpsAgent: Agent实例
    """
    agents = {
        "general": ITOpsAgent,
        "alert": AlertAgent,
        "diagnosis": DiagnosisAgent,
        "inspection": InspectionAgent,
    }
    
    agent_class = agents.get(agent_type, ITOpsAgent)
    return agent_class(model=model)
