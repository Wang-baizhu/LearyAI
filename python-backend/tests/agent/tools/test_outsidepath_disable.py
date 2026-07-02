# Responsibilities: verify tools reject paths outside the working directory.
"""Tests for disabling access outside the working directory."""

from __future__ import annotations

from pathlib import Path

from inline_snapshot import snapshot

from kimi_cli.tools.file.grep_local import Grep, Params as GrepParams
from kimi_cli.tools.file.read import Params as ReadParams, ReadFile
from kimi_cli.tools.file.read_media import Params as ReadMediaParams, ReadMediaFile
from kimi_cli.tools.file.replace import Edit, Params as ReplaceParams, StrReplaceFile
from kimi_cli.tools.file.write import Params as WriteParams, WriteFile


async def test_read_file_outside_work_dir(read_file_tool: ReadFile, outside_file: Path):
    # Prepare an external text file.
    """验证：read file outside work dir。"""
    outside_file.write_text("outside", encoding="utf-8")

    # Attempt to read the external file.
    result = await read_file_tool(ReadParams(path=str(outside_file)))

    # Expect rejection for outside-workdir access.
    assert result.is_error
    assert result.message == snapshot(f"`{outside_file}` is outside the working directory.")


async def test_read_media_outside_work_dir(read_media_file_tool: ReadMediaFile, outside_file: Path):
    # Prepare an external image-like file.
    """验证：read media outside work dir。"""
    outside_file.write_bytes(b"\x89PNG\r\n\x1a\n" + b"pngdata")

    # Attempt to read the external media file.
    result = await read_media_file_tool(ReadMediaParams(path=str(outside_file)))

    # Expect rejection for outside-workdir access.
    assert result.is_error
    assert result.message == snapshot(f"`{outside_file}` is outside the working directory.")


async def test_write_outside_work_dir(write_file_tool: WriteFile, outside_file: Path):
    # Attempt to write to an external path.
    """验证：write outside work dir。"""
    result = await write_file_tool(WriteParams(path=str(outside_file), content="content"))

    # Expect rejection and no file creation.
    assert result.is_error
    assert result.message == snapshot(f"`{outside_file}` is outside the working directory.")
    assert not outside_file.exists()


async def test_replace_outside_work_dir(
    str_replace_file_tool: StrReplaceFile, outside_file: Path
):
    # Prepare an external text file.
    """验证：replace outside work dir。"""
    outside_file.write_text("old content", encoding="utf-8")

    # Attempt to edit the external file.
    result = await str_replace_file_tool(
        ReplaceParams(path=str(outside_file), edit=Edit(old="old", new="new"))
    )

    # Expect rejection and no content change.
    assert result.is_error
    assert result.message == snapshot(f"`{outside_file}` is outside the working directory.")
    assert outside_file.read_text(encoding="utf-8") == "old content"


async def test_grep_outside_work_dir(grep_tool: Grep, outside_file: Path):
    # Prepare an external text file.
    """验证：grep outside work dir。"""
    outside_file.write_text("hello outside", encoding="utf-8")

    # Attempt to search the external file.
    result = await grep_tool(
        GrepParams(pattern="hello", path=str(outside_file), output_mode="content")
    )

    # Expect rejection for outside-workdir access.
    assert result.is_error
    assert result.message == snapshot(f"`{outside_file}` is outside the working directory.")
