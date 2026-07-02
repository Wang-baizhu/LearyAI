# 该文件职责：提供基于 PaddleOCR 的 OCR provider，实现 PDF 单页渲染与文字提取。

from __future__ import annotations

import os
import tempfile
from pathlib import Path
from typing import Any

from .provider_config import get_paddle_ocr_model_base_dir

try:
    import fitz
except ImportError:  # pragma: no cover - 依赖缺失时在运行时显式报错
    fitz = None

try:
    from paddleocr import PaddleOCR
except ImportError:  # pragma: no cover - 依赖缺失时在运行时显式报错
    PaddleOCR = None


class PaddleOCROCRProvider:
    def __init__(self, *, lang: str | None = None) -> None:
        self._lang = (lang or os.getenv("KB_PADDLE_OCR_LANG") or "ch").strip()
        self._ocr_engine: Any | None = None

    def extract_page_text(self, pdf_path: Path, page_num: int) -> str:
        engine = self._get_engine()
        image_path = self._render_page_to_image(pdf_path, page_num)
        try:
            return self._extract_text_from_image(engine, image_path)
        finally:
            image_path.unlink(missing_ok=True)

    def _get_engine(self) -> Any:
        if self._ocr_engine is not None:
            return self._ocr_engine
        if PaddleOCR is None:
            raise RuntimeError("PaddleOCR 未安装，无法执行 OCR")
        self._maybe_configure_model_dir()
        self._ocr_engine = PaddleOCR(lang=self._lang)
        return self._ocr_engine

    def _maybe_configure_model_dir(self) -> None:
        if os.getenv("PADDLE_OCR_BASE_DIR"):
            return
        os.environ["PADDLE_OCR_BASE_DIR"] = get_paddle_ocr_model_base_dir()

    def _render_page_to_image(self, pdf_path: Path, page_num: int) -> Path:
        if fitz is None:
            raise RuntimeError("PyMuPDF 未安装，无法渲染 PDF 页面供 OCR 使用")
        if page_num < 1:
            raise ValueError(f"page_num 必须从 1 开始，收到: {page_num}")

        with fitz.open(str(pdf_path)) as document:
            if page_num > document.page_count:
                raise ValueError(
                    f"page_num 超出 PDF 页数: page_num={page_num} page_count={document.page_count}"
                )
            page = document.load_page(page_num - 1)
            pixmap = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)

        temp_file = tempfile.NamedTemporaryFile(
            prefix=f"kb_ocr_page_{page_num}_",
            suffix=".png",
            delete=False,
        )
        temp_path = Path(temp_file.name)
        temp_file.close()
        pixmap.save(str(temp_path))
        return temp_path

    def _extract_text_from_image(self, engine: Any, image_path: Path) -> str:
        if hasattr(engine, "predict"):
            return self._extract_with_predict(engine, image_path)
        if hasattr(engine, "ocr"):
            return self._extract_with_legacy_ocr(engine, image_path)
        raise RuntimeError("PaddleOCR engine 不支持 predict/ocr 接口")

    def _extract_with_predict(self, engine: Any, image_path: Path) -> str:
        results = engine.predict(str(image_path))
        texts: list[str] = []
        for result in results or []:
            json_result = getattr(result, "json", None)
            if isinstance(json_result, dict):
                texts.extend(
                    str(text).strip()
                    for text in json_result.get("rec_texts", [])
                    if str(text).strip()
                )
        return "\n".join(texts)

    def _extract_with_legacy_ocr(self, engine: Any, image_path: Path) -> str:
        results = engine.ocr(str(image_path), cls=True)
        texts: list[str] = []
        for page_result in results or []:
            for line in page_result or []:
                if not isinstance(line, (list, tuple)) or len(line) < 2:
                    continue
                line_result = line[1]
                if not isinstance(line_result, (list, tuple)) or not line_result:
                    continue
                text = str(line_result[0]).strip()
                if text:
                    texts.append(text)
        return "\n".join(texts)
