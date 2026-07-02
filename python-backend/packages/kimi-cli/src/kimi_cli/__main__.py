"""该文件职责：提供 kimi_cli 包级命令行入口。"""

from __future__ import annotations

import sys

from kimi_cli.cli.__main__ import main

if __name__ == "__main__":
    sys.exit(main())
