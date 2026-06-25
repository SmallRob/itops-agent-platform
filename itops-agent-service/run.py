#!/usr/bin/env python3
"""ITOps Agent Service 启动脚本"""

import argparse
import asyncio
import sys
from pathlib import Path

# 添加项目根目录到Python路径
sys.path.insert(0, str(Path(__file__).parent))


def main():
    parser = argparse.ArgumentParser(description="ITOps Agent Service")
    parser.add_argument(
        "command",
        choices=["api", "cli", "mcp"],
        help="启动模式 (api/cli/mcp)",
    )
    parser.add_argument(
        "--host",
        default="0.0.0.0",
        help="API服务主机 (默认: 0.0.0.0)",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8000,
        help="API服务端口 (默认: 8000)",
    )
    parser.add_argument(
        "--agent",
        default="general",
        choices=["general", "alert", "diagnosis", "inspection"],
        help="CLI模式的Agent类型",
    )
    parser.add_argument(
        "--message",
        "-m",
        help="直接发送消息（CLI模式）",
    )
    
    args = parser.parse_args()
    
    if args.command == "api":
        # 启动API服务
        import uvicorn
        from src.api import app
        uvicorn.run(app, host=args.host, port=args.port)
    
    elif args.command == "cli":
        # 启动CLI
        from src.cli import main as cli_main
        sys.argv = ["itops-agent"]
        if args.agent:
            sys.argv.extend(["--agent", args.agent])
        if args.message:
            sys.argv.extend(["--message", args.message])
        cli_main()
    
    elif args.command == "mcp":
        # 启动MCP服务
        from src.mcp import main as mcp_main
        asyncio.run(mcp_main())


if __name__ == "__main__":
    main()
