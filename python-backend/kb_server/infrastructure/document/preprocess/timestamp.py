# 该文件职责：统一预处理链路中的时间戳格式化与分段文本拼接逻辑。

from __future__ import annotations


def format_seconds(value: object | None) -> str | None:
    if value is None:
        return None
    total_seconds = max(0, int(round(float(value))))
    hours, remainder = divmod(total_seconds, 3600)
    minutes, seconds = divmod(remainder, 60)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}"


def format_timestamp_range(*, start_seconds: object | None, end_seconds: object | None) -> str:
    start = format_seconds(start_seconds)
    end = format_seconds(end_seconds)
    if start and end:
        return f"[{start}-{end}]"
    if start:
        return f"[{start}]"
    if end:
        return f"[00:00:00-{end}]"
    return ""


def build_segment_line(*, text: object, start_seconds: object | None, end_seconds: object | None) -> str:
    normalized_text = str(text or "").strip()
    if not normalized_text:
        return ""
    prefix = format_timestamp_range(start_seconds=start_seconds, end_seconds=end_seconds)
    return f"{prefix} {normalized_text}".strip()
