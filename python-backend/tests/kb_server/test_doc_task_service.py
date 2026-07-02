# 该文件职责：验证文档任务应用服务在无外部依赖下的编排行为。

from __future__ import annotations

import unittest
from pathlib import Path
from unittest.mock import patch

from kb_server.application.doc_task_service import DocTaskDependencies, DocTaskService
from kb_server.infrastructure.document.preprocess.base import (
    PreprocessResult,
    SourceDescriptor,
)


class _FakeDeps:
    def __init__(self, ext: str = ".pdf") -> None:
        self.ext = ext
        self.upload_calls = 0
        self.convert_calls = 0
        self.preprocess_calls = 0
        self.store_calls = 0
        self.store_text_calls = 0
        self.last_store_path: str | None = None
        self.last_text: str | None = None
        self.last_text_source_type: str | None = None
        self.updated_total_page: list[tuple[str, int]] = []
        self.updated_metadata: list[tuple[str, dict[str, object]]] = []
        self.last_mq_metadata: dict | None = None
        self.last_source_descriptor: SourceDescriptor | None = None
        self.last_upload_target: str | None = None
        self.doc_metadata: dict[str, dict[str, object]] = {}
        self.clear_doc_content_calls: list[int] = []
        self.clear_uploaded_images_calls: list[str] = []
        self.fail_upload_once = False

    def close(self) -> None:
        return None

    def as_dependencies(self) -> DocTaskDependencies:
        return DocTaskDependencies(
            lookup_kb_doc_id=self.lookup_kb_doc_id,
            preprocess_source=self.preprocess_source,
            store_pdf=self.store_pdf,
            store_text=self.store_text,
            update_total_page=self.update_total_page,
            render_pdf_pages_to_images=self.render_pdf_pages_to_images,
            upload_images=self.upload_images,
            load_doc_metadata=self.load_doc_metadata,
            clear_doc_content=self.clear_doc_content,
            clear_uploaded_images=self.clear_uploaded_images,
            update_doc_metadata=self.update_doc_metadata,
        )

    def lookup_kb_doc_id(self, doc_id: str) -> int:
        return 100

    def preprocess_source(self, source: SourceDescriptor) -> PreprocessResult:
        self.preprocess_calls += 1
        self.last_source_descriptor = source
        if source.source_type == "text":
            return PreprocessResult(
                source_kind="text",
                text_content=source.source,
                text_source_type="text",
                metadata={"sourceType": "text"},
            )
        if self.ext == ".pdf":
            return PreprocessResult(source_kind="pdf", pdf_path=Path(f"X:/fake/doc{self.ext}"))
        if self.ext == ".wav":
            return PreprocessResult(
                source_kind="audio",
                text_content="hello world from transcript",
                text_source_type="audio_asr",
                metadata={"sourceType": "audio", "transcriptLanguage": "en"},
            )
        if self.ext not in {".md", ".txt", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx"}:
            raise ValueError(f"unsupported source type: suffix={self.ext}")
        self.convert_calls += 1
        return PreprocessResult(source_kind="office", pdf_path=Path("X:/fake/converted.pdf"))

    def store_pdf(self, file_path: str, kb_doc_id: int) -> int:
        self.store_calls += 1
        self.last_store_path = file_path
        return 7

    def store_text(self, text: str, kb_doc_id: int, source_type: str) -> int:
        self.store_text_calls += 1
        self.last_text = text
        self.last_text_source_type = source_type
        return 2

    def update_total_page(self, doc_id: str, total_page: int) -> None:
        self.updated_total_page.append((doc_id, total_page))
        self.doc_metadata.setdefault(doc_id, {})["total_page"] = total_page

    def update_doc_metadata(self, doc_id: str, metadata: dict[str, object]) -> None:
        self.updated_metadata.append((doc_id, metadata))
        current = self.doc_metadata.setdefault(doc_id, {})
        current.update(metadata)

    def load_doc_metadata(self, doc_id: str) -> dict[str, object]:
        return dict(self.doc_metadata.get(doc_id, {}))

    def clear_doc_content(self, kb_doc_id: int) -> None:
        self.clear_doc_content_calls.append(kb_doc_id)

    def clear_uploaded_images(self, object_key: str) -> None:
        self.clear_uploaded_images_calls.append(object_key)

    def render_pdf_pages_to_images(self, pdf_path: Path, out_dir: Path) -> list[Path]:
        return [Path("X:/fake/1.jpg")]

    def upload_images(self, image_paths: list[Path], object_key: str) -> None:
        if self.fail_upload_once:
            self.fail_upload_once = False
            raise RuntimeError("upload failed")
        self.upload_calls += 1
        self.last_upload_target = object_key

class DocTaskServiceTests(unittest.TestCase):
    # 测试内容：非法 JSON 输入会被识别并抛出统一的 ValueError。
    def test_parse_payload_invalid_json(self) -> None:
        service = DocTaskService(_FakeDeps().as_dependencies())
        with self.assertRaisesRegex(ValueError, "invalid json payload"):
            service.parse_payload(b"not-json")

    # 测试内容：command payload 直接挂在 payload 顶层，不再包裹 metadata。
    def test_parse_payload_extracts_direct_payload(self) -> None:
        service = DocTaskService(_FakeDeps().as_dependencies())

        payload = service.parse_payload(
            (
                b'{"messageId":"m-1","projectId":"p1","kbId":"kb-1","taskRecordId":11,'
                b'"taskType":"doc","stageRunKey":"doc:main","payload":{"typeId":"doc_1",'
                b'"sourceType":"objectKey","source":"a/b/source.pdf","name":"demo","fileType":"pdf"}}'
            )
        )

        self.assertEqual(payload["taskRecordId"], 11)
        self.assertEqual(payload["stageRunKey"], "doc:main")
        self.assertEqual(payload["typeId"], "doc_1")
        self.assertEqual(payload["sourceType"], "objectKey")
        self.assertEqual(payload["source"], "a/b/source.pdf")
        self.assertEqual(
            payload["payload"],
            {"typeId": "doc_1", "sourceType": "objectKey", "source": "a/b/source.pdf", "name": "demo", "fileType": "pdf"},
        )

    # 测试内容：旧消息仅带 objectKey 时，服务仍兼容为 objectKey 来源。
    def test_parse_payload_falls_back_to_legacy_object_key(self) -> None:
        service = DocTaskService(_FakeDeps().as_dependencies())

        payload = service.parse_payload(
            b'{"projectId":"p1","kbId":"kb-1","taskRecordId":11,"taskType":"doc","payload":{"typeId":"doc_1","objectKey":"a/b/source.pdf"}}'
        )

        self.assertEqual(payload["sourceType"], "objectKey")
        self.assertEqual(payload["source"], "a/b/source.pdf")

    # 测试内容：PDF 文档处理成功路径（不转换、入库、渲染上传、成功通知）。
    def test_handle_task_payload_success_pdf(self) -> None:
        fake = _FakeDeps(ext=".pdf")
        try:
            service = DocTaskService(fake.as_dependencies())
            image_dir = Path("X:/fake/images_tmp")
            payload = {
                "taskType": "doc",
                "typeId": "doc_1",
                "taskRecordId": 11,
                "projectId": "p1",
                "kbId": "kb-1",
                "payload": {"sourceType": "objectKey", "source": "a/b/source.pdf", "name": "demo"},
                "userId": 9,
            }

            with patch("kb_server.application.doc_task_service.tempfile.mkdtemp", return_value=str(image_dir)):
                completion = service.handle_task_payload(payload)

            self.assertEqual(fake.preprocess_calls, 1)
            self.assertEqual(fake.convert_calls, 0)
            self.assertEqual(fake.store_calls, 1)
            self.assertEqual(fake.store_text_calls, 0)
            self.assertEqual(fake.upload_calls, 1)
            self.assertEqual(fake.clear_doc_content_calls, [100])
            self.assertEqual(fake.clear_uploaded_images_calls, ["a/b/source.pdf"])
            self.assertEqual(fake.updated_total_page, [("doc_1", 7)])
            self.assertEqual(
                fake.doc_metadata["doc_1"]["processingState"]["finalize"],
                {
                    "state": "pending",
                    "messageId": completion.completion_message_id,
                    "sourceFingerprint": "objectKey:a/b/source.pdf",
                    "taskRecordId": 11,
                    "stageRunKey": None,
                },
            )
            self.assertIsNotNone(completion.completion_message_id)
            self.assertEqual(completion.task_record_id, 11)
            self.assertEqual(completion.project_id, "p1")
            self.assertEqual(completion.kb_id, "kb-1")
            self.assertEqual(completion.user_id, 9)
            self.assertEqual(fake.last_source_descriptor.source, "a/b/source.pdf")
            self.assertEqual(fake.last_source_descriptor.source_type, "objectKey")
            self.assertEqual(fake.last_source_descriptor.doc_id, "doc_1")
            self.assertEqual(fake.last_source_descriptor.source, "a/b/source.pdf")
            self.assertEqual(fake.last_upload_target, "a/b/source.pdf")
            self.assertEqual(completion.result["sourceType"], "objectKey")
        finally:
            fake.close()

    # 测试内容：Markdown/TXT 文档会先转 PDF，再统一执行入库与图片渲染上传。
    def test_handle_task_payload_text_file_converts_before_store(self) -> None:
        fake = _FakeDeps(ext=".md")
        try:
            service = DocTaskService(fake.as_dependencies())
            image_dir = Path("X:/fake/images_tmp")
            payload = {
                "taskType": "doc",
                "typeId": "doc_md",
                "taskRecordId": 13,
                "projectId": "p3",
                "kbId": "kb-1",
                "payload": {"sourceType": "objectKey", "source": "a/b/source.md", "name": "doc-md", "kbId": "kb-1"},
                "userId": 21,
            }

            with patch("kb_server.application.doc_task_service.tempfile.mkdtemp", return_value=str(image_dir)):
                completion = service.handle_task_payload(payload)

            self.assertEqual(fake.preprocess_calls, 1)
            self.assertEqual(fake.convert_calls, 1)
            self.assertEqual(fake.store_calls, 1)
            self.assertEqual(fake.store_text_calls, 0)
            self.assertEqual(fake.last_store_path, "X:/fake/converted.pdf")
            self.assertEqual(fake.upload_calls, 1)
            self.assertEqual((completion.task_record_id, completion.project_id, completion.kb_id, completion.user_id), (13, "p3", "kb-1", 21))
            self.assertEqual(completion.parent_task_record_id, None)
            self.assertEqual(completion.stage_run_key, None)
            self.assertEqual(completion.result["docId"], "doc_md")
            self.assertEqual(completion.result["name"], "doc-md")
            self.assertEqual(fake.last_source_descriptor.file_type, None)
        finally:
            fake.close()

    # 测试内容：非 PDF 且非文本文件会先转换为 PDF，再执行渲染和上传。
    def test_handle_task_payload_non_pdf_converts_before_upload(self) -> None:
        fake = _FakeDeps(ext=".docx")
        try:
            service = DocTaskService(fake.as_dependencies())
            image_dir = Path("X:/fake/images_tmp")
            payload = {
                "taskType": "doc",
                "typeId": "doc_docx",
                "taskRecordId": 14,
                "projectId": "p4",
                "kbId": "kb-1",
                "payload": {"sourceType": "objectKey", "source": "a/b/source.docx", "name": "doc-docx"},
            }

            with patch("kb_server.application.doc_task_service.tempfile.mkdtemp", return_value=str(image_dir)):
                completion = service.handle_task_payload(payload)

            self.assertEqual(fake.preprocess_calls, 1)
            self.assertEqual(fake.convert_calls, 1)
            self.assertEqual(fake.store_calls, 1)
            self.assertEqual(fake.store_text_calls, 0)
            self.assertEqual(fake.upload_calls, 1)
            self.assertEqual(completion.result["docId"], "doc_docx")
            self.assertEqual(fake.last_source_descriptor.source_type, "objectKey")
        finally:
            fake.close()

    # 测试内容：关键字段缺失时抛错，不在服务层直接发送失败通知。
    def test_handle_task_payload_missing_fields_raises(self) -> None:
        fake = _FakeDeps(ext=".pdf")
        try:
            service = DocTaskService(fake.as_dependencies())
            payload = {
                "taskType": "doc",
                "typeId": "",
                "taskRecordId": 12,
                "projectId": "p2",
                "kbId": "kb-1",
                "payload": {"sourceType": "objectKey", "source": ""},
            }

            with self.assertRaisesRegex(ValueError, "payload missing doc_id/source"):
                service.handle_task_payload(payload)

            self.assertNotIn("processingState", fake.doc_metadata.get("doc_1", {}))
        finally:
            fake.close()

    # 测试内容：userId 非法时中断处理，不在服务层直接发送失败通知。
    def test_handle_task_payload_invalid_user_id_raises(self) -> None:
        fake = _FakeDeps(ext=".pdf")
        try:
            service = DocTaskService(fake.as_dependencies())
            payload = {
                "taskType": "doc",
                "typeId": "doc_bad_user",
                "taskRecordId": 15,
                "projectId": "p5",
                "kbId": "kb-1",
                "payload": {"sourceType": "objectKey", "source": "a/b/source.pdf"},
                "userId": "oops",
            }

            with self.assertRaisesRegex(ValueError, "payload userId invalid"):
                service.handle_task_payload(payload)

            self.assertNotIn("processingState", fake.doc_metadata.get("doc_bad_user", {}))
        finally:
            fake.close()

    # 测试内容：未知类型由统一预处理入口显式失败，不在应用服务层兜底吞错。
    def test_handle_task_payload_unsupported_source_raises(self) -> None:
        fake = _FakeDeps(ext=".bin")
        try:
            service = DocTaskService(fake.as_dependencies())
            payload = {
                "taskType": "doc",
                "typeId": "doc_audio",
                "taskRecordId": 16,
                "projectId": "p6",
                "kbId": "kb-1",
                "payload": {"sourceType": "objectKey", "source": "a/b/source.wav", "name": "doc-audio", "fileType": "wav"},
            }

            with self.assertRaisesRegex(ValueError, "unsupported source type"):
                service.handle_task_payload(payload)

            self.assertEqual(fake.preprocess_calls, 1)
            self.assertEqual(fake.store_calls, 0)
            self.assertEqual(fake.store_text_calls, 0)
            self.assertEqual(fake.upload_calls, 0)
        finally:
            fake.close()

    # 测试内容：音频预处理返回文本页时，服务改走文本页入库并更新 metadata，不再渲染 PDF 图片。
    def test_handle_task_payload_audio_uses_text_page_store(self) -> None:
        fake = _FakeDeps(ext=".wav")
        try:
            service = DocTaskService(fake.as_dependencies())
            payload = {
                "taskType": "doc",
                "typeId": "doc_audio",
                "taskRecordId": 17,
                "projectId": "p7",
                "kbId": "kb-1",
                "payload": {"sourceType": "objectKey", "source": "a/b/source.wav", "name": "doc-audio", "fileType": "wav"},
            }

            completion = service.handle_task_payload(payload)

            self.assertEqual(fake.store_calls, 0)
            self.assertEqual(fake.store_text_calls, 1)
            self.assertEqual(fake.upload_calls, 0)
            self.assertEqual(fake.updated_total_page, [("doc_audio", 2)])
            self.assertIn(("doc_audio", {"sourceType": "audio", "transcriptLanguage": "en"}), fake.updated_metadata)
            self.assertEqual(fake.last_text, "hello world from transcript")
            self.assertEqual(fake.last_text_source_type, "audio_asr")
            self.assertEqual(completion.result["sourceType"], "objectKey")
        finally:
            fake.close()

    # 测试内容：URL 来源会使用 url 下载分支，并将完成结果与上传目标切到 docId 前缀。
    def test_handle_task_payload_url_source_uses_doc_id_upload_target(self) -> None:
        fake = _FakeDeps(ext=".pdf")
        try:
            service = DocTaskService(fake.as_dependencies())
            image_dir = Path("X:/fake/images_tmp")
            payload = {
                "taskType": "doc",
                "typeId": "doc_url",
                "taskRecordId": 18,
                "projectId": "p8",
                "kbId": "kb-1",
                "payload": {
                    "sourceType": "url",
                    "source": "https://example.com/source.pdf",
                    "name": "doc-url",
                    "fileType": "pdf",
                },
            }

            with patch("kb_server.application.doc_task_service.tempfile.mkdtemp", return_value=str(image_dir)):
                completion = service.handle_task_payload(payload)

            self.assertEqual(fake.last_source_descriptor.source, "https://example.com/source.pdf")
            self.assertEqual(fake.last_source_descriptor.source_type, "url")
            self.assertEqual(fake.last_upload_target, "kb-doc/doc_url/source")
            self.assertEqual(completion.result["sourceType"], "url")
            self.assertEqual(completion.result["source"], "https://example.com/source.pdf")
            self.assertNotIn("objectKey", completion.result)
        finally:
            fake.close()

    # 测试内容：纯文本来源会直接走文本入库，不再把完整 source 回写到完成事件。
    def test_handle_task_payload_text_source_uses_text_store(self) -> None:
        fake = _FakeDeps(ext=".pdf")
        try:
            service = DocTaskService(fake.as_dependencies())
            payload = {
                "taskType": "doc",
                "typeId": "doc_text",
                "taskRecordId": 19,
                "projectId": "p9",
                "kbId": "kb-1",
                "payload": {
                    "sourceType": "text",
                    "source": "这是一段直接导入的文本",
                    "name": "这是一段...",
                    "fileType": "txt",
                },
            }

            completion = service.handle_task_payload(payload)

            self.assertEqual(fake.last_source_descriptor.source_type, "text")
            self.assertEqual(fake.store_calls, 0)
            self.assertEqual(fake.store_text_calls, 1)
            self.assertEqual(fake.upload_calls, 0)
            self.assertIn(("doc_text", {"sourceType": "text"}), fake.updated_metadata)
            self.assertEqual(fake.last_text, "这是一段直接导入的文本")
            self.assertNotIn("source", completion.result)
            self.assertEqual(completion.result["sourceType"], "text")
        finally:
            fake.close()

    # 测试内容：图片上传失败后重试应清理旧产物、跳过重复入库，并只补上传与完成通知。
    def test_handle_task_payload_retry_after_upload_failure_reuses_content_store(self) -> None:
        fake = _FakeDeps(ext=".pdf")
        fake.fail_upload_once = True
        try:
            service = DocTaskService(fake.as_dependencies())
            image_dir = Path("X:/fake/images_tmp")
            payload = {
                "taskType": "doc",
                "typeId": "doc_retry",
                "taskRecordId": 20,
                "projectId": "p10",
                "kbId": "kb-1",
                "payload": {"sourceType": "objectKey", "source": "a/b/source.pdf", "name": "retry"},
            }

            with patch("kb_server.application.doc_task_service.tempfile.mkdtemp", return_value=str(image_dir)):
                with self.assertRaisesRegex(RuntimeError, "upload failed"):
                    service.handle_task_payload(payload)
                completion = service.handle_task_payload(payload)

            self.assertEqual(fake.store_calls, 1)
            self.assertEqual(fake.upload_calls, 1)
            self.assertEqual(fake.clear_doc_content_calls, [100])
            self.assertEqual(fake.clear_uploaded_images_calls, ["a/b/source.pdf", "a/b/source.pdf"])
            self.assertEqual(completion.task_record_id, 20)
        finally:
            fake.close()

    # 测试内容：source 变化后应重置 processingState，并清理旧向量与旧图片前缀。
    def test_handle_task_payload_source_changed_should_reset_previous_artifacts(self) -> None:
        fake = _FakeDeps(ext=".pdf")
        fake.doc_metadata["doc_switch"] = {
            "processingState": {
                "version": 1,
                "sourceFingerprint": "objectKey:old/path/source.pdf",
                "contentStore": {"done": True, "totalPage": 5},
                "imageUpload": {"done": True, "target": "old/path/source.pdf"},
                "finalize": {"done": True},
            }
        }
        try:
            service = DocTaskService(fake.as_dependencies())
            image_dir = Path("X:/fake/images_tmp")
            payload = {
                "taskType": "doc",
                "typeId": "doc_switch",
                "taskRecordId": 21,
                "projectId": "p11",
                "kbId": "kb-1",
                "payload": {"sourceType": "objectKey", "source": "new/path/source.pdf", "name": "switch"},
            }

            with patch("kb_server.application.doc_task_service.tempfile.mkdtemp", return_value=str(image_dir)):
                completion = service.handle_task_payload(payload)

            self.assertEqual(fake.clear_doc_content_calls, [100])
            self.assertEqual(fake.clear_uploaded_images_calls, ["old/path/source.pdf", "new/path/source.pdf"])
            self.assertEqual(
                fake.doc_metadata["doc_switch"]["processingState"]["sourceFingerprint"],
                "objectKey:new/path/source.pdf",
            )
            self.assertEqual(completion.doc_id, "doc_switch")
        finally:
            fake.close()

    # 测试内容：finalize 已落 pending 时，重试应复用同一个 messageId 重发完成通知，并最终标记 done。
    def test_handle_task_payload_retry_with_finalize_pending_reuses_same_message_id(self) -> None:
        fake = _FakeDeps(ext=".pdf")
        fake.doc_metadata["doc_finalize_pending"] = {
            "processingState": {
                "version": 1,
                "sourceFingerprint": "objectKey:a/b/source.pdf",
                "preprocess": {"done": True, "sourceKind": "pdf", "sourceType": "objectKey", "sourceFormat": "pdf"},
                "contentStore": {"done": True, "totalPage": 7},
                "imageRender": {"done": True, "pageCount": 1},
                "imageUpload": {"done": True, "target": "a/b/source.pdf"},
                "finalize": {
                    "state": "pending",
                    "messageId": "stable-msg-1",
                    "sourceFingerprint": "objectKey:a/b/source.pdf",
                    "taskRecordId": 22,
                    "stageRunKey": None,
                },
            }
        }
        try:
            service = DocTaskService(fake.as_dependencies())
            payload = {
                "taskType": "doc",
                "typeId": "doc_finalize_pending",
                "taskRecordId": 22,
                "projectId": "p12",
                "kbId": "kb-1",
                "payload": {"sourceType": "objectKey", "source": "a/b/source.pdf", "name": "pending"},
            }

            completion = service.handle_task_payload(payload)

            self.assertEqual(fake.preprocess_calls, 0)
            self.assertEqual(fake.store_calls, 0)
            self.assertEqual(fake.upload_calls, 0)
            self.assertEqual(
                fake.doc_metadata["doc_finalize_pending"]["processingState"]["finalize"],
                {
                    "state": "pending",
                    "messageId": "stable-msg-1",
                    "sourceFingerprint": "objectKey:a/b/source.pdf",
                    "taskRecordId": 22,
                    "stageRunKey": None,
                },
            )
            self.assertEqual(completion.completion_message_id, "stable-msg-1")
        finally:
            fake.close()

    # 测试内容：consumer 原子完成成功后，应单独把 finalize 状态回写为 done。
    def test_mark_completion_persisted_updates_finalize_state(self) -> None:
        fake = _FakeDeps(ext=".pdf")
        fake.doc_metadata["doc_done"] = {
            "processingState": {
                "version": 1,
                "sourceFingerprint": "objectKey:a/b/source.pdf",
                "finalize": {
                    "state": "pending",
                    "messageId": "stable-msg-2",
                    "sourceFingerprint": "objectKey:a/b/source.pdf",
                    "taskRecordId": 23,
                    "stageRunKey": "doc:main",
                },
            }
        }
        try:
            service = DocTaskService(fake.as_dependencies())

            service.mark_completion_persisted(
                doc_id="doc_done",
                completion_message_id="stable-msg-2",
                source_fingerprint="objectKey:a/b/source.pdf",
                task_record_id=23,
                stage_run_key="doc:main",
            )

            self.assertEqual(
                fake.doc_metadata["doc_done"]["processingState"]["finalize"],
                {
                    "state": "done",
                    "messageId": "stable-msg-2",
                    "sourceFingerprint": "objectKey:a/b/source.pdf",
                    "taskRecordId": 23,
                    "stageRunKey": "doc:main",
                },
            )
        finally:
            fake.close()

    # 测试内容：旧轮次完成回写若已落到新轮次 pending，不得覆盖当前 finalize。
    def test_mark_completion_persisted_does_not_override_newer_finalize_pending(self) -> None:
        fake = _FakeDeps(ext=".pdf")
        fake.doc_metadata["doc_newer_pending"] = {
            "processingState": {
                "version": 1,
                "sourceFingerprint": "objectKey:new/path/source.pdf",
                "finalize": {
                    "state": "pending",
                    "messageId": "stable-msg-new",
                    "sourceFingerprint": "objectKey:new/path/source.pdf",
                    "taskRecordId": 30,
                    "stageRunKey": "doc:new",
                },
            }
        }
        try:
            service = DocTaskService(fake.as_dependencies())

            service.mark_completion_persisted(
                doc_id="doc_newer_pending",
                completion_message_id="stable-msg-old",
                source_fingerprint="objectKey:old/path/source.pdf",
                task_record_id=29,
                stage_run_key="doc:old",
            )

            self.assertEqual(
                fake.doc_metadata["doc_newer_pending"]["processingState"]["finalize"],
                {
                    "state": "pending",
                    "messageId": "stable-msg-new",
                    "sourceFingerprint": "objectKey:new/path/source.pdf",
                    "taskRecordId": 30,
                    "stageRunKey": "doc:new",
                },
            )
        finally:
            fake.close()


if __name__ == "__main__":
    unittest.main()
