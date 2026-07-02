# 该文件职责：提供 ACP 服务端的入口与传输选择。

def acp_main(transport: str = "ws", host: str = "127.0.0.1", port: int = 8010) -> None:
    """Entry point for the multi-session ACP server."""
    import asyncio

    import acp

    from kimi_cli.acp.server import ACPServer
    from kimi_cli.acp.ws import run_ws_server
    from kimi_cli.app import enable_logging
    from kimi_cli.utils.logging import logger

    enable_logging()
    if transport == "stdio":
        logger.info("Starting ACP server on stdio")
        asyncio.run(acp.run_agent(ACPServer(), use_unstable_protocol=True))
    elif transport == "ws":
        asyncio.run(run_ws_server(host=host, port=port))
    else:
        raise ValueError(f"Unsupported transport: {transport}")
