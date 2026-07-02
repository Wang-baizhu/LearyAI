# Responsibilities: convert websocket prompt blocks into wire ContentPart items.

from __future__ import annotations

from typing import Any

from agent_ws.handlers import logger
from kimi_cli.wire.types import AudioURLPart, ContentPart, ImageURLPart, TextPart


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
                logger.warning("wire_prompt: invalid image block payload=%s", item)
            continue
        if block_type == "audio":
            url = _build_data_url(item.get("mime_type"), item.get("data"))
            if url:
                blocks.append(AudioURLPart(audio_url=AudioURLPart.AudioURL(url=url)))
            else:
                logger.warning("wire_prompt: invalid audio block payload=%s", item)
            continue
        if block_type == "system_text":
            blocks.append({"type": "system_text", "text": item.get("text")})
            continue
        if block_type in {"resource", "embedded_resource"}:
            logger.warning("wire_prompt: unsupported resource block type=%s", block_type)
            continue
    return blocks
