# 该文件职责：UsageService gRPC 的客户端 Stub 定义。

from __future__ import annotations

import grpc

from agent_ws.usage import usage_service_pb2 as usage__service__pb2


class UsageServiceStub:
    def __init__(self, channel: grpc.Channel) -> None:
        self.RecordUsage = channel.unary_unary(
            "/usage.v1.UsageService/RecordUsage",
            request_serializer=usage__service__pb2.RecordUsageRequest.SerializeToString,
            response_deserializer=usage__service__pb2.RecordUsageResponse.FromString,
        )
        self.QueryUsage = channel.unary_unary(
            "/usage.v1.UsageService/QueryUsage",
            request_serializer=usage__service__pb2.QueryUsageRequest.SerializeToString,
            response_deserializer=usage__service__pb2.QueryUsageResponse.FromString,
        )


__all__ = ["UsageServiceStub"]
