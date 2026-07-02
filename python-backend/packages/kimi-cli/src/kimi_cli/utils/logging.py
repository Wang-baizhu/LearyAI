# 该文件职责：复用统一日志包并对 kimi_cli 暴露日志工具接口。
from leary_logging import (
    StderrRedirector,
    get_logger,
    open_original_stderr,
    redirect_stderr_to_logger,
    setup_logging,
)

logger = get_logger("kimi_cli")

__all__ = [
    "StderrRedirector",
    "get_logger",
    "logger",
    "open_original_stderr",
    "redirect_stderr_to_logger",
    "setup_logging",
]
