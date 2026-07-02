# 该文件职责：将 PDF 按页渲染为图片。

from __future__ import annotations

from pathlib import Path

import fitz


def render_pdf_pages_to_images(pdf_path: Path, out_dir: Path) -> list[Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    doc = fitz.open(str(pdf_path))
    image_paths: list[Path] = []
    try:
        for i in range(doc.page_count):
            page = doc.load_page(i)
            pix = page.get_pixmap(alpha=False)
            out_path = out_dir / f"{i + 1}.jpg"
            pix.save(str(out_path))
            image_paths.append(out_path)
    finally:
        doc.close()
    return image_paths
