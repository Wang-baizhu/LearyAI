# 该文件职责：验证 kb_server 应用装配、健康检查、路由挂载与 lifespan 启停行为。

from __future__ import annotations

import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from kb_server import server


class ServerAppTests(unittest.TestCase):
    # 测试内容：create_app 构建出的应用暴露健康检查接口。
    def test_create_app_exposes_health_endpoint(self) -> None:
        with (
            patch.object(server, "instrument_http_app"),
            patch.object(server, "start_mq_consumer"),
            patch.object(server, "stop_mq_consumer"),
        ):
            app = server.create_app()

            with TestClient(app) as client:
                response = client.get("/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})

    # 测试内容：create_app 会挂载 RAG 路由，保持 HTTP 入口稳定。
    def test_create_app_includes_rag_routes(self) -> None:
        with (
            patch.object(server, "instrument_http_app"),
            patch.object(server, "start_mq_consumer"),
            patch.object(server, "stop_mq_consumer"),
        ):
            app = server.create_app()

            paths = {route.path for route in app.routes}

        self.assertIn("/rag/search", paths)
        self.assertIn("/rag/fetch", paths)
        self.assertIn("/rag/get_doc_info", paths)
        self.assertIn("/rag/update_doc_info", paths)

    # 测试内容：应用 lifespan 启动时初始化日志与 MQ 消费者，退出时停止消费者。
    def test_create_app_lifespan_starts_and_stops_consumer(self) -> None:
        with (
            patch.object(server, "setup_logging") as setup_logging,
            patch.object(server, "start_mq_consumer") as start_mq_consumer,
            patch.object(server, "stop_mq_consumer") as stop_mq_consumer,
            patch.object(server, "instrument_http_app"),
        ):
            app = server.create_app()

            with TestClient(app) as client:
                response = client.get("/health")

        self.assertEqual(response.status_code, 200)
        setup_logging.assert_called_once_with(component="kb_server")
        start_mq_consumer.assert_called_once_with()
        stop_mq_consumer.assert_called_once_with()

    # 测试内容：应用创建阶段会执行 HTTP metrics 装配。
    def test_create_app_instruments_http_app(self) -> None:
        with (
            patch.object(server, "instrument_http_app") as instrument_http_app,
            patch.object(server, "start_mq_consumer"),
            patch.object(server, "stop_mq_consumer"),
        ):
            app = server.create_app()

        instrument_http_app.assert_called_once_with(app)


if __name__ == "__main__":
    unittest.main()
