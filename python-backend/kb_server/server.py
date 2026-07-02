# 该文件职责：组装 FastAPI 应用与启动入口，保持服务端装配代码最小化。

from __future__ import annotations

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from leary_logging import setup_logging

try:
    from .api.rag_routes import router as rag_router
    from .infrastructure.consumer_lifecycle import start_mq_consumer, stop_mq_consumer
    from .infrastructure.metrics import instrument_http_app
except ImportError:  # pragma: no cover - fallback for direct script execution
    from api.rag_routes import router as rag_router
    from infrastructure.consumer_lifecycle import start_mq_consumer, stop_mq_consumer
    from infrastructure.metrics import instrument_http_app


def create_app() -> FastAPI:
    @asynccontextmanager
    async def _lifespan(_: FastAPI):
        setup_logging(component="kb_server")
        start_mq_consumer()
        try:
            yield
        finally:
            stop_mq_consumer()

    app = FastAPI(title="kb_server", version="0.1.0", lifespan=_lifespan)
    instrument_http_app(app)

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(rag_router)
    return app


app = create_app()


def _run() -> None:
    import uvicorn

    uvicorn.run(
        "kb_server.server:app",
        host=os.getenv("KIMI_KB_HOST", "127.0.0.1"),
        port=int(os.getenv("KIMI_KB_PORT", "8001")),
        log_level=os.getenv("LOG_LEVEL", "info").lower(),
        log_config=None,
    )


if __name__ == "__main__":
    _run()
