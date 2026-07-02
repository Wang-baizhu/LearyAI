# 该文件职责：验证文档预处理链路在真实 URL 站点上的字幕与音频集成行为。

from __future__ import annotations

import os
import shutil
import unittest
from pathlib import Path

from dotenv import load_dotenv

from kb_server.infrastructure.document.preprocess.source_fetcher import YtDlpAudioDownloadProvider
from kb_server.infrastructure.document.preprocess.subtitle import BilibiliSubtitleProvider

VIDEO_URL = (
    "https://www.bilibili.com/video/BV1rRM2z6EW6/"
    "?spm_id_from=333.1387.list.card_archive.click&vd_source=9bae3fd73b80c28a5db6ec6624cdfed4"
)


def _load_integration_env() -> None:
    root = Path(__file__).resolve().parents[2]
    load_dotenv(root / ".env.kb.local", override=False)


_load_integration_env()


@unittest.skipUnless(
    os.getenv("KB_RUN_URL_INTEGRATION_TESTS") == "1",
    "需要显式设置 KB_RUN_URL_INTEGRATION_TESTS=1 才运行 URL 集成测试",
)
class DocumentPreprocessIntegrationTests(unittest.TestCase):
    # 测试内容：Bilibili 字幕 provider 可以使用登录态从真实 B 站链接中拉取字幕文本。
    @unittest.skipUnless(os.getenv("KB_BILIBILI_COOKIE"), "需要配置 KB_BILIBILI_COOKIE 才能执行 B 站字幕集成测试")
    def test_bilibili_subtitle_provider_extracts_bilibili_subtitle(self) -> None:
        result = BilibiliSubtitleProvider().extract(VIDEO_URL)

        self.assertIsNotNone(result)
        self.assertEqual(result.provider, "bilibili")
        self.assertTrue((result.language or "").strip())
        self.assertTrue(result.text.strip())
        self.assertIn("[", result.text)
        self.assertIn("]", result.text)

    # 测试内容：yt_dlp 音频下载 provider 可以从真实 B 站链接下载并转出音频文件。
    @unittest.skipUnless(os.getenv("KB_BILIBILI_COOKIE"), "需要配置 KB_BILIBILI_COOKIE 才能执行 B 站音频集成测试")
    @unittest.skipUnless(shutil.which("ffmpeg"), "需要 ffmpeg 才能执行音频下载集成测试")
    def test_yt_dlp_audio_download_provider_downloads_bilibili_audio(self) -> None:
        audio_path = YtDlpAudioDownloadProvider(audio_format="mp3").download(VIDEO_URL, suffix=".mp3")

        self.assertTrue(audio_path.exists())
        self.assertTrue(audio_path.is_file())
        self.assertEqual(audio_path.suffix, ".mp3")


if __name__ == "__main__":
    unittest.main()
