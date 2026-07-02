# 该文件职责：定义 agent query HTTP 入口的请求与响应结构。

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class QueryDocRef(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    name: str | None = None


class AgentQueryHttpRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    agentSessionId: str
    subagentId: str | None = None
    requestId: str
    prompt: list[dict[str, Any]] = Field(default_factory=list)
    projectId: str | None = None
    kbId: str | None = None
    skills_type: str | None = None
    agent_type: str | None = None
    model_config_type: str | None = None
    custom_prompt: str | None = None
    docRefs: list[QueryDocRef] = Field(default_factory=list)


class AgentQueryHttpResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    queryId: str
    agentSessionId: str
    status: str = "accepted"
