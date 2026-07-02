# 该文件职责：验证语言检测与模型准备服务的关键错误路径和 provider 行为。

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from knowledge_base.domain.language_detector import FastLangDetectLanguageDetector
from knowledge_base.infrastructure.model_preparer import HuggingFaceModelPreparer


class RagServicesTests(unittest.TestCase):
    def test_fast_langdetect_rejects_blank_text(self) -> None:
        detector = FastLangDetectLanguageDetector()

        with self.assertRaisesRegex(ValueError, "语言检测文本不能为空"):
            detector.detect(" \n\t ")

    def test_fast_langdetect_maps_supported_languages(self) -> None:
        detector = FastLangDetectLanguageDetector()
        with patch("knowledge_base.domain.language_detector._detect_language", return_value="EN"):
            self.assertEqual(detector.detect("hello"), "en")
        with patch("knowledge_base.domain.language_detector._detect_language", return_value="zh-cn"):
            self.assertEqual(detector.detect("你好"), "zh")

    def test_fast_langdetect_raises_when_dependency_missing(self) -> None:
        detector = FastLangDetectLanguageDetector()

        with patch("knowledge_base.domain.language_detector._detect_language", None):
            with self.assertRaisesRegex(RuntimeError, "fast_langdetect 未安装"):
                detector.detect("hello")

    def test_fast_langdetect_retries_with_control_chars_removed(self) -> None:
        detector = FastLangDetectLanguageDetector()
        calls: list[str] = []

        def _fake_detect(text: str) -> str:
            calls.append(text)
            if len(calls) == 1:
                raise RuntimeError("bad input")
            return "en"

        with patch("knowledge_base.domain.language_detector._detect_language", side_effect=_fake_detect):
            result = detector.detect("he\x00llo")

        self.assertEqual(result, "en")
        self.assertEqual(calls, ["he\x00llo", "hello"])

    def test_fast_langdetect_falls_back_to_zh_for_unsupported_language_with_cjk_text(self) -> None:
        detector = FastLangDetectLanguageDetector()
        with patch("knowledge_base.domain.language_detector._detect_language", return_value="ko"):
            self.assertEqual(detector.detect("这是 OCR 识别出来的中文内容"), "zh")

    def test_fast_langdetect_falls_back_to_en_for_unsupported_language_with_latin_text(self) -> None:
        detector = FastLangDetectLanguageDetector()
        with patch("knowledge_base.domain.language_detector._detect_language", return_value="fr"):
            self.assertEqual(detector.detect("bonjour this page is mostly english"), "en")

    def test_fast_langdetect_defaults_to_en_when_fallback_counts_are_tied(self) -> None:
        detector = FastLangDetectLanguageDetector()
        with patch("knowledge_base.domain.language_detector._detect_language", return_value="ja"):
            self.assertEqual(detector.detect("中文ab"), "en")

    def test_model_preparer_downloads_missing_model_directory(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            model_dir = Path(tmp_dir) / "bge-base-en-v1.5"

            def _fake_download(*, repo_id, local_dir, local_dir_use_symlinks):
                self.assertEqual(repo_id, "BAAI/bge-base-en-v1.5")
                self.assertFalse(local_dir_use_symlinks)
                Path(local_dir).mkdir(parents=True, exist_ok=True)
                (Path(local_dir) / "pytorch_model.bin").write_bytes(b"demo")

            preparer = HuggingFaceModelPreparer()
            with (
                patch(
                    "knowledge_base.infrastructure.model_preparer.snapshot_download",
                    side_effect=_fake_download,
                ),
                patch(
                    "knowledge_base.infrastructure.model_preparer.get_provider_config",
                    return_value=type(
                        "_Cfg",
                        (),
                        {
                            "model_local_path": str(model_dir),
                            "model_repo_id": "BAAI/bge-base-en-v1.5",
                        },
                    )(),
                ),
            ):
                resolved = preparer.ensure_ready("en")

        self.assertEqual(resolved, model_dir)

    def test_model_preparer_redownloads_when_directory_lacks_weight_file(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            model_dir = Path(tmp_dir) / "incomplete-model"
            model_dir.mkdir(parents=True, exist_ok=True)
            (model_dir / "config.json").write_text("{}", encoding="utf-8")
            calls: list[str] = []

            def _fake_download(*, repo_id, local_dir, local_dir_use_symlinks):
                calls.append(repo_id)
                self.assertEqual(local_dir, str(model_dir))
                Path(local_dir).mkdir(parents=True, exist_ok=True)
                (Path(local_dir) / "model.safetensors").write_bytes(b"demo")

            preparer = HuggingFaceModelPreparer()
            with (
                patch(
                    "knowledge_base.infrastructure.model_preparer.snapshot_download",
                    side_effect=_fake_download,
                ),
                patch(
                    "knowledge_base.infrastructure.model_preparer.get_provider_config",
                    return_value=type(
                        "_Cfg",
                        (),
                        {
                            "model_local_path": str(model_dir),
                            "model_repo_id": "BAAI/bge-base-en-v1.5",
                        },
                    )(),
                ),
            ):
                resolved = preparer.ensure_ready("en")

        self.assertEqual(resolved, model_dir)
        self.assertEqual(calls, ["BAAI/bge-base-en-v1.5"])

    def test_model_preparer_raises_when_download_does_not_materialize_weight_file(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            model_dir = Path(tmp_dir) / "missing-model"
            preparer = HuggingFaceModelPreparer()
            with (
                patch(
                    "knowledge_base.infrastructure.model_preparer.snapshot_download",
                    return_value=None,
                ),
                patch(
                    "knowledge_base.infrastructure.model_preparer.get_provider_config",
                    return_value=type(
                        "_Cfg",
                        (),
                        {
                            "model_local_path": str(model_dir),
                            "model_repo_id": "BAAI/bge-base-en-v1.5",
                        },
                    )(),
                ),
            ):
                with self.assertRaisesRegex(RuntimeError, "模型下载完成后仍缺少权重文件"):
                    preparer.ensure_ready("en")


if __name__ == "__main__":
    unittest.main()
