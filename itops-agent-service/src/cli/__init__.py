"""CLI模块 - 命令行接口"""

from __future__ import annotations

import asyncio
import sys
from typing import Optional

import click
from rich.console import Console
from rich.markdown import Markdown
from rich.panel import Panel
from rich.prompt import Prompt

from .agents import create_agent
from .config import settings
from .deps import AgentDeps
from .knowledge import get_knowledge_base

console = Console()


def print_welcome():
    """打印欢迎信息"""
    welcome_text = """
# ITOps Agent CLI

智能运维Agent命令行工具

**可用命令：**
- 直接输入问题与Agent对话
- `/help` - 显示帮助
- `/agent <type>` - 切换Agent类型（general/alert/diagnosis/inspection）
- `/knowledge <query>` - 搜索知识库
- `/clear` - 清屏
- `/quit` - 退出

**Agent类型：**
- `general` - 通用运维Agent
- `alert` - 告警处理Agent
- `diagnosis` - 故障诊断Agent
- `inspection` - 巡检Agent
"""
    console.print(Panel(Markdown(welcome_text), title="欢迎使用", border_style="green"))


def print_help():
    """打印帮助信息"""
    help_text = """
**可用命令：**

| 命令 | 说明 |
|------|------|
| `/help` | 显示此帮助信息 |
| `/agent <type>` | 切换Agent类型 |
| `/knowledge <query>` | 搜索知识库 |
| `/clear` | 清屏 |
| `/quit` | 退出程序 |

**Agent类型：**
- `general` - 通用运维Agent（默认）
- `alert` - 告警处理Agent
- `diagnosis` - 故障诊断Agent
- `inspection` - 巡检Agent

**使用示例：**
```
> 服务器CPU使用率过高怎么办？
> /agent alert
> 最近有什么告警？
> /knowledge 磁盘空间不足
```
"""
    console.print(Panel(Markdown(help_text), title="帮助", border_style="blue"))


async def run_chat_loop(agent_type: str = "general"):
    """运行聊天循环
    
    Args:
        agent_type: Agent类型
    """
    # 创建Agent
    agent = create_agent(agent_type)
    
    # 创建依赖
    deps = AgentDeps(settings=settings)
    
    console.print(f"[green]当前Agent: {agent_type}[/green]")
    console.print("[dim]输入 /help 查看帮助[/dim]\n")
    
    while True:
        try:
            # 获取用户输入
            user_input = Prompt.ask("[bold blue]你[/bold blue]")
            
            # 处理命令
            if user_input.startswith("/"):
                command = user_input.strip().split()
                
                if command[0] == "/quit":
                    console.print("[yellow]再见！[/yellow]")
                    break
                
                elif command[0] == "/help":
                    print_help()
                    continue
                
                elif command[0] == "/clear":
                    console.clear()
                    print_welcome()
                    continue
                
                elif command[0] == "/agent":
                    if len(command) < 2:
                        console.print("[red]请指定Agent类型: /agent <type>[/red]")
                        continue
                    
                    new_type = command[1]
                    valid_types = ["general", "alert", "diagnosis", "inspection"]
                    
                    if new_type not in valid_types:
                        console.print(f"[red]无效的Agent类型，可用: {', '.join(valid_types)}[/red]")
                        continue
                    
                    agent_type = new_type
                    agent = create_agent(agent_type)
                    console.print(f"[green]已切换到 {agent_type} Agent[/green]")
                    continue
                
                elif command[0] == "/knowledge":
                    if len(command) < 2:
                        console.print("[red]请指定搜索查询: /knowledge <query>[/red]")
                        continue
                    
                    query = " ".join(command[1:])
                    kb = await get_knowledge_base()
                    results = await kb.search(query)
                    
                    if not results:
                        console.print("[yellow]未找到相关知识[/yellow]")
                    else:
                        console.print(f"\n[bold]找到 {len(results)} 条相关知识：[/bold]\n")
                        for i, result in enumerate(results, 1):
                            console.print(f"[bold cyan]{i}. {result.article.title}[/bold cyan]")
                            console.print(f"   类别: {result.article.category}")
                            console.print(f"   相关度: {result.score:.2f}")
                            if result.article.summary:
                                console.print(f"   摘要: {result.article.summary}")
                            console.print()
                    continue
                
                else:
                    console.print(f"[red]未知命令: {command[0]}[/red]")
                    continue
            
            # 普通对话
            if not user_input.strip():
                continue
            
            # 显示思考中
            with console.status("[bold green]思考中..."):
                response = await agent.run(user_input, deps=deps)
            
            # 显示响应
            console.print()
            console.print(Panel(
                Markdown(response.content),
                title="[bold green]Agent[/bold green]",
                border_style="green",
            ))
            console.print()
        
        except KeyboardInterrupt:
            console.print("\n[yellow]使用 /quit 退出[/yellow]")
            continue
        
        except Exception as e:
            console.print(f"[red]错误: {e}[/red]")
            continue


@click.command()
@click.option("--agent", "-a", default="general", help="Agent类型 (general/alert/diagnosis/inspection)")
@click.option("--message", "-m", default=None, help="直接发送消息（非交互模式）")
@click.option("--verbose", "-v", is_flag=True, help="详细输出")
def main(agent: str, message: Optional[str], verbose: bool):
    """ITOps Agent CLI - 智能运维Agent命令行工具"""
    if verbose:
        console.print(f"[dim]配置: {settings.model_dump()}[/dim]")
    
    if message:
        # 非交互模式：直接发送消息
        async def run_single():
            agent_instance = create_agent(agent)
            deps = AgentDeps(settings=settings)
            response = await agent_instance.run(message, deps=deps)
            console.print(Markdown(response.content))
        
        asyncio.run(run_single())
    else:
        # 交互模式
        print_welcome()
        asyncio.run(run_chat_loop(agent))


if __name__ == "__main__":
    main()
