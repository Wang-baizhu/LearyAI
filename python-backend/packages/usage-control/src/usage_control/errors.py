"""该文件职责：定义 usage-control 共享包的显式业务异常。"""

from __future__ import annotations

from kosong.chat_provider import ChatProviderError


class UsageTurnDeniedError(RuntimeError):
    """会员 turn 在开始阶段被额度控制拒绝。"""


class UsageCallDeniedError(ChatProviderError):
    """单次 llm_call 在额度控制阶段被拒绝。"""
