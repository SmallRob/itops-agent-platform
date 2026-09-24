"""Agent模块 - 智能运维Agent实现

设计要点（ARCH-20260925-itops-agent-service / ADR-1、ADR-2）：
- ITOpsAgent 构造只保存配置，PydanticAI Agent 在每次 run/run_stream 时现场构建，
  LLM 配置变更（POST /api/llm/config）无需任何缓存失效即生效；
- 模型实例由 resolve_model() 显式构造（OpenAI 兼容协议），凭据一律来自 LLM 配置
  管理器（平台模型池同步），不依赖进程环境变量。
"""

from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field
from pydantic_ai import RunContext

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


class LLMNotConfiguredError(RuntimeError):
    """LLM 未配置（缺少 API Key 或模型名），调用方应返回结构化的可行动错误"""


class AgentResponse(BaseModel):
    """Agent响应"""
    content: str = Field(description="响应内容")
    thinking: Optional[str] = Field(default=None, description="思考过程")
    tools_used: list[str] = Field(default_factory=list, description="使用的工具")
    confidence: float = Field(default=1.0, description="置信度")
    suggestions: list[str] = Field(default_factory=list, description="后续建议")


def _build_openai_compatible_model(model_name: str, api_base: str, api_key: str):
    """构造 OpenAI 兼容协议的模型实例（DeepSeek/豆包/千问/本地均兼容）

    pydantic-ai 1.x 将 OpenAIModel 更名为 OpenAIChatModel，这里做双版本兼容。
    """
    try:
        from pydantic_ai.models.openai import OpenAIChatModel
    except ImportError:  # pydantic-ai 0.x
        from pydantic_ai.models.openai import OpenAIModel as OpenAIChatModel  # type: ignore[no-redef]
    from pydantic_ai.providers.openai import OpenAIProvider

    return OpenAIChatModel(
        model_name,
        provider=OpenAIProvider(base_url=api_base, api_key=api_key),
    )


def resolve_model(model: Optional[str] = None):
    """解析模型实例；凭据只来自 LLM 配置管理器

    Args:
        model: 模型名。None 表示用当前配置的默认模型；带 ``provider:name``
            前缀的串（如 "openai:gpt-4o"）只提取名称部分 —— 协议端点与凭据
            一律取自配置管理器，避免 pydantic-ai provider 注册表去读进程环境变量。

    Raises:
        LLMNotConfiguredError: 缺少 API Key 或模型名为空。
    """
    # 函数内导入：避免 api 包与 agents 包在 import 期的隐式耦合
    from ..api.llm_config_manager import get_llm_config_manager

    cfg = get_llm_config_manager().get_config()
    name = (model or cfg.model or "").strip()
    if ":" in name:
        name = name.split(":", 1)[1].strip()
    if not name:
        raise LLMNotConfiguredError("LLM 模型名未配置")
    if not cfg.api_key:
        raise LLMNotConfiguredError(
            f"LLM 未配置：模型 {name} 缺少 API Key。"
            "请由平台同步（POST /api/llm/config）或设置对应环境变量（如 DEEPSEEK_API_KEY）"
        )
    api_base = (cfg.api_base or "https://api.openai.com/v1").strip()
    return _build_openai_compatible_model(name, api_base, cfg.api_key)


class ITOpsAgent:
    """IT运维Agent基类（惰性构建：构造只存配置，运行时才装配 PydanticAI Agent）"""

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
        self.model_override = model
        self.metadata: dict[str, Any] = metadata or {}
        self._enabled_tools: Optional[list[str]] = tools

    @property
    def model(self) -> Optional[str]:
        """展示用模型名（不带 provider 前缀）"""
        name = self.model_override
        if name and ":" in name:
            name = name.split(":", 1)[1]
        return name

    def _build_agent(self):
        """现场构建 PydanticAI Agent 并注册工具"""
        from pydantic_ai import Agent

        agent = Agent(
            resolve_model(self.model_override),
            system_prompt=self.system_prompt,
            deps_type=AgentDeps,
            output_type=str,
        )
        self._register_tools(agent)
        return agent

    def _register_tools(self, agent):
        """注册Agent工具"""
        from ..tools import get_tool

        enabled = self._enabled_tools

        if enabled is None or "search_knowledge" in enabled:
            @agent.tool
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
            @agent.tool
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
            @agent.tool
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
            @agent.tool
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
            @agent.tool
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
            @agent.tool
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
            @agent.tool
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
            @agent.tool
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
            @agent.tool
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
            @agent.tool
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

    # ============================================================
    # 提示词组装与结果提取
    # ============================================================

    def _compose_prompt(
        self,
        message: str,
        context: Optional[dict[str, Any]] = None,
        history: Optional[str] = None,
    ) -> str:
        """组装完整提示词：会话历史 + 上下文 + 用户问题"""
        from ..sessions import SESSION_KEY_FIELDS

        sections: list[str] = []
        if history:
            sections.append(f"对话历史（近期，供参考）：\n{history}")
        if context:
            context_items = [
                f"- {k}: {v}"
                for k, v in context.items()
                if k not in SESSION_KEY_FIELDS
            ]
            if context_items:
                sections.append("上下文信息：\n" + "\n".join(context_items))
        sections.append(f"用户问题：{message}")
        return "\n\n".join(sections)

    def _model_settings(self) -> Optional[dict[str, Any]]:
        """模型调用参数。温度不传：部分推理模型会拒绝该参数；max_tokens 保证推理链有余量"""
        from ..api.llm_config_manager import get_llm_config_manager

        cfg = get_llm_config_manager().get_config()
        if cfg.max_tokens:
            return {"max_tokens": int(cfg.max_tokens)}
        return None

    @staticmethod
    def _result_output(result) -> str:
        """提取文本输出（pydantic-ai 0.x 用 result.data，1.x 用 result.output）"""
        output = getattr(result, "output", None)
        if output is None:
            output = getattr(result, "data", None)
        if output is None:
            return ""
        return output if isinstance(output, str) else str(output)

    @staticmethod
    def _extract_tools_used(result) -> list[str]:
        """从消息历史提取本次实际调用的工具名"""
        names: list[str] = []
        try:
            for message in result.all_messages():
                for part in getattr(message, "parts", []):
                    if getattr(part, "part_kind", "") == "tool-call":
                        name = getattr(part, "tool_name", None)
                        if name:
                            names.append(str(name))
        except Exception:
            return []
        return sorted(set(names))

    # ============================================================
    # 执行入口
    # ============================================================

    async def run(
        self,
        message: str,
        deps: Optional[AgentDeps] = None,
        context: Optional[dict[str, Any]] = None,
        history: Optional[str] = None,
    ) -> AgentResponse:
        """运行Agent

        Args:
            message: 用户消息
            deps: 运行时依赖
            context: 额外上下文
            history: 会话历史文本块（由 API 层按 sessionKey 渲染注入）

        Returns:
            AgentResponse: Agent响应
        """
        agent = self._build_agent()
        if deps is None:
            deps = AgentDeps(settings=settings)

        full_prompt = self._compose_prompt(message, context, history)
        result = await agent.run(full_prompt, deps=deps, model_settings=self._model_settings())

        return AgentResponse(
            content=self._result_output(result),
            tools_used=self._extract_tools_used(result),
            confidence=1.0,
        )

    async def run_stream(
        self,
        message: str,
        deps: Optional[AgentDeps] = None,
        context: Optional[dict[str, Any]] = None,
        history: Optional[str] = None,
    ):
        """流式运行Agent

        Args:
            message: 用户消息
            deps: 运行时依赖
            context: 额外上下文
            history: 会话历史文本块

        Yields:
            str: 流式输出的文本片段
        """
        agent = self._build_agent()
        if deps is None:
            deps = AgentDeps(settings=settings)

        full_prompt = self._compose_prompt(message, context, history)

        # 流式运行Agent
        async with agent.run_stream(full_prompt, deps=deps) as stream:
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
