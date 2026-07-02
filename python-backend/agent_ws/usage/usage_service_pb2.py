# 该文件职责：UsageService gRPC 的 protobuf 描述与消息类型定义。

from __future__ import annotations

from google.protobuf import descriptor_pb2 as _descriptor_pb2
from google.protobuf import descriptor_pool as _descriptor_pool
from google.protobuf import message as _message
from google.protobuf import reflection as _reflection
from google.protobuf import symbol_database as _symbol_database

_sym_db = _symbol_database.Default()


def _build_file_descriptor() -> _descriptor_pb2.FileDescriptorProto:
    file_desc_proto = _descriptor_pb2.FileDescriptorProto()
    file_desc_proto.name = "usage/v1/usage_service.proto"
    file_desc_proto.package = "usage.v1"
    file_desc_proto.syntax = "proto3"

    record_request = file_desc_proto.message_type.add()
    record_request.name = "RecordUsageRequest"

    metadata_entry = record_request.nested_type.add()
    metadata_entry.name = "MetadataEntry"
    metadata_entry.options.map_entry = True
    metadata_key = metadata_entry.field.add()
    metadata_key.name = "key"
    metadata_key.number = 1
    metadata_key.label = _descriptor_pb2.FieldDescriptorProto.LABEL_OPTIONAL
    metadata_key.type = _descriptor_pb2.FieldDescriptorProto.TYPE_STRING
    metadata_value = metadata_entry.field.add()
    metadata_value.name = "value"
    metadata_value.number = 2
    metadata_value.label = _descriptor_pb2.FieldDescriptorProto.LABEL_OPTIONAL
    metadata_value.type = _descriptor_pb2.FieldDescriptorProto.TYPE_STRING

    user_id = record_request.field.add()
    user_id.name = "user_id"
    user_id.number = 1
    user_id.label = _descriptor_pb2.FieldDescriptorProto.LABEL_OPTIONAL
    user_id.type = _descriptor_pb2.FieldDescriptorProto.TYPE_INT64

    project_id = record_request.field.add()
    project_id.name = "project_id"
    project_id.number = 2
    project_id.label = _descriptor_pb2.FieldDescriptorProto.LABEL_OPTIONAL
    project_id.type = _descriptor_pb2.FieldDescriptorProto.TYPE_STRING

    metric = record_request.field.add()
    metric.name = "metric"
    metric.number = 3
    metric.label = _descriptor_pb2.FieldDescriptorProto.LABEL_OPTIONAL
    metric.type = _descriptor_pb2.FieldDescriptorProto.TYPE_STRING

    delta = record_request.field.add()
    delta.name = "delta"
    delta.number = 4
    delta.label = _descriptor_pb2.FieldDescriptorProto.LABEL_OPTIONAL
    delta.type = _descriptor_pb2.FieldDescriptorProto.TYPE_INT64

    period = record_request.field.add()
    period.name = "period"
    period.number = 5
    period.label = _descriptor_pb2.FieldDescriptorProto.LABEL_OPTIONAL
    period.type = _descriptor_pb2.FieldDescriptorProto.TYPE_STRING

    idempotency_key = record_request.field.add()
    idempotency_key.name = "idempotency_key"
    idempotency_key.number = 6
    idempotency_key.label = _descriptor_pb2.FieldDescriptorProto.LABEL_OPTIONAL
    idempotency_key.type = _descriptor_pb2.FieldDescriptorProto.TYPE_STRING

    metadata = record_request.field.add()
    metadata.name = "metadata"
    metadata.number = 7
    metadata.label = _descriptor_pb2.FieldDescriptorProto.LABEL_REPEATED
    metadata.type = _descriptor_pb2.FieldDescriptorProto.TYPE_MESSAGE
    metadata.type_name = ".usage.v1.RecordUsageRequest.MetadataEntry"

    record_response = file_desc_proto.message_type.add()
    record_response.name = "RecordUsageResponse"

    success = record_response.field.add()
    success.name = "success"
    success.number = 1
    success.label = _descriptor_pb2.FieldDescriptorProto.LABEL_OPTIONAL
    success.type = _descriptor_pb2.FieldDescriptorProto.TYPE_BOOL

    applied = record_response.field.add()
    applied.name = "applied"
    applied.number = 2
    applied.label = _descriptor_pb2.FieldDescriptorProto.LABEL_OPTIONAL
    applied.type = _descriptor_pb2.FieldDescriptorProto.TYPE_BOOL

    new_used = record_response.field.add()
    new_used.name = "new_used"
    new_used.number = 3
    new_used.label = _descriptor_pb2.FieldDescriptorProto.LABEL_OPTIONAL
    new_used.type = _descriptor_pb2.FieldDescriptorProto.TYPE_INT64

    response_period = record_response.field.add()
    response_period.name = "period"
    response_period.number = 4
    response_period.label = _descriptor_pb2.FieldDescriptorProto.LABEL_OPTIONAL
    response_period.type = _descriptor_pb2.FieldDescriptorProto.TYPE_STRING

    query_request = file_desc_proto.message_type.add()
    query_request.name = "QueryUsageRequest"

    query_user_id = query_request.field.add()
    query_user_id.name = "user_id"
    query_user_id.number = 1
    query_user_id.label = _descriptor_pb2.FieldDescriptorProto.LABEL_OPTIONAL
    query_user_id.type = _descriptor_pb2.FieldDescriptorProto.TYPE_INT64

    query_project_id = query_request.field.add()
    query_project_id.name = "project_id"
    query_project_id.number = 2
    query_project_id.label = _descriptor_pb2.FieldDescriptorProto.LABEL_OPTIONAL
    query_project_id.type = _descriptor_pb2.FieldDescriptorProto.TYPE_STRING

    query_metric = query_request.field.add()
    query_metric.name = "metric"
    query_metric.number = 3
    query_metric.label = _descriptor_pb2.FieldDescriptorProto.LABEL_OPTIONAL
    query_metric.type = _descriptor_pb2.FieldDescriptorProto.TYPE_STRING

    query_period = query_request.field.add()
    query_period.name = "period"
    query_period.number = 4
    query_period.label = _descriptor_pb2.FieldDescriptorProto.LABEL_OPTIONAL
    query_period.type = _descriptor_pb2.FieldDescriptorProto.TYPE_STRING

    query_response = file_desc_proto.message_type.add()
    query_response.name = "QueryUsageResponse"

    used = query_response.field.add()
    used.name = "used"
    used.number = 1
    used.label = _descriptor_pb2.FieldDescriptorProto.LABEL_OPTIONAL
    used.type = _descriptor_pb2.FieldDescriptorProto.TYPE_INT64

    quota = query_response.field.add()
    quota.name = "quota"
    quota.number = 2
    quota.label = _descriptor_pb2.FieldDescriptorProto.LABEL_OPTIONAL
    quota.type = _descriptor_pb2.FieldDescriptorProto.TYPE_INT64

    query_response_period = query_response.field.add()
    query_response_period.name = "period"
    query_response_period.number = 3
    query_response_period.label = _descriptor_pb2.FieldDescriptorProto.LABEL_OPTIONAL
    query_response_period.type = _descriptor_pb2.FieldDescriptorProto.TYPE_STRING

    service = file_desc_proto.service.add()
    service.name = "UsageService"

    record_method = service.method.add()
    record_method.name = "RecordUsage"
    record_method.input_type = ".usage.v1.RecordUsageRequest"
    record_method.output_type = ".usage.v1.RecordUsageResponse"

    query_method = service.method.add()
    query_method.name = "QueryUsage"
    query_method.input_type = ".usage.v1.QueryUsageRequest"
    query_method.output_type = ".usage.v1.QueryUsageResponse"

    return file_desc_proto


DESCRIPTOR = _descriptor_pool.Default().Add(_build_file_descriptor())


RecordUsageRequest = _reflection.GeneratedProtocolMessageType(
    "RecordUsageRequest",
    (_message.Message,),
    {
        "DESCRIPTOR": DESCRIPTOR.message_types_by_name["RecordUsageRequest"],
        "__module__": __name__,
    },
)
_sym_db.RegisterMessage(RecordUsageRequest)

RecordUsageResponse = _reflection.GeneratedProtocolMessageType(
    "RecordUsageResponse",
    (_message.Message,),
    {
        "DESCRIPTOR": DESCRIPTOR.message_types_by_name["RecordUsageResponse"],
        "__module__": __name__,
    },
)
_sym_db.RegisterMessage(RecordUsageResponse)

QueryUsageRequest = _reflection.GeneratedProtocolMessageType(
    "QueryUsageRequest",
    (_message.Message,),
    {
        "DESCRIPTOR": DESCRIPTOR.message_types_by_name["QueryUsageRequest"],
        "__module__": __name__,
    },
)
_sym_db.RegisterMessage(QueryUsageRequest)

QueryUsageResponse = _reflection.GeneratedProtocolMessageType(
    "QueryUsageResponse",
    (_message.Message,),
    {
        "DESCRIPTOR": DESCRIPTOR.message_types_by_name["QueryUsageResponse"],
        "__module__": __name__,
    },
)
_sym_db.RegisterMessage(QueryUsageResponse)

__all__ = [
    "RecordUsageRequest",
    "RecordUsageResponse",
    "QueryUsageRequest",
    "QueryUsageResponse",
]
