# 该文件职责：验证文档预处理层的音频转录与处理器注册行为。

from __future__ import annotations

import json
import os
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

from kb_server.infrastructure.document.preprocess import (
    AggregateSubtitleProvider,
    AudioSourceProcessor,
    AudioDownloadProvider,
    BilibiliSubtitleProvider,
    FunASRProvider,
    SubtitleProvider,
    SubtitleResult,
    SourceDescriptor,
    Transcript,
    TranscriptSegment,
    UrlSourceProcessor,
    YtDlpAudioDownloadProvider,
    build_default_source_processor_registry,
    build_local_file_processor_registry,
)


class _FakeASRProvider:
    def transcribe(self, audio_path: Path) -> Transcript:
        return Transcript(
            text="第一段内容\n第二段内容",
            language="zh",
            duration_seconds=12.5,
            provider="fake-asr",
            segments=(
                TranscriptSegment(start_seconds=0, end_seconds=5, text="第一段内容"),
                TranscriptSegment(start_seconds=5, end_seconds=12.5, text="第二段内容"),
            ),
        )


class _FakeSubtitleProvider(SubtitleProvider):
    def __init__(self, result: SubtitleResult | None) -> None:
        self._result = result

    def extract(self, url: str) -> SubtitleResult | None:
        return self._result


class _FakeRaiseSubtitleProvider(SubtitleProvider):
    def extract(self, url: str) -> SubtitleResult | None:
        raise RuntimeError(f"subtitle extract failed: {url}")


class _FakeAudioDownloadProvider(AudioDownloadProvider):
    def __init__(self) -> None:
        self.calls: list[tuple[str, str | None]] = []

    def download(self, url: str, *, suffix: str | None = None) -> Path:
        self.calls.append((url, suffix))
        return Path("/tmp/url-audio.mp3")


class DocumentPreprocessTests(unittest.TestCase):
    # 测试内容：音频处理器会调用 ASR，并直接返回完整文本与 metadata。
    def test_audio_source_processor_returns_text_content(self) -> None:
        processor = AudioSourceProcessor(asr_provider=_FakeASRProvider())
        source = SourceDescriptor(
            source="a/b/demo.wav",
            local_path=Path("/tmp/demo.wav"),
            file_type="wav",
            payload_type="doc",
        )

        result = processor.process(source)

        self.assertEqual(result.source_kind, "audio")
        self.assertIsNone(result.pdf_path)
        self.assertEqual(
            result.text_content,
            "[00:00:00-00:00:05] 第一段内容\n[00:00:05-00:00:12] 第二段内容",
        )
        self.assertEqual(result.text_source_type, "audio_asr")
        self.assertEqual(result.metadata["sourceType"], "audio")
        self.assertEqual(result.metadata["transcriptLanguage"], "zh")
        self.assertEqual(result.metadata["audioDurationSeconds"], 12.5)
        self.assertEqual(result.metadata["asrProvider"], "fake-asr")

    # 测试内容：FunASR provider 会解析 generate 结果并转换为 Transcript。
    def test_funasr_provider_parses_generate_result(self) -> None:
        provider = FunASRProvider(
            model="paraformer-zh",
            vad_model="fsmn-vad",
            punc_model="ct-punc",
            device="cpu",
            hub="ms",
            ncpu=2,
            batch_size_s=120,
            batch_size_threshold_s=30,
            sentence_timestamp=True,
        )

        class _FakeFunASRModel:
            def __init__(self) -> None:
                self.calls: list[dict[str, object]] = []

            def generate(self, **kwargs: object) -> list[dict[str, object]]:
                self.calls.append(kwargs)
                return [
                    {
                        "text": "hello",
                        "language": "en",
                        "durationSeconds": 3.2,
                        "provider": "funasr-test",
                        "sentence_info": [{"start": 830, "end": 1850, "text": "hello"}],
                    }
                ]

        fake_model = _FakeFunASRModel()
        with patch.object(provider, "_build_model", return_value=fake_model):
            transcript = provider.transcribe(Path("/tmp/demo.wav"))

        self.assertEqual(transcript.text, "hello")
        self.assertEqual(transcript.language, "en")
        self.assertEqual(transcript.duration_seconds, 3.2)
        self.assertEqual(transcript.provider, "funasr-test")
        self.assertEqual(len(transcript.segments), 1)
        self.assertEqual(transcript.segments[0].text, "hello")
        self.assertEqual(transcript.segments[0].start_seconds, 0.83)
        self.assertEqual(transcript.segments[0].end_seconds, 1.85)
        self.assertEqual(fake_model.calls[0]["input"], "/tmp/demo.wav")
        self.assertEqual(fake_model.calls[0]["batch_size_s"], 120)
        self.assertEqual(fake_model.calls[0]["batch_size_threshold_s"], 30)
        self.assertTrue(fake_model.calls[0]["sentence_timestamp"])

    # 测试内容：默认注册表已接入音频处理器，wav 后缀会命中音频策略。
    def test_default_registry_supports_audio_sources(self) -> None:
        registry = build_default_source_processor_registry()
        processor = registry.get_processor(
            SourceDescriptor(
                source="a/b/demo.wav",
                source_type="objectKey",
                file_type="wav",
                payload_type="doc",
            )
        )

        self.assertEqual(processor.__class__.__name__, "FetchedSourceProcessor")

    # 测试内容：URL 处理器提取到字幕时，直接返回文本，不触发音频下载。
    def test_url_source_processor_prefers_subtitle(self) -> None:
        downloader = _FakeAudioDownloadProvider()
        processor = UrlSourceProcessor(
            subtitle_provider=_FakeSubtitleProvider(
                SubtitleResult(
                    text="[00:00:01-00:00:03] hello",
                    language="en",
                    provider="fake-subtitle",
                    format="json",
                )
            ),
            audio_download_provider=downloader,
            audio_processor=AudioSourceProcessor(asr_provider=_FakeASRProvider()),
        )

        result = processor.process(
            SourceDescriptor(source="https://www.bilibili.com/video/BV1demo", source_type="url", doc_id="doc-1")
        )

        self.assertEqual(result.text_content, "[00:00:01-00:00:03] hello")
        self.assertEqual(result.text_source_type, "subtitle")
        self.assertEqual(result.metadata["sourceType"], "url")
        self.assertEqual(result.metadata["subtitleProvider"], "fake-subtitle")
        self.assertEqual(result.metadata["urlProcessingStrategy"], "subtitle")
        self.assertEqual(downloader.calls, [])

    # 测试内容：URL 提取不到字幕时，会回退下载音频并复用 AudioSourceProcessor。
    def test_url_source_processor_falls_back_to_audio_asr(self) -> None:
        downloader = _FakeAudioDownloadProvider()
        processor = UrlSourceProcessor(
            subtitle_provider=_FakeSubtitleProvider(None),
            audio_download_provider=downloader,
            audio_processor=AudioSourceProcessor(asr_provider=_FakeASRProvider()),
        )

        result = processor.process(
            SourceDescriptor(
                source="https://www.bilibili.com/video/BV1demo",
                source_type="url",
                file_type="mp3",
                doc_id="doc-2",
            )
        )

        self.assertEqual(result.text_source_type, "audio_asr")
        self.assertEqual(result.metadata["sourceType"], "url")
        self.assertEqual(result.metadata["urlProcessingStrategy"], "audio_asr")
        self.assertEqual(result.cleanup_dirs, (Path("/tmp"),))
        self.assertEqual(downloader.calls, [("https://www.bilibili.com/video/BV1demo", ".mp3")])

    # 测试内容：URL 字幕提取抛异常时，会继续回退下载音频并复用 AudioSourceProcessor。
    def test_url_source_processor_falls_back_to_audio_asr_when_subtitle_extract_raises(self) -> None:
        downloader = _FakeAudioDownloadProvider()
        processor = UrlSourceProcessor(
            subtitle_provider=_FakeRaiseSubtitleProvider(),
            audio_download_provider=downloader,
            audio_processor=AudioSourceProcessor(asr_provider=_FakeASRProvider()),
        )

        result = processor.process(
            SourceDescriptor(
                source="https://www.bilibili.com/video/BV1demo",
                source_type="url",
                file_type="mp3",
                doc_id="doc-2",
            )
        )

        self.assertEqual(result.text_source_type, "audio_asr")
        self.assertEqual(result.metadata["sourceType"], "url")
        self.assertEqual(result.metadata["urlProcessingStrategy"], "audio_asr")
        self.assertEqual(result.cleanup_dirs, (Path("/tmp"),))
        self.assertEqual(downloader.calls, [("https://www.bilibili.com/video/BV1demo", ".mp3")])

    # 测试内容：URL 来源中的占位 file_type 不应被当作音频格式传给 yt_dlp。
    def test_url_source_processor_ignores_placeholder_file_type_for_audio_download(self) -> None:
        downloader = _FakeAudioDownloadProvider()
        processor = UrlSourceProcessor(
            subtitle_provider=_FakeSubtitleProvider(None),
            audio_download_provider=downloader,
            audio_processor=AudioSourceProcessor(asr_provider=_FakeASRProvider()),
        )

        processor.process(
            SourceDescriptor(
                source="https://www.bilibili.com/video/BV1demo",
                source_type="url",
                file_type="url",
                doc_id="doc-3",
            )
        )

        self.assertEqual(downloader.calls, [("https://www.bilibili.com/video/BV1demo", None)])

    # 测试内容：非受支持媒体链接会在 URL 处理器入口被直接拒绝。
    def test_url_source_processor_rejects_unsupported_media_url(self) -> None:
        downloader = _FakeAudioDownloadProvider()
        processor = UrlSourceProcessor(
            subtitle_provider=_FakeSubtitleProvider(None),
            audio_download_provider=downloader,
            audio_processor=AudioSourceProcessor(asr_provider=_FakeASRProvider()),
        )

        with self.assertRaisesRegex(ValueError, "仅支持 https://www.bilibili.com/video 开头的链接"):
            processor.process(
                SourceDescriptor(source="https://example.com/v", source_type="url", file_type="url", doc_id="doc-4")
            )

        self.assertEqual(downloader.calls, [])

    # 测试内容：默认注册表会优先将 URL 来源分配给 URL 处理器。
    def test_default_registry_supports_url_sources(self) -> None:
        registry = build_default_source_processor_registry()
        processor = registry.get_processor(SourceDescriptor(source="https://example.com/v", source_type="url"))
        self.assertIsInstance(processor, UrlSourceProcessor)

    # 测试内容：本地文件处理器注册表只负责处理已落地文件，不包含 URL 处理器。
    def test_local_file_registry_excludes_url_processor(self) -> None:
        registry = build_local_file_processor_registry()
        processor = registry.get_processor(
            SourceDescriptor(source="a/b/demo.wav", local_path=Path("/tmp/demo.wav"), source_type="objectKey")
        )
        self.assertIsInstance(processor, AudioSourceProcessor)

    # 测试内容：聚合 provider 会在前一个 provider 返回空时继续尝试后续 provider。
    def test_aggregate_subtitle_provider_tries_next_provider(self) -> None:
        provider = AggregateSubtitleProvider(
            providers=[
                _FakeSubtitleProvider(None),
                _FakeSubtitleProvider(SubtitleResult(text="subtitle", provider="second")),
            ]
        )

        result = provider.extract("https://example.com/v")

        self.assertIsNotNone(result)
        self.assertEqual(result.provider, "second")

    # 测试内容：字幕 JSON body 会按音频转录相同的时间戳格式拼接为文本。
    def test_bilibili_subtitle_body_uses_audio_style_timestamp_lines(self) -> None:
        provider = BilibiliSubtitleProvider()
        fake_session = MagicMock()
        extracted_tracks = [
            {
                "lang": "zh-Hans",
                "lang_doc": "中文（简体）",
                "subtitle_url": "https://example.com/subtitle.json",
                "body": [
                    {"from": 0.4, "to": 2.2, "content": "第一句"},
                    {"from": 2.6, "to": 5.1, "content": "第二句"},
                ],
            }
        ]

        with (
            patch.object(BilibiliSubtitleProvider, "_build_session", return_value=fake_session),
            patch.object(
                BilibiliSubtitleProvider,
                "_get_initial_state",
                return_value=(
                    {"user": {"isLogin": True}},
                    "BV1demo",
                    12345,
                    "https://www.bilibili.com/video/BV1demo",
                ),
            ),
            patch.object(
                BilibiliSubtitleProvider,
                "_get_video_meta",
                return_value=({"aid": 67890, "cid": 12345, "pages": []}, 67890, 12345, []),
            ),
            patch.object(
                BilibiliSubtitleProvider,
                "_extract_subtitles",
                return_value=([], extracted_tracks, {}),
            ),
        ):
            result = provider.extract("https://www.bilibili.com/video/BV1demo")

        self.assertIsNotNone(result)
        self.assertEqual(result.provider, "bilibili")
        self.assertEqual(result.language, "中文（简体）")
        self.assertEqual(result.format, "json")
        self.assertEqual(result.text, "[00:00:00-00:00:02] 第一句\n[00:00:03-00:00:05] 第二句")

    # 测试内容：Bilibili 字幕 provider 会根据分P参数选择对应页面的 cid。
    def test_bilibili_subtitle_provider_uses_page_number_to_pick_cid(self) -> None:
        selected_cids: list[int] = []

        def _fake_extract_subtitles(
            session: object,
            aid: int,
            cid: int,
        ) -> tuple[list[dict[str, object]], list[dict[str, object]], dict[str, object]]:
            selected_cids.append(cid)
            return (
                [],
                [
                    {
                        "lang": "zh-Hans",
                        "lang_doc": "中文（简体）",
                        "subtitle_url": "https://example.com/subtitle.json",
                        "body": [{"from": 0, "to": 1, "content": "第二P字幕"}],
                    }
                ],
                {},
            )

        with (
            patch.object(BilibiliSubtitleProvider, "_build_session", return_value=MagicMock()),
            patch.object(
                BilibiliSubtitleProvider,
                "_get_initial_state",
                return_value=(
                    {"user": {"isLogin": True}},
                    "BV1demo",
                    12345,
                    "https://www.bilibili.com/video/BV1demo?p=2",
                ),
            ),
            patch.object(
                BilibiliSubtitleProvider,
                "_get_video_meta",
                return_value=(
                    {"aid": 67890, "cid": 12345, "pages": [{"cid": 12345}, {"cid": 54321}]},
                    67890,
                    12345,
                    [{"cid": 12345}, {"cid": 54321}],
                ),
            ),
            patch.object(BilibiliSubtitleProvider, "_extract_subtitles", side_effect=_fake_extract_subtitles),
        ):
            result = BilibiliSubtitleProvider().extract("https://www.bilibili.com/video/BV1demo?p=2")

        self.assertIsNotNone(result)
        self.assertEqual(selected_cids, [54321])
        self.assertEqual(result.text, "[00:00:00-00:00:01] 第二P字幕")

    # 测试内容：Bilibili session 会从环境变量注入 Cookie。
    def test_bilibili_subtitle_provider_builds_session_from_cookie_env(self) -> None:
        with patch.dict(
            "os.environ",
            {"KB_BILIBILI_COOKIE": "SESSDATA=demo_session; bili_jct=demo_csrf; DedeUserID=12345"},
            clear=False,
        ):
            session = BilibiliSubtitleProvider._build_session()

        self.assertEqual(session.cookies.get("SESSDATA", domain=".bilibili.com", path="/"), "demo_session")
        self.assertEqual(session.cookies.get("bili_jct", domain=".bilibili.com", path="/"), "demo_csrf")
        self.assertEqual(session.cookies.get("DedeUserID", domain=".bilibili.com", path="/"), "12345")
        self.assertEqual(session.headers["Origin"], "https://www.bilibili.com")

    # 测试内容：yt_dlp 音频下载 provider 使用 Python API 下载并返回落地文件。
    def test_yt_dlp_audio_download_provider_uses_python_api(self) -> None:
        provider = YtDlpAudioDownloadProvider(audio_format="mp3")
        captured_options: list[dict[str, object]] = []
        captured_downloads: list[list[str]] = []

        class _FakeYoutubeDL:
            def __init__(self, options: dict[str, object]) -> None:
                captured_options.append(options)

            def __enter__(self) -> "_FakeYoutubeDL":
                return self

            def __exit__(self, exc_type, exc, tb) -> None:
                return None

            def download(self, urls: list[str]) -> int:
                captured_downloads.append(urls)
                output_dir = Path(captured_options[0]["outtmpl"]).parent
                (output_dir / "audio.mp3").write_bytes(b"demo")
                return 0

        fake_module = type("FakeModule", (), {"YoutubeDL": _FakeYoutubeDL})()
        with (
            patch("kb_server.infrastructure.document.preprocess.source_fetcher._load_yt_dlp", return_value=fake_module),
            patch("kb_server.infrastructure.document.preprocess.source_fetcher.shutil.which", return_value="/usr/bin/ffmpeg"),
        ):
            audio_path = provider.download("https://example.com/video", suffix=".wav")

        self.assertTrue(audio_path.exists())
        self.assertEqual(audio_path.name, "audio.mp3")
        self.assertEqual(captured_downloads, [["https://example.com/video"]])
        self.assertEqual(captured_options[0]["format"], "bestaudio/best")
        self.assertEqual(captured_options[0]["postprocessors"][0]["key"], "FFmpegExtractAudio")
        self.assertEqual(captured_options[0]["postprocessors"][0]["preferredcodec"], "wav")
        self.assertEqual(captured_options[0]["http_headers"]["Referer"], "https://example.com/video")
        self.assertEqual(captured_options[0]["http_headers"]["Origin"], "https://www.bilibili.com")
        self.assertIn("User-Agent", captured_options[0]["http_headers"])

    # 测试内容：B 站 cookie 环境变量会透传到 yt_dlp 请求头，供真实下载复用登录态。
    def test_yt_dlp_audio_download_provider_passes_bilibili_cookie_header(self) -> None:
        provider = YtDlpAudioDownloadProvider(audio_format="mp3")
        captured_options: list[dict[str, object]] = []

        class _FakeYoutubeDL:
            def __init__(self, options: dict[str, object]) -> None:
                captured_options.append(options)

            def __enter__(self) -> "_FakeYoutubeDL":
                return self

            def __exit__(self, exc_type, exc, tb) -> None:
                return None

            def download(self, urls: list[str]) -> int:
                output_dir = Path(captured_options[0]["outtmpl"]).parent
                (output_dir / "audio.mp3").write_bytes(b"demo")
                return 0

        fake_module = type("FakeModule", (), {"YoutubeDL": _FakeYoutubeDL})()
        with (
            patch.dict(os.environ, {"KB_BILIBILI_COOKIE": "SESSDATA=demo_session; bili_jct=demo_csrf"}, clear=False),
            patch("kb_server.infrastructure.document.preprocess.source_fetcher._load_yt_dlp", return_value=fake_module),
            patch("kb_server.infrastructure.document.preprocess.source_fetcher.shutil.which", return_value="/usr/bin/ffmpeg"),
        ):
            provider.download("https://www.bilibili.com/video/BV1demo", suffix=".mp3")

        self.assertEqual(
            captured_options[0]["http_headers"]["Cookie"],
            "SESSDATA=demo_session; bili_jct=demo_csrf",
        )
        self.assertEqual(
            captured_options[0]["http_headers"]["Referer"],
            "https://www.bilibili.com/video/BV1demo",
        )


class _FakeResponse:
    def __init__(self, text: str, *, url: str) -> None:
        self.text = text
        self.url = url

    def raise_for_status(self) -> None:
        return None


class _FakeJsonResponse(_FakeResponse):
    def __init__(self, payload: dict[str, object], *, url: str = "https://api.bilibili.com/demo") -> None:
        super().__init__(json.dumps(payload, ensure_ascii=False), url=url)
        self._payload = payload

    def json(self) -> dict[str, object]:
        return self._payload


if __name__ == "__main__":
    unittest.main()
