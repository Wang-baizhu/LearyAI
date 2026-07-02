# 该文件职责：定义文档任务处理的应用服务与可注入依赖，提升可测试性。

from __future__ import annotations

import json
import shutil
import hashlib
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Iterable

if __package__:
    from ..infrastructure.document.preprocess.base import PreprocessResult, SourceDescriptor
else:  # pragma: no cover - fallback for top-level module execution
    from infrastructure.document.preprocess.base import PreprocessResult, SourceDescriptor


@dataclass(frozen=True)
class DocTaskDependencies:
    lookup_kb_doc_id: Callable[[str], int]
    preprocess_source: Callable[[SourceDescriptor], PreprocessResult]
    store_pdf: Callable[[str, int], int]
    store_text: Callable[[str, int, str], int]
    update_total_page: Callable[[str, int], None]
    render_pdf_pages_to_images: Callable[[Path, Path], list[Path]]
    upload_images: Callable[[Iterable[Path], str], None]
    load_doc_metadata: Callable[[str], dict[str, Any]]
    clear_doc_content: Callable[[int], None]
    clear_uploaded_images: Callable[[str], None]
    update_doc_metadata: Callable[[str, dict[str, Any]], None] | None = None


@dataclass(frozen=True)
class DocTaskCompletion:
    doc_id: str
    task_record_id: int
    project_id: str
    kb_id: str
    result: dict[str, Any] | None
    user_id: int | None
    parent_task_record_id: int | None
    stage_run_key: str | None
    completion_message_id: str
    source_fingerprint: str


class DocTaskService:
    _PROCESSING_STATE_KEY = "processingState"

    def __init__(self, deps: DocTaskDependencies) -> None:
        self._deps = deps

    @staticmethod
    def parse_payload(body: bytes) -> dict[str, Any]:
        try:
            raw = json.loads(body.decode("utf-8"))
        except json.JSONDecodeError as exc:
            raise ValueError("invalid json payload") from exc
        if not isinstance(raw, dict):
            raise ValueError("payload invalid")
        payload = raw.get("payload")
        if not isinstance(payload, dict):
            raise ValueError("payload missing")
        command_payload = raw.get("payload")
        if not isinstance(command_payload, dict):
            raise ValueError("payload invalid")
        source_type, source = DocTaskService._resolve_source(command_payload)
        return {
            "messageId": raw.get("messageId"),
            "traceId": raw.get("traceId"),
            "projectId": raw.get("projectId"),
            "kbId": raw.get("kbId"),
            "taskRecordId": raw.get("taskRecordId"),
            "taskType": raw.get("taskType"),
            "parentTaskRecordId": raw.get("parentTaskRecordId"),
            "stageRunKey": raw.get("stageRunKey"),
            "typeId": command_payload.get("typeId"),
            "sourceType": source_type or None,
            "source": source or None,
            "payload": command_payload,
            "userId": raw.get("userId"),
        }

    def handle_task_payload(self, payload: dict[str, Any]) -> DocTaskCompletion:
        cleanup_dirs: list[Path] = []
        try:
            task_type = str(payload.get("taskType") or "").strip()
            doc_id_raw = str(payload.get("typeId") or "").strip()
            command_payload = payload.get("payload") if isinstance(payload.get("payload"), dict) else {}
            source_type, source = self._resolve_source(command_payload)
            user_id = self._parse_user_id(payload)
            kb_id = self._parse_kb_id(payload)
            if task_type != "doc":
                raise ValueError("payload type mismatch")
            if not doc_id_raw or not source:
                raise ValueError("payload missing doc_id/source")

            kb_doc_id = self._deps.lookup_kb_doc_id(doc_id_raw)
            task_record_id = self._parse_task_record_id(payload)
            project_id = self._parse_project_id(payload)
            parent_task_record_id = self._parse_optional_int(payload.get("parentTaskRecordId"))
            stage_run_key = self._normalize_optional_string(payload.get("stageRunKey"))
            result = self._build_result(command_payload, doc_id_raw, source_type, source)
            metadata = self._deps.load_doc_metadata(doc_id_raw)
            processing_state = self._normalize_processing_state(metadata.get(self._PROCESSING_STATE_KEY))
            source_fingerprint = self._build_source_fingerprint(source_type, source)
            processing_state, content_cleared = self._reset_processing_state_if_needed(
                doc_id_raw,
                kb_doc_id,
                processing_state,
                source_fingerprint,
            )
            finalize_state = self._get_recoverable_finalize_pending(
                processing_state,
                task_record_id=task_record_id,
                source_fingerprint=source_fingerprint,
                stage_run_key=stage_run_key,
                requires_image_upload=source_type != "text",
            )
            if finalize_state is not None:
                return DocTaskCompletion(
                    doc_id=doc_id_raw,
                    task_record_id=task_record_id,
                    project_id=project_id,
                    kb_id=kb_id,
                    result=result,
                    user_id=user_id,
                    parent_task_record_id=parent_task_record_id,
                    stage_run_key=stage_run_key,
                    completion_message_id=str(finalize_state["messageId"]),
                    source_fingerprint=source_fingerprint,
                )

            preprocess_result = self._deps.preprocess_source(
                SourceDescriptor(
                    source=source,
                    source_type=source_type,
                    file_type=self._normalize_optional_string(command_payload.get("fileType")),
                    payload_type=self._normalize_optional_string(payload.get("taskType")),
                    doc_id=doc_id_raw,
                )
            )
            pdf_path = preprocess_result.pdf_path
            cleanup_dirs.extend(preprocess_result.cleanup_dirs)
            processing_state["preprocess"] = {
                "done": True,
                "sourceKind": preprocess_result.source_kind,
                "sourceType": source_type,
                "sourceFormat": preprocess_result.metadata.get("sourceFormat"),
            }
            upload_target = self._resolve_upload_target(source, source_type, doc_id_raw)

            if not self._step_done(processing_state, "contentStore"):
                if not content_cleared:
                    self._deps.clear_doc_content(kb_doc_id)
                total_page = self._store_preprocessed_content(preprocess_result, kb_doc_id)
                self._deps.update_total_page(doc_id_raw, total_page)
                if self._deps.update_doc_metadata and preprocess_result.metadata:
                    self._deps.update_doc_metadata(doc_id_raw, preprocess_result.metadata)
                processing_state["contentStore"] = {
                    "done": True,
                    "totalPage": total_page,
                }
                self._persist_processing_state(doc_id_raw, processing_state)

            if pdf_path is not None and not self._step_done(processing_state, "imageUpload"):
                self._deps.clear_uploaded_images(upload_target)
                image_dir = Path(tempfile.mkdtemp(prefix="kb_pdf_images_"))
                cleanup_dirs.append(image_dir)
                images = self._deps.render_pdf_pages_to_images(pdf_path, image_dir)
                processing_state["imageRender"] = {
                    "done": True,
                    "pageCount": len(images),
                }
                self._deps.upload_images(images, upload_target)
                processing_state["imageUpload"] = {
                    "done": True,
                    "target": upload_target,
                }
                self._persist_processing_state(doc_id_raw, processing_state)

            if not self._finalize_done(processing_state):
                finalize_state = self._ensure_finalize_pending(
                    doc_id_raw,
                    processing_state,
                    task_record_id,
                    project_id,
                    kb_id,
                    stage_run_key,
                    source_fingerprint,
                )
                return DocTaskCompletion(
                    doc_id=doc_id_raw,
                    task_record_id=task_record_id,
                    project_id=project_id,
                    kb_id=kb_id,
                    result=result,
                    user_id=user_id,
                    parent_task_record_id=parent_task_record_id,
                    stage_run_key=stage_run_key,
                    completion_message_id=finalize_state["messageId"],
                    source_fingerprint=source_fingerprint,
                )
            finalized = processing_state["finalize"]
            return DocTaskCompletion(
                doc_id=doc_id_raw,
                task_record_id=task_record_id,
                project_id=project_id,
                kb_id=kb_id,
                result=result,
                user_id=user_id,
                parent_task_record_id=parent_task_record_id,
                stage_run_key=stage_run_key,
                completion_message_id=str(finalized["messageId"]),
                source_fingerprint=source_fingerprint,
            )
        except Exception:
            raise
        finally:
            for d in cleanup_dirs:
                shutil.rmtree(d, ignore_errors=True)

    def mark_completion_persisted(
        self,
        *,
        doc_id: str,
        completion_message_id: str,
        source_fingerprint: str,
        task_record_id: int,
        stage_run_key: str | None,
    ) -> None:
        metadata = self._deps.load_doc_metadata(doc_id)
        processing_state = self._normalize_processing_state(metadata.get(self._PROCESSING_STATE_KEY))
        finalize = processing_state.get("finalize")
        if not self._finalize_matches_current_run(
            finalize,
            completion_message_id=completion_message_id,
            source_fingerprint=source_fingerprint,
            task_record_id=task_record_id,
            stage_run_key=stage_run_key,
            required_state="pending",
        ):
            return
        processing_state["finalize"] = self._build_finalize_state(
            state="done",
            message_id=completion_message_id,
            source_fingerprint=source_fingerprint,
            task_record_id=task_record_id,
            stage_run_key=stage_run_key,
        )
        self._persist_processing_state(doc_id, processing_state)

    @staticmethod
    def _parse_task_record_id(payload: dict[str, Any]) -> int:
        task_record_id_raw = payload.get("taskRecordId")
        if task_record_id_raw is None:
            raise ValueError("payload missing taskRecordId")
        try:
            return int(task_record_id_raw)
        except (TypeError, ValueError) as exc:
            raise ValueError("taskRecordId invalid") from exc

    @staticmethod
    def _parse_project_id(payload: dict[str, Any]) -> str:
        project_id = str(payload.get("projectId") or "").strip()
        if not project_id:
            raise ValueError("payload missing projectId")
        return project_id

    @staticmethod
    def _parse_user_id(payload: dict[str, Any]) -> int | None:
        user_id_raw = payload.get("userId")
        if user_id_raw is None:
            return None
        try:
            return int(user_id_raw)
        except (TypeError, ValueError) as exc:
            raise ValueError("payload userId invalid") from exc

    @staticmethod
    def _parse_kb_id(payload: dict[str, Any]) -> str:
        kb_id = str(payload.get("kbId") or "").strip()
        if not kb_id:
            raise ValueError("payload missing kbId")
        return kb_id

    @staticmethod
    def _build_result(command_payload: dict[str, Any], doc_id: str, source_type: str, source: str) -> dict[str, Any]:
        result = {
            "docId": doc_id,
            "name": command_payload.get("name"),
            "fileType": command_payload.get("fileType"),
            "sourceType": source_type,
        }
        if source_type != "text":
            result["source"] = source
        if source_type == "objectKey":
            result["objectKey"] = source
        return result

    @staticmethod
    def _public_error_message() -> str:
        return "文档解析失败"

    @staticmethod
    def _normalize_optional_string(value: Any) -> str | None:
        normalized = str(value).strip() if value is not None else ""
        return normalized or None

    @staticmethod
    def _parse_optional_int(value: Any) -> int | None:
        if value is None:
            return None
        try:
            return int(value)
        except (TypeError, ValueError):
            return None

    @classmethod
    def _resolve_source(cls, command_payload: dict[str, Any]) -> tuple[str, str]:
        source = cls._normalize_optional_string(command_payload.get("source"))
        source_type = cls._normalize_optional_string(command_payload.get("sourceType"))
        if source is not None:
            if source_type is None:
                raise ValueError("payload missing sourceType")
            return source_type, source
        legacy_object_key = cls._normalize_optional_string(command_payload.get("objectKey"))
        if legacy_object_key is None:
            return "", ""
        return "objectKey", legacy_object_key

    @staticmethod
    def _resolve_upload_target(source: str, source_type: str, doc_id: str) -> str:
        if source_type == "objectKey":
            return source
        return f"kb-doc/{doc_id}/source"

    def _store_preprocessed_content(self, result: PreprocessResult, kb_doc_id: int) -> int:
        if result.pdf_path is not None:
            return self._deps.store_pdf(str(result.pdf_path), kb_doc_id)
        if result.text_content is not None:
            return self._deps.store_text(
                result.text_content,
                kb_doc_id,
                result.text_source_type or "text",
            )
        raise ValueError("preprocess result missing pdf_path/text_content")

    @classmethod
    def _normalize_processing_state(cls, value: Any) -> dict[str, Any]:
        if not isinstance(value, dict):
            return {"version": 1}
        normalized = dict(value)
        normalized["version"] = 1
        return normalized

    @staticmethod
    def _step_done(processing_state: dict[str, Any], step: str) -> bool:
        value = processing_state.get(step)
        return isinstance(value, dict) and value.get("done") is True

    @staticmethod
    def _finalize_done(processing_state: dict[str, Any]) -> bool:
        value = processing_state.get("finalize")
        return isinstance(value, dict) and value.get("state") == "done"

    @classmethod
    def _get_recoverable_finalize_pending(
        cls,
        processing_state: dict[str, Any],
        *,
        task_record_id: int,
        source_fingerprint: str,
        stage_run_key: str | None,
        requires_image_upload: bool,
    ) -> dict[str, Any] | None:
        if not cls._step_done(processing_state, "contentStore"):
            return None
        if requires_image_upload and not cls._step_done(processing_state, "imageUpload"):
            return None
        finalize = processing_state.get("finalize")
        if not cls._finalize_matches_current_run(
            finalize,
            completion_message_id=None,
            source_fingerprint=source_fingerprint,
            task_record_id=task_record_id,
            stage_run_key=stage_run_key,
            required_state="pending",
        ):
            return None
        return finalize

    @staticmethod
    def _build_source_fingerprint(source_type: str, source: str) -> str:
        return f"{source_type}:{source}"

    def _persist_processing_state(self, doc_id: str, processing_state: dict[str, Any]) -> None:
        if self._deps.update_doc_metadata is None:
            raise ValueError("update_doc_metadata dependency required")
        self._deps.update_doc_metadata(
            doc_id,
            {self._PROCESSING_STATE_KEY: processing_state},
        )

    def _ensure_finalize_pending(
        self,
        doc_id: str,
        processing_state: dict[str, Any],
        task_record_id: int,
        project_id: str,
        kb_id: str,
        stage_run_key: str | None,
        source_fingerprint: str,
    ) -> dict[str, Any]:
        finalize = processing_state.get("finalize")
        if self._finalize_matches_current_run(
            finalize,
            completion_message_id=None,
            source_fingerprint=source_fingerprint,
            task_record_id=task_record_id,
            stage_run_key=stage_run_key,
            required_state=None,
        ):
            return dict(finalize)
        message_id = self._build_completion_message_id(
            task_record_id=task_record_id,
            project_id=project_id,
            kb_id=kb_id,
            stage_run_key=stage_run_key,
            source_fingerprint=source_fingerprint,
        )
        processing_state["finalize"] = self._build_finalize_state(
            state="pending",
            message_id=message_id,
            source_fingerprint=source_fingerprint,
            task_record_id=task_record_id,
            stage_run_key=stage_run_key,
        )
        self._persist_processing_state(doc_id, processing_state)
        return processing_state["finalize"]

    @staticmethod
    def _build_finalize_state(
        *,
        state: str,
        message_id: str,
        source_fingerprint: str,
        task_record_id: int,
        stage_run_key: str | None,
    ) -> dict[str, Any]:
        return {
            "state": state,
            "messageId": message_id,
            "sourceFingerprint": source_fingerprint,
            "taskRecordId": task_record_id,
            "stageRunKey": stage_run_key,
        }

    @classmethod
    def _finalize_matches_current_run(
        cls,
        finalize: Any,
        *,
        completion_message_id: str | None,
        source_fingerprint: str,
        task_record_id: int,
        stage_run_key: str | None,
        required_state: str | None,
    ) -> bool:
        if not isinstance(finalize, dict):
            return False
        message_id = cls._normalize_optional_string(finalize.get("messageId"))
        state = cls._normalize_optional_string(finalize.get("state"))
        finalize_source_fingerprint = cls._normalize_optional_string(finalize.get("sourceFingerprint"))
        finalize_task_record_id = cls._parse_optional_int(finalize.get("taskRecordId"))
        finalize_stage_run_key = cls._normalize_optional_string(finalize.get("stageRunKey"))
        if message_id is None:
            return False
        if completion_message_id is not None and message_id != completion_message_id:
            return False
        if required_state is not None and state != required_state:
            return False
        return (
            finalize_source_fingerprint == source_fingerprint
            and finalize_task_record_id == task_record_id
            and finalize_stage_run_key == stage_run_key
        )

    @staticmethod
    def _build_completion_message_id(
        *,
        task_record_id: int,
        project_id: str,
        kb_id: str,
        stage_run_key: str | None,
        source_fingerprint: str,
    ) -> str:
        raw = "|".join([
            "kb_server_doc_done",
            str(task_record_id),
            project_id,
            kb_id,
            stage_run_key or "",
            source_fingerprint,
        ])
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    def _reset_processing_state_if_needed(
        self,
        doc_id: str,
        kb_doc_id: int,
        processing_state: dict[str, Any],
        source_fingerprint: str,
    ) -> tuple[dict[str, Any], bool]:
        current_fingerprint = self._normalize_optional_string(processing_state.get("sourceFingerprint"))
        if current_fingerprint == source_fingerprint:
            processing_state["sourceFingerprint"] = source_fingerprint
            return processing_state, False

        previous_upload = processing_state.get("imageUpload")
        previous_target = None
        if isinstance(previous_upload, dict):
            previous_target = self._normalize_optional_string(previous_upload.get("target"))
        content_cleared = False
        if current_fingerprint is not None:
            self._deps.clear_doc_content(kb_doc_id)
            content_cleared = True
        if previous_target is not None:
            self._deps.clear_uploaded_images(previous_target)
        reset_state = {"version": 1, "sourceFingerprint": source_fingerprint}
        self._persist_processing_state(doc_id, reset_state)
        return reset_state, content_cleared
