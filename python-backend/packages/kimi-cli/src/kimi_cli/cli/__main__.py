"""该文件职责：提供 kimi_cli CLI 的模块入口。"""

from __future__ import annotations

import sys

from kimi_cli.cli import cli

def main() -> None:
    cli()

if __name__ == "__main__":
    sys.exit(main())
