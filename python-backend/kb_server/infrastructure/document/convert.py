# 该文件职责：将非 PDF 文件转换为 PDF。

from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
from pathlib import Path


def _find_soffice() -> str:
    explicit = os.getenv("KB_SOFFICE_PATH", "").strip()
    if explicit:
        path = Path(explicit)
        if path.exists():
            return str(path)
        raise RuntimeError(f"KB_SOFFICE_PATH not found: {explicit}")
    soffice = shutil.which("soffice")
    if not soffice:
        raise RuntimeError("Cannot find 'soffice' in PATH. Please install LibreOffice.")
    return soffice


def convert_to_pdf(input_path: Path) -> Path:
    soffice = _find_soffice()
    tmp_dir = Path(tempfile.mkdtemp(prefix="kb_pdf_"))
    cmd = [
        soffice,
        "--headless",
        "--nologo",
        "--nofirststartwizard",
        "--convert-to",
        "pdf",
        "--outdir",
        str(tmp_dir),
        str(input_path),
    ]
    proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if proc.returncode != 0:
        raise RuntimeError(
            "LibreOffice conversion failed.\n"
            f"CMD: {' '.join(cmd)}\n"
            f"STDOUT: {proc.stdout}\n"
            f"STDERR: {proc.stderr}\n"
        )
    pdf_path = tmp_dir / (input_path.stem + ".pdf")
    if not pdf_path.exists():
        candidates = list(tmp_dir.glob(input_path.stem + "*.pdf"))
        if not candidates:
            raise RuntimeError(f"Converted PDF not found in: {tmp_dir}")
        pdf_path = candidates[0]
    return pdf_path
