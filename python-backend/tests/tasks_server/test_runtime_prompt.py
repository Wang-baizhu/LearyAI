# 该文件职责：验证 tasks_server prompt 解析与系统提示变量构建逻辑。

from __future__ import annotations

import unittest

try:
    from kimi_cli.wire.types import AudioURLPart, ImageURLPart, TextPart
except ModuleNotFoundError as exc:
    if exc.name == "kimi_cli":
        AudioURLPart = None  # type: ignore[assignment]
        ImageURLPart = None  # type: ignore[assignment]
        TextPart = None  # type: ignore[assignment]
    else:
        raise

try:
    from tasks_server.runtime.prompt import (
        PromptBuildError,
        build_doc_summary,
        build_system_prompt_vars,
        build_system_prompt_vars_from_task,
        parse_prompt_blocks,
    )
    from tasks_server.task.errors import TaskErrorCode
except ModuleNotFoundError as exc:
    if exc.name in {"kimi_cli", "kosong"}:
        PromptBuildError = None  # type: ignore[assignment]
        build_doc_summary = None  # type: ignore[assignment]
        build_system_prompt_vars = None  # type: ignore[assignment]
        build_system_prompt_vars_from_task = None  # type: ignore[assignment]
        parse_prompt_blocks = None  # type: ignore[assignment]
        TaskErrorCode = None  # type: ignore[assignment]
    else:
        raise


@unittest.skipIf(TextPart is None or parse_prompt_blocks is None, "kimi_cli not installed")
class TaskRuntimePromptTests(unittest.TestCase):
    # 测试内容：系统提示变量会合并默认值并把 None 归一为空字符串。
    def test_build_system_prompt_vars_merges_defaults(self) -> None:
        result = build_system_prompt_vars({"doc_summary": None, "ignored": "x"})

        self.assertEqual(result, {"doc_summary": "", "extra_info": ""})

    # 测试内容：parse_prompt_blocks 支持文本、多模态和 system_text 混合输入。
    def test_parse_prompt_blocks_supports_text_image_audio_and_system_text(self) -> None:
        blocks = parse_prompt_blocks(
            [
                "hello",
                {"type": "text", "text": "world"},
                {"type": "image", "mime_type": "image/png", "data": "ZmFrZQ=="},
                {"type": "audio", "mime_type": "audio/mpeg", "data": "YmVl"},
                {"type": "system_text", "text": "system line"},
                {"text": "fallback"},
            ]
        )

        self.assertIsInstance(blocks[0], TextPart)
        self.assertEqual(blocks[0].text, "hello")
        self.assertIsInstance(blocks[1], TextPart)
        self.assertEqual(blocks[1].text, "world")
        self.assertIsInstance(blocks[2], ImageURLPart)
        self.assertEqual(blocks[2].image_url.url, "data:image/png;base64,ZmFrZQ==")
        self.assertIsInstance(blocks[3], AudioURLPart)
        self.assertEqual(blocks[3].audio_url.url, "data:audio/mpeg;base64,YmVl")
        self.assertEqual(blocks[4], {"type": "system_text", "text": "system line"})
        self.assertIsInstance(blocks[5], TextPart)
        self.assertEqual(blocks[5].text, "fallback")

    # 测试内容：非法图片块会映射为 INVALID_PROMPT。
    def test_parse_prompt_blocks_invalid_image_raises_prompt_error(self) -> None:
        with self.assertRaises(PromptBuildError) as ctx:
            parse_prompt_blocks([{"type": "image", "mime_type": "image/png", "data": ""}])

        self.assertEqual(ctx.exception.detail.code, TaskErrorCode.INVALID_PROMPT)

    # 测试内容：文档摘要会拼接成稳定格式。
    def test_build_doc_summary_formats_doc_refs(self) -> None:
        summary = build_doc_summary(
            [
                {"id": "doc-1", "name": "Alpha"},
                {"id": "doc-2", "name": None},
                {"name": "missing-id"},
            ]
        )

        self.assertEqual(summary, "- doc-1(Alpha)\n- doc-2")

    # 测试内容：system vars 会按任务输入拼接 doc_summary 与 extra_info。
    def test_build_system_prompt_vars_from_task(self) -> None:
        self.assertIsNone(build_system_prompt_vars_from_task([], None))

        result = build_system_prompt_vars_from_task(
            [{"id": "doc-1", "name": "Alpha"}],
            "docs=1;templates=2",
        )

        self.assertEqual(result, {"doc_summary": "- doc-1(Alpha)", "extra_info": "docs=1;templates=2"})


if __name__ == "__main__":
    unittest.main()
