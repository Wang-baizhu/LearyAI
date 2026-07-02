"""Responsibilities: define persisted session state models shared by store backends."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class ApprovalStateData(BaseModel):
    yolo: bool | None = None
    auto_approve_actions: set[str] = Field(default_factory=set)


class TodoItemState(BaseModel):
    """A single todo item stored in session state."""

    title: str
    status: Literal["pending", "in_progress", "done"]


class TemplateBatchFragment(BaseModel):
    """One template fragment collected for deferred merge/upload."""

    seq: int
    content: str


class TemplateBatchState(BaseModel):
    """Persisted batch assembly state for template tools."""

    plugin_id: str
    name: str | None = None
    total_seq: int
    fragments: dict[int, TemplateBatchFragment] = Field(default_factory=dict)
    tags: list[str] = Field(default_factory=list)
    sources: list[str] = Field(default_factory=list)
    kb_id: str | None = None
    created_by_user_id: str
    uploaded_template_id: str | None = None
    status: Literal["pending", "uploaded"] = "pending"


class KnowledgeBaseDocFragmentState(BaseModel):
    """One documentation fragment collected for deferred KB doc info update."""

    seq: int
    documentation: str


class KnowledgeBaseDocUpdateBatchState(BaseModel):
    """Persisted batch assembly state for KB doc info updates."""

    doc_id: str
    total_seq: int
    fragments: dict[int, KnowledgeBaseDocFragmentState] = Field(default_factory=dict)
    status: Literal["pending", "updated"] = "pending"


class SessionState(BaseModel):
    version: int = 1
    approval: ApprovalStateData = Field(default_factory=ApprovalStateData)
    additional_dirs: list[str] = Field(default_factory=list)
    custom_title: str | None = None
    title_generated: bool = False
    title_generate_attempts: int = 0
    plan_mode: bool | None = None
    plan_session_id: str | None = None
    plan_slug: str | None = None
    wire_mtime: float | None = None
    archived: bool = False
    archived_at: float | None = None
    auto_archive_exempt: bool = False
    todos: list[TodoItemState] = Field(default_factory=list)
    template_batches: dict[str, TemplateBatchState] = Field(default_factory=dict)
    kb_doc_update_batches: dict[str, KnowledgeBaseDocUpdateBatchState] = Field(default_factory=dict)
