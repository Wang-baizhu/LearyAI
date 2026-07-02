# Responsibilities: build task prompts and system prompt variables.

from __future__ import annotations

from typing import Any

from kimi_cli.wire.types import AudioURLPart, ContentPart, ImageURLPart, TextPart

from tasks_server.task.errors import TaskError, TaskErrorCode, TaskErrorDetail

SYSTEM_PROMPT_TEMPLATE_DEFAULTS: dict[str, str] = {
    "doc_summary": "",
    "extra_info": "",
}


class PromptBuildError(TaskError):
    pass


def build_system_prompt_vars(values: dict[str, Any]) -> dict[str, str]:
    normalized = {key: "" if value is None else str(value) for key, value in values.items()}
    result = dict(SYSTEM_PROMPT_TEMPLATE_DEFAULTS)
    for key, value in normalized.items():
        if key in result:
            result[key] = value
    return result


def _build_data_url(mime_type: str | None, data: str | None) -> str | None:
    if not mime_type or not data:
        return None
    return f"data:{mime_type};base64,{data}"


def parse_prompt_blocks(raw: Any) -> list[Any]:
    if not raw:
        return []
    blocks: list[Any] = []
    for item in raw:
        if isinstance(item, ContentPart):
            blocks.append(item)
            continue
        if isinstance(item, str):
            if item.strip():
                blocks.append(TextPart(text=item))
            continue
        if not isinstance(item, dict):
            continue
        block_type = item.get("type")
        if not block_type and "text" in item:
            blocks.append(TextPart(text=str(item.get("text") or "")))
            continue
        if block_type == "text":
            blocks.append(TextPart.model_validate(item))
            continue
        if block_type == "image":
            url = _build_data_url(item.get("mime_type"), item.get("data"))
            if url:
                blocks.append(ImageURLPart(image_url=ImageURLPart.ImageURL(url=url)))
            else:
                raise PromptBuildError(TaskErrorDetail(TaskErrorCode.INVALID_PROMPT, "invalid image block"))
            continue
        if block_type == "audio":
            url = _build_data_url(item.get("mime_type"), item.get("data"))
            if url:
                blocks.append(AudioURLPart(audio_url=AudioURLPart.AudioURL(url=url)))
            else:
                raise PromptBuildError(TaskErrorDetail(TaskErrorCode.INVALID_PROMPT, "invalid audio block"))
            continue
        if block_type == "system_text":
            blocks.append({"type": "system_text", "text": item.get("text")})
            continue
    return blocks


def build_doc_summary(doc_infos: list[dict[str, object]]) -> str:
    lines: list[str] = []
    for info in doc_infos:
        doc_id = info.get("id")
        name = info.get("name")
        if doc_id is None:
            continue
        label = f"{doc_id}({name})" if name else f"{doc_id}"
        lines.append(f"- {label}")
    return "\n".join(lines)


def build_system_prompt_vars_from_task(
    doc_infos: list[dict[str, object]],
    extra_info: str | None = None,
) -> dict[str, str] | None:
    has_doc_infos = bool(doc_infos)
    has_extra_info = isinstance(extra_info, str) and bool(extra_info.strip())
    if not has_doc_infos and not has_extra_info:
        return None
    values: dict[str, str] = {}
    if has_doc_infos:
        values["doc_summary"] = build_doc_summary(doc_infos)
    if has_extra_info:
        values["extra_info"] = extra_info.strip()
    return build_system_prompt_vars(values)
