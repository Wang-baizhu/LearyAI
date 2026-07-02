# 该文件职责：定义 KB RAG HTTP 接口的请求模型。

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class RagSearchRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    query: str = Field(..., min_length=1)
    doc_ids: list[str] | None = Field(default=None)


class RagFetchRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    doc_ids: list[str] = Field(..., min_length=1)
    page_nums: list[int] = Field(..., min_length=1)
    store_keys: list[str] | None = Field(default=None)


class RagDocInfoRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    doc_id: str = Field(..., min_length=1)
    node_id: str | None = None


class RagUpdateDocInfoRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    doc_id: str = Field(..., min_length=1)
    tag: str | None = None
    description: str | None = None
    parent_node_id: str | None = None
    nodes: Any | None = None
    name: str | None = None
