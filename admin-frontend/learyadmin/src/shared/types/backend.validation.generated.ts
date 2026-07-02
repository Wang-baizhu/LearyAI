// 该文件职责：由 scripts/schema/gen_backend_validation_ts.sh 从 schema/backend/openapi.json 自动生成运行时响应校验映射。

export interface BackendEndpointValidationEntry {
  module: string;
  method: string;
  path: string;
  operationId: string;
  responseSchema: unknown;
}

export const BACKEND_COMPONENT_SCHEMAS = {
  "AdminInviteDetailResponse": {
    "properties": {
      "createdAt": {
        "format": "date-time",
        "type": [
          "string",
          "null"
        ]
      },
      "creatorUserId": {
        "format": "int64",
        "type": [
          "integer",
          "null"
        ]
      },
      "expiresAt": {
        "format": "date-time",
        "type": [
          "string",
          "null"
        ]
      },
      "inviteId": {
        "format": "int64",
        "type": [
          "integer",
          "null"
        ]
      },
      "maxUses": {
        "format": "int32",
        "type": [
          "integer",
          "null"
        ]
      },
      "projectId": {
        "type": [
          "string",
          "null"
        ]
      },
      "revokedAt": {
        "format": "date-time",
        "type": [
          "string",
          "null"
        ]
      },
      "status": {
        "type": [
          "string",
          "null"
        ]
      },
      "updatedAt": {
        "format": "date-time",
        "type": [
          "string",
          "null"
        ]
      },
      "usedCount": {
        "format": "int32",
        "type": [
          "integer",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "AdminInviteItemResponse": {
    "properties": {
      "createdAt": {
        "format": "date-time",
        "type": [
          "string",
          "null"
        ]
      },
      "creatorUserId": {
        "format": "int64",
        "type": [
          "integer",
          "null"
        ]
      },
      "expiresAt": {
        "format": "date-time",
        "type": [
          "string",
          "null"
        ]
      },
      "inviteId": {
        "format": "int64",
        "type": [
          "integer",
          "null"
        ]
      },
      "maxUses": {
        "format": "int32",
        "type": [
          "integer",
          "null"
        ]
      },
      "projectId": {
        "type": [
          "string",
          "null"
        ]
      },
      "revokedAt": {
        "format": "date-time",
        "type": [
          "string",
          "null"
        ]
      },
      "status": {
        "type": [
          "string",
          "null"
        ]
      },
      "updatedAt": {
        "format": "date-time",
        "type": [
          "string",
          "null"
        ]
      },
      "usedCount": {
        "format": "int32",
        "type": [
          "integer",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "AdminInvitePageResponse": {
    "properties": {
      "items": {
        "items": {
          "$ref": "#/components/schemas/AdminInviteItemResponse"
        },
        "type": [
          "array",
          "null"
        ]
      },
      "page": {
        "format": "int32",
        "type": [
          "integer",
          "null"
        ]
      },
      "size": {
        "format": "int32",
        "type": [
          "integer",
          "null"
        ]
      },
      "total": {
        "format": "int64",
        "type": [
          "integer",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "AdminRegisterInviteCreateRequest": {
    "properties": {
      "code": {
        "type": [
          "string",
          "null"
        ]
      },
      "count": {
        "format": "int32",
        "maximum": 100,
        "minimum": 1,
        "type": [
          "integer",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "AdminRegisterInviteDetailResponse": {
    "properties": {
      "code": {
        "type": [
          "string",
          "null"
        ]
      },
      "createdAt": {
        "format": "date-time",
        "type": [
          "string",
          "null"
        ]
      },
      "createdBy": {
        "format": "int64",
        "type": [
          "integer",
          "null"
        ]
      },
      "inviteId": {
        "format": "int64",
        "type": [
          "integer",
          "null"
        ]
      },
      "status": {
        "type": [
          "string",
          "null"
        ]
      },
      "updatedAt": {
        "format": "date-time",
        "type": [
          "string",
          "null"
        ]
      },
      "usedAt": {
        "format": "date-time",
        "type": [
          "string",
          "null"
        ]
      },
      "usedByUserId": {
        "format": "int64",
        "type": [
          "integer",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "AdminRegisterInviteItemResponse": {
    "properties": {
      "code": {
        "type": [
          "string",
          "null"
        ]
      },
      "createdAt": {
        "format": "date-time",
        "type": [
          "string",
          "null"
        ]
      },
      "createdBy": {
        "format": "int64",
        "type": [
          "integer",
          "null"
        ]
      },
      "inviteId": {
        "format": "int64",
        "type": [
          "integer",
          "null"
        ]
      },
      "status": {
        "type": [
          "string",
          "null"
        ]
      },
      "updatedAt": {
        "format": "date-time",
        "type": [
          "string",
          "null"
        ]
      },
      "usedAt": {
        "format": "date-time",
        "type": [
          "string",
          "null"
        ]
      },
      "usedByUserId": {
        "format": "int64",
        "type": [
          "integer",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "AdminRegisterInvitePageResponse": {
    "properties": {
      "items": {
        "items": {
          "$ref": "#/components/schemas/AdminRegisterInviteItemResponse"
        },
        "type": [
          "array",
          "null"
        ]
      },
      "page": {
        "format": "int32",
        "type": [
          "integer",
          "null"
        ]
      },
      "size": {
        "format": "int32",
        "type": [
          "integer",
          "null"
        ]
      },
      "total": {
        "format": "int64",
        "type": [
          "integer",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "AdminTaskDlqIncidentItemResponse": {
    "properties": {
      "compensationAction": {
        "type": [
          "string",
          "null"
        ]
      },
      "createdAt": {
        "format": "date-time",
        "type": [
          "string",
          "null"
        ]
      },
      "dlqType": {
        "type": [
          "string",
          "null"
        ]
      },
      "errorMessage": {
        "type": [
          "string",
          "null"
        ]
      },
      "incidentId": {
        "format": "int64",
        "type": [
          "integer",
          "null"
        ]
      },
      "incidentStatus": {
        "type": [
          "string",
          "null"
        ]
      },
      "kbId": {
        "type": [
          "string",
          "null"
        ]
      },
      "messageId": {
        "type": [
          "string",
          "null"
        ]
      },
      "parentTaskRecordId": {
        "format": "int64",
        "type": [
          "integer",
          "null"
        ]
      },
      "payloadJson": {
        "type": [
          "string",
          "null"
        ]
      },
      "projectId": {
        "type": [
          "string",
          "null"
        ]
      },
      "retryCount": {
        "format": "int32",
        "type": [
          "integer",
          "null"
        ]
      },
      "sourceQueue": {
        "type": [
          "string",
          "null"
        ]
      },
      "sourceRoutingKey": {
        "type": [
          "string",
          "null"
        ]
      },
      "stageRunKey": {
        "type": [
          "string",
          "null"
        ]
      },
      "taskRecordId": {
        "format": "int64",
        "type": [
          "integer",
          "null"
        ]
      },
      "taskType": {
        "type": [
          "string",
          "null"
        ]
      },
      "updatedAt": {
        "format": "date-time",
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "AdminTaskDlqIncidentPageResponse": {
    "properties": {
      "items": {
        "items": {
          "$ref": "#/components/schemas/AdminTaskDlqIncidentItemResponse"
        },
        "type": [
          "array",
          "null"
        ]
      },
      "page": {
        "format": "int32",
        "type": [
          "integer",
          "null"
        ]
      },
      "size": {
        "format": "int32",
        "type": [
          "integer",
          "null"
        ]
      },
      "total": {
        "format": "int64",
        "type": [
          "integer",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "AdminTaskDlqIncidentStatusUpdateRequest": {
    "properties": {
      "incidentStatus": {
        "minLength": 1,
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "AdminUsageCurrentCycleResponse": {
    "properties": {
      "available": {
        "format": "int64",
        "type": [
          "integer",
          "null"
        ]
      },
      "cycleId": {
        "format": "int64",
        "type": [
          "integer",
          "null"
        ]
      },
      "metric": {
        "type": [
          "string",
          "null"
        ]
      },
      "projectId": {
        "type": [
          "string",
          "null"
        ]
      },
      "quota": {
        "format": "int64",
        "type": [
          "integer",
          "null"
        ]
      },
      "reserved": {
        "format": "int64",
        "type": [
          "integer",
          "null"
        ]
      },
      "updatedAt": {
        "format": "date-time",
        "type": [
          "string",
          "null"
        ]
      },
      "used": {
        "format": "int64",
        "type": [
          "integer",
          "null"
        ]
      },
      "userId": {
        "format": "int64",
        "type": [
          "integer",
          "null"
        ]
      },
      "validFrom": {
        "format": "date-time",
        "type": [
          "string",
          "null"
        ]
      },
      "validTo": {
        "format": "date-time",
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "AdminUsageEventListItemResponse": {
    "properties": {
      "createdAt": {
        "format": "date-time",
        "type": [
          "string",
          "null"
        ]
      },
      "delta": {
        "format": "int64",
        "type": [
          "integer",
          "null"
        ]
      },
      "idempotencyKey": {
        "type": [
          "string",
          "null"
        ]
      },
      "metric": {
        "type": [
          "string",
          "null"
        ]
      },
      "occurredAt": {
        "format": "date-time",
        "type": [
          "string",
          "null"
        ]
      },
      "projectId": {
        "type": [
          "string",
          "null"
        ]
      },
      "sourceId": {
        "type": [
          "string",
          "null"
        ]
      },
      "sourceType": {
        "type": [
          "string",
          "null"
        ]
      },
      "userId": {
        "format": "int64",
        "type": [
          "integer",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "AdminUsageEventPageResponse": {
    "properties": {
      "items": {
        "items": {
          "$ref": "#/components/schemas/AdminUsageEventListItemResponse"
        },
        "type": [
          "array",
          "null"
        ]
      },
      "page": {
        "format": "int32",
        "type": [
          "integer",
          "null"
        ]
      },
      "size": {
        "format": "int32",
        "type": [
          "integer",
          "null"
        ]
      },
      "total": {
        "format": "int64",
        "type": [
          "integer",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "AdminUsageMetricSummaryResponse": {
    "properties": {
      "available": {
        "format": "int64",
        "type": [
          "integer",
          "null"
        ]
      },
      "metric": {
        "type": [
          "string",
          "null"
        ]
      },
      "quota": {
        "format": "int64",
        "type": [
          "integer",
          "null"
        ]
      },
      "reserved": {
        "format": "int64",
        "type": [
          "integer",
          "null"
        ]
      },
      "used": {
        "format": "int64",
        "type": [
          "integer",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "AdminUserRecentLoginItemResponse": {
    "properties": {
      "email": {
        "type": [
          "string",
          "null"
        ]
      },
      "lastLoginAt": {
        "format": "date-time",
        "type": [
          "string",
          "null"
        ]
      },
      "name": {
        "type": [
          "string",
          "null"
        ]
      },
      "phone": {
        "type": [
          "string",
          "null"
        ]
      },
      "userId": {
        "format": "int64",
        "type": [
          "integer",
          "null"
        ]
      },
      "userMode": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "AdminUserRecentLoginPageResponse": {
    "properties": {
      "items": {
        "items": {
          "$ref": "#/components/schemas/AdminUserRecentLoginItemResponse"
        },
        "type": [
          "array",
          "null"
        ]
      },
      "page": {
        "format": "int32",
        "type": [
          "integer",
          "null"
        ]
      },
      "size": {
        "format": "int32",
        "type": [
          "integer",
          "null"
        ]
      },
      "total": {
        "format": "int64",
        "type": [
          "integer",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "AdminUserSubscriptionCycleResponse": {
    "properties": {
      "createdAt": {
        "format": "date-time",
        "type": [
          "string",
          "null"
        ]
      },
      "id": {
        "format": "int64",
        "type": [
          "integer",
          "null"
        ]
      },
      "metric": {
        "type": [
          "string",
          "null"
        ]
      },
      "planId": {
        "type": [
          "string",
          "null"
        ]
      },
      "quota": {
        "format": "int64",
        "type": [
          "integer",
          "null"
        ]
      },
      "status": {
        "type": [
          "string",
          "null"
        ]
      },
      "updatedAt": {
        "format": "date-time",
        "type": [
          "string",
          "null"
        ]
      },
      "userId": {
        "format": "int64",
        "type": [
          "integer",
          "null"
        ]
      },
      "validFrom": {
        "format": "date-time",
        "type": [
          "string",
          "null"
        ]
      },
      "validTo": {
        "format": "date-time",
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "AdminUserSubscriptionCycleUpsertRequest": {
    "properties": {
      "planId": {
        "minLength": 1,
        "type": [
          "string",
          "null"
        ]
      },
      "quota": {
        "format": "int64",
        "minimum": 0,
        "type": "integer"
      },
      "validFrom": {
        "format": "date-time",
        "type": "string"
      },
      "validTo": {
        "format": "date-time",
        "type": "string"
      }
    },
    "required": [
      "quota",
      "validFrom",
      "validTo"
    ],
    "type": "object"
  },
  "AdminUserSummaryResponse": {
    "properties": {
      "totalUsers": {
        "format": "int64",
        "type": [
          "integer",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "ApiResponseAdminInviteDetailResponse": {
    "properties": {
      "code": {
        "type": [
          "string",
          "null"
        ]
      },
      "data": {
        "$ref": "#/components/schemas/AdminInviteDetailResponse"
      },
      "message": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "ApiResponseAdminInvitePageResponse": {
    "properties": {
      "code": {
        "type": [
          "string",
          "null"
        ]
      },
      "data": {
        "$ref": "#/components/schemas/AdminInvitePageResponse"
      },
      "message": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "ApiResponseAdminRegisterInviteDetailResponse": {
    "properties": {
      "code": {
        "type": [
          "string",
          "null"
        ]
      },
      "data": {
        "$ref": "#/components/schemas/AdminRegisterInviteDetailResponse"
      },
      "message": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "ApiResponseAdminRegisterInvitePageResponse": {
    "properties": {
      "code": {
        "type": [
          "string",
          "null"
        ]
      },
      "data": {
        "$ref": "#/components/schemas/AdminRegisterInvitePageResponse"
      },
      "message": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "ApiResponseAdminTaskDlqIncidentItemResponse": {
    "properties": {
      "code": {
        "type": [
          "string",
          "null"
        ]
      },
      "data": {
        "$ref": "#/components/schemas/AdminTaskDlqIncidentItemResponse"
      },
      "message": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "ApiResponseAdminTaskDlqIncidentPageResponse": {
    "properties": {
      "code": {
        "type": [
          "string",
          "null"
        ]
      },
      "data": {
        "$ref": "#/components/schemas/AdminTaskDlqIncidentPageResponse"
      },
      "message": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "ApiResponseAdminUsageCurrentCycleResponse": {
    "properties": {
      "code": {
        "type": [
          "string",
          "null"
        ]
      },
      "data": {
        "$ref": "#/components/schemas/AdminUsageCurrentCycleResponse"
      },
      "message": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "ApiResponseAdminUsageEventPageResponse": {
    "properties": {
      "code": {
        "type": [
          "string",
          "null"
        ]
      },
      "data": {
        "$ref": "#/components/schemas/AdminUsageEventPageResponse"
      },
      "message": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "ApiResponseAdminUserRecentLoginItemResponse": {
    "properties": {
      "code": {
        "type": [
          "string",
          "null"
        ]
      },
      "data": {
        "$ref": "#/components/schemas/AdminUserRecentLoginItemResponse"
      },
      "message": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "ApiResponseAdminUserRecentLoginPageResponse": {
    "properties": {
      "code": {
        "type": [
          "string",
          "null"
        ]
      },
      "data": {
        "$ref": "#/components/schemas/AdminUserRecentLoginPageResponse"
      },
      "message": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "ApiResponseAdminUserSubscriptionCycleResponse": {
    "properties": {
      "code": {
        "type": [
          "string",
          "null"
        ]
      },
      "data": {
        "$ref": "#/components/schemas/AdminUserSubscriptionCycleResponse"
      },
      "message": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "ApiResponseAdminUserSummaryResponse": {
    "properties": {
      "code": {
        "type": [
          "string",
          "null"
        ]
      },
      "data": {
        "$ref": "#/components/schemas/AdminUserSummaryResponse"
      },
      "message": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "ApiResponseBoolean": {
    "properties": {
      "code": {
        "type": [
          "string",
          "null"
        ]
      },
      "data": {
        "type": [
          "boolean",
          "null"
        ]
      },
      "message": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "ApiResponseKbDocDetailResponse": {
    "properties": {
      "code": {
        "type": [
          "string",
          "null"
        ]
      },
      "data": {
        "$ref": "#/components/schemas/KbDocDetailResponse"
      },
      "message": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "ApiResponseKbDocListResponse": {
    "properties": {
      "code": {
        "type": [
          "string",
          "null"
        ]
      },
      "data": {
        "$ref": "#/components/schemas/KbDocListResponse"
      },
      "message": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "ApiResponseKbDocTextChunkPageResponse": {
    "properties": {
      "code": {
        "type": [
          "string",
          "null"
        ]
      },
      "data": {
        "$ref": "#/components/schemas/KbDocTextChunkPageResponse"
      },
      "message": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "ApiResponseKbSkillSearchResponse": {
    "properties": {
      "code": {
        "type": [
          "string",
          "null"
        ]
      },
      "data": {
        "$ref": "#/components/schemas/KbSkillSearchResponse"
      },
      "message": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "ApiResponseKbSkillTokenResponse": {
    "properties": {
      "code": {
        "type": [
          "string",
          "null"
        ]
      },
      "data": {
        "$ref": "#/components/schemas/KbSkillTokenResponse"
      },
      "message": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "ApiResponseKnowledgeBaseCanvasResponse": {
    "properties": {
      "code": {
        "type": [
          "string",
          "null"
        ]
      },
      "data": {
        "$ref": "#/components/schemas/KnowledgeBaseCanvasResponse"
      },
      "message": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "ApiResponseKnowledgeBaseListResponse": {
    "properties": {
      "code": {
        "type": [
          "string",
          "null"
        ]
      },
      "data": {
        "$ref": "#/components/schemas/KnowledgeBaseListResponse"
      },
      "message": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "ApiResponseKnowledgeBaseResponse": {
    "properties": {
      "code": {
        "type": [
          "string",
          "null"
        ]
      },
      "data": {
        "$ref": "#/components/schemas/KnowledgeBaseResponse"
      },
      "message": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "ApiResponseListAdminRegisterInviteDetailResponse": {
    "properties": {
      "code": {
        "type": [
          "string",
          "null"
        ]
      },
      "data": {
        "items": {
          "$ref": "#/components/schemas/AdminRegisterInviteDetailResponse"
        },
        "type": [
          "array",
          "null"
        ]
      },
      "message": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "ApiResponseListAdminUsageMetricSummaryResponse": {
    "properties": {
      "code": {
        "type": [
          "string",
          "null"
        ]
      },
      "data": {
        "items": {
          "$ref": "#/components/schemas/AdminUsageMetricSummaryResponse"
        },
        "type": [
          "array",
          "null"
        ]
      },
      "message": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "ApiResponseListAdminUserSubscriptionCycleResponse": {
    "properties": {
      "code": {
        "type": [
          "string",
          "null"
        ]
      },
      "data": {
        "items": {
          "$ref": "#/components/schemas/AdminUserSubscriptionCycleResponse"
        },
        "type": [
          "array",
          "null"
        ]
      },
      "message": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "ApiResponseListKbDocOptionItemResponse": {
    "properties": {
      "code": {
        "type": [
          "string",
          "null"
        ]
      },
      "data": {
        "items": {
          "$ref": "#/components/schemas/KbDocOptionItemResponse"
        },
        "type": [
          "array",
          "null"
        ]
      },
      "message": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "ApiResponseListKnowledgeBaseResponse": {
    "properties": {
      "code": {
        "type": [
          "string",
          "null"
        ]
      },
      "data": {
        "items": {
          "$ref": "#/components/schemas/KnowledgeBaseResponse"
        },
        "type": [
          "array",
          "null"
        ]
      },
      "message": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "ApiResponseListProjectInviteResponse": {
    "properties": {
      "code": {
        "type": [
          "string",
          "null"
        ]
      },
      "data": {
        "items": {
          "$ref": "#/components/schemas/ProjectInviteResponse"
        },
        "type": [
          "array",
          "null"
        ]
      },
      "message": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "ApiResponseListString": {
    "properties": {
      "code": {
        "type": [
          "string",
          "null"
        ]
      },
      "data": {
        "items": {
          "type": "string"
        },
        "type": [
          "array",
          "null"
        ]
      },
      "message": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "ApiResponsePreviewCredentialsResponse": {
    "properties": {
      "code": {
        "type": [
          "string",
          "null"
        ]
      },
      "data": {
        "$ref": "#/components/schemas/PreviewCredentialsResponse"
      },
      "message": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "ApiResponseProjectInviteCreateResponse": {
    "properties": {
      "code": {
        "type": [
          "string",
          "null"
        ]
      },
      "data": {
        "$ref": "#/components/schemas/ProjectInviteCreateResponse"
      },
      "message": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "ApiResponseProjectListResponse": {
    "properties": {
      "code": {
        "type": [
          "string",
          "null"
        ]
      },
      "data": {
        "$ref": "#/components/schemas/ProjectListResponse"
      },
      "message": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "ApiResponseProjectMemberListResponse": {
    "properties": {
      "code": {
        "type": [
          "string",
          "null"
        ]
      },
      "data": {
        "$ref": "#/components/schemas/ProjectMemberListResponse"
      },
      "message": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "ApiResponseProjectResponse": {
    "properties": {
      "code": {
        "type": [
          "string",
          "null"
        ]
      },
      "data": {
        "$ref": "#/components/schemas/ProjectResponse"
      },
      "message": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "ApiResponseRecentVisitPageResponse": {
    "properties": {
      "code": {
        "type": [
          "string",
          "null"
        ]
      },
      "data": {
        "$ref": "#/components/schemas/RecentVisitPageResponse"
      },
      "message": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "ApiResponseResourceCenterOptionsResponse": {
    "properties": {
      "code": {
        "type": [
          "string",
          "null"
        ]
      },
      "data": {
        "$ref": "#/components/schemas/ResourceCenterOptionsResponse"
      },
      "message": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "ApiResponseTaskDetailResponse": {
    "properties": {
      "code": {
        "type": [
          "string",
          "null"
        ]
      },
      "data": {
        "$ref": "#/components/schemas/TaskDetailResponse"
      },
      "message": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "ApiResponseTaskListResponse": {
    "properties": {
      "code": {
        "type": [
          "string",
          "null"
        ]
      },
      "data": {
        "$ref": "#/components/schemas/TaskListResponse"
      },
      "message": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "ApiResponseTemplateRuntimeManifestResponse": {
    "properties": {
      "code": {
        "type": [
          "string",
          "null"
        ]
      },
      "data": {
        "$ref": "#/components/schemas/TemplateRuntimeManifestResponse"
      },
      "message": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "ApiResponseUploadConfirmResponse": {
    "properties": {
      "code": {
        "type": [
          "string",
          "null"
        ]
      },
      "data": {
        "$ref": "#/components/schemas/UploadConfirmResponse"
      },
      "message": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "ApiResponseUploadPrepareResponse": {
    "properties": {
      "code": {
        "type": [
          "string",
          "null"
        ]
      },
      "data": {
        "$ref": "#/components/schemas/UploadPrepareResponse"
      },
      "message": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "ApiResponseUrlImportResponse": {
    "properties": {
      "code": {
        "type": [
          "string",
          "null"
        ]
      },
      "data": {
        "$ref": "#/components/schemas/UrlImportResponse"
      },
      "message": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "ApiResponseUsageCurrentCycleResponse": {
    "properties": {
      "code": {
        "type": [
          "string",
          "null"
        ]
      },
      "data": {
        "$ref": "#/components/schemas/UsageCurrentCycleResponse"
      },
      "message": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "ApiResponseUserResponse": {
    "properties": {
      "code": {
        "type": [
          "string",
          "null"
        ]
      },
      "data": {
        "$ref": "#/components/schemas/UserResponse"
      },
      "message": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "ApiResponseVoid": {
    "properties": {
      "code": {
        "type": [
          "string",
          "null"
        ]
      },
      "data": {
        "type": [
          "object",
          "null"
        ]
      },
      "message": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "KbDocBindRequest": {
    "properties": {
      "docId": {
        "minLength": 1,
        "type": [
          "string",
          "null"
        ]
      },
      "kbId": {
        "minLength": 1,
        "type": [
          "string",
          "null"
        ]
      },
      "projectId": {
        "maxLength": 36,
        "minLength": 0,
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "KbDocDetailResponse": {
    "properties": {
      "createdAt": {
        "format": "date-time",
        "type": [
          "string",
          "null"
        ]
      },
      "docId": {
        "type": [
          "string",
          "null"
        ]
      },
      "fileType": {
        "type": [
          "string",
          "null"
        ]
      },
      "metadata": {
        "additionalProperties": true,
        "type": [
          "object",
          "null"
        ]
      },
      "name": {
        "type": [
          "string",
          "null"
        ]
      },
      "objectKey": {
        "type": [
          "string",
          "null"
        ]
      },
      "originUrl": {
        "type": [
          "string",
          "null"
        ]
      },
      "size": {
        "format": "int64",
        "type": [
          "integer",
          "null"
        ]
      },
      "storageProvider": {
        "type": [
          "string",
          "null"
        ]
      },
      "updatedAt": {
        "format": "date-time",
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "KbDocItemResponse": {
    "properties": {
      "createdAt": {
        "format": "date-time",
        "type": [
          "string",
          "null"
        ]
      },
      "docId": {
        "type": [
          "string",
          "null"
        ]
      },
      "fileType": {
        "type": [
          "string",
          "null"
        ]
      },
      "name": {
        "type": [
          "string",
          "null"
        ]
      },
      "size": {
        "format": "int64",
        "type": [
          "integer",
          "null"
        ]
      },
      "status": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "KbDocListResponse": {
    "properties": {
      "items": {
        "items": {
          "$ref": "#/components/schemas/KbDocItemResponse"
        },
        "type": [
          "array",
          "null"
        ]
      },
      "page": {
        "format": "int32",
        "type": [
          "integer",
          "null"
        ]
      },
      "size": {
        "format": "int32",
        "type": [
          "integer",
          "null"
        ]
      },
      "total": {
        "format": "int64",
        "type": [
          "integer",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "KbDocOptionItemResponse": {
    "properties": {
      "docId": {
        "type": [
          "string",
          "null"
        ]
      },
      "name": {
        "type": [
          "string",
          "null"
        ]
      },
      "status": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "KbDocTextChunkItemResponse": {
    "properties": {
      "chunkSec": {
        "format": "int32",
        "type": [
          "integer",
          "null"
        ]
      },
      "text": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "KbDocTextChunkPageResponse": {
    "properties": {
      "hasMore": {
        "type": [
          "boolean",
          "null"
        ]
      },
      "items": {
        "items": {
          "$ref": "#/components/schemas/KbDocTextChunkItemResponse"
        },
        "type": [
          "array",
          "null"
        ]
      },
      "nextChunkSec": {
        "format": "int32",
        "type": [
          "integer",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "KbDocUpdateRequest": {
    "properties": {
      "description": {
        "type": [
          "string",
          "null"
        ]
      },
      "documentation": {
        "additionalProperties": true,
        "type": [
          "object",
          "null"
        ]
      },
      "name": {
        "minLength": 1,
        "type": [
          "string",
          "null"
        ]
      },
      "projectId": {
        "minLength": 1,
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "KbSkillDocRefRequest": {
    "properties": {
      "id": {
        "minLength": 1,
        "type": [
          "string",
          "null"
        ]
      },
      "name": {
        "minLength": 1,
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "KbSkillSearchRequest": {
    "properties": {
      "query": {
        "minLength": 1,
        "type": [
          "string",
          "null"
        ]
      },
      "token": {
        "minLength": 1,
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "KbSkillSearchResponse": {
    "properties": {
      "answer": {
        "type": [
          "string",
          "null"
        ]
      },
      "completed": {
        "type": [
          "boolean",
          "null"
        ]
      },
      "errorMessage": {
        "type": [
          "string",
          "null"
        ]
      },
      "taskId": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "KbSkillTokenCreateRequest": {
    "properties": {
      "abilities": {
        "items": {
          "type": "string"
        },
        "minItems": 1,
        "type": [
          "array",
          "null"
        ]
      },
      "docRefs": {
        "items": {
          "$ref": "#/components/schemas/KbSkillDocRefRequest"
        },
        "type": [
          "array",
          "null"
        ]
      },
      "expiresInDays": {
        "format": "int32",
        "type": [
          "integer",
          "null"
        ]
      },
      "expiresInSeconds": {
        "format": "int32",
        "type": [
          "integer",
          "null"
        ]
      },
      "kbId": {
        "minLength": 1,
        "type": [
          "string",
          "null"
        ]
      },
      "neverExpires": {
        "type": [
          "boolean",
          "null"
        ]
      },
      "projectId": {
        "minLength": 1,
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "KbSkillTokenResponse": {
    "properties": {
      "abilities": {
        "items": {
          "type": "string"
        },
        "type": [
          "array",
          "null"
        ]
      },
      "docRefs": {
        "items": {
          "additionalProperties": true,
          "type": "object"
        },
        "type": [
          "array",
          "null"
        ]
      },
      "expiresAt": {
        "format": "date-time",
        "type": [
          "string",
          "null"
        ]
      },
      "kbId": {
        "type": [
          "string",
          "null"
        ]
      },
      "projectId": {
        "type": [
          "string",
          "null"
        ]
      },
      "token": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "KnowledgeBaseCanvasRequest": {
    "properties": {
      "canvas": {
        "additionalProperties": true,
        "type": [
          "object",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "KnowledgeBaseCanvasResponse": {
    "properties": {
      "canvas": {
        "additionalProperties": true,
        "type": [
          "object",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "KnowledgeBaseCreateRequest": {
    "properties": {
      "description": {
        "maxLength": 512,
        "minLength": 0,
        "type": [
          "string",
          "null"
        ]
      },
      "name": {
        "maxLength": 64,
        "minLength": 0,
        "type": [
          "string",
          "null"
        ]
      },
      "projectId": {
        "maxLength": 36,
        "minLength": 0,
        "type": [
          "string",
          "null"
        ]
      },
      "tags": {
        "items": {
          "type": "string"
        },
        "type": [
          "array",
          "null"
        ]
      },
      "visibility": {
        "maxLength": 16,
        "minLength": 0,
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "KnowledgeBaseListResponse": {
    "properties": {
      "items": {
        "items": {
          "$ref": "#/components/schemas/KnowledgeBaseResponse"
        },
        "type": [
          "array",
          "null"
        ]
      },
      "page": {
        "format": "int32",
        "type": [
          "integer",
          "null"
        ]
      },
      "size": {
        "format": "int32",
        "type": [
          "integer",
          "null"
        ]
      },
      "total": {
        "format": "int64",
        "type": [
          "integer",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "KnowledgeBaseResponse": {
    "properties": {
      "description": {
        "type": [
          "string",
          "null"
        ]
      },
      "kbId": {
        "type": [
          "string",
          "null"
        ]
      },
      "name": {
        "type": [
          "string",
          "null"
        ]
      },
      "ownerId": {
        "format": "int64",
        "type": [
          "integer",
          "null"
        ]
      },
      "projectId": {
        "type": [
          "string",
          "null"
        ]
      },
      "tags": {
        "items": {
          "type": "string"
        },
        "type": [
          "array",
          "null"
        ]
      },
      "visibility": {
        "type": [
          "string",
          "null"
        ]
      },
      "visitedAt": {
        "format": "date-time",
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "KnowledgeBaseUpdateRequest": {
    "properties": {
      "description": {
        "maxLength": 512,
        "minLength": 0,
        "type": [
          "string",
          "null"
        ]
      },
      "name": {
        "maxLength": 64,
        "minLength": 0,
        "type": [
          "string",
          "null"
        ]
      },
      "tags": {
        "items": {
          "type": "string"
        },
        "type": [
          "array",
          "null"
        ]
      },
      "visibility": {
        "maxLength": 16,
        "minLength": 0,
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "KnowledgeBaseVisitRequest": {
    "properties": {
      "visitedAt": {
        "format": "date-time",
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "LoginRequest": {
    "properties": {
      "deviceId": {
        "type": [
          "string",
          "null"
        ]
      },
      "email": {
        "minLength": 1,
        "type": [
          "string",
          "null"
        ]
      },
      "password": {
        "minLength": 1,
        "type": [
          "string",
          "null"
        ]
      },
      "rememberMe": {
        "type": [
          "boolean",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "PreviewCredentialsRequest": {
    "properties": {
      "docId": {
        "minLength": 1,
        "type": [
          "string",
          "null"
        ]
      },
      "projectId": {
        "maxLength": 36,
        "minLength": 0,
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "PreviewCredentialsResponse": {
    "properties": {
      "accessKeyId": {
        "type": [
          "string",
          "null"
        ]
      },
      "bucket": {
        "type": [
          "string",
          "null"
        ]
      },
      "endpoint": {
        "type": [
          "string",
          "null"
        ]
      },
      "expiration": {
        "format": "date-time",
        "type": [
          "string",
          "null"
        ]
      },
      "prefix": {
        "type": [
          "string",
          "null"
        ]
      },
      "provider": {
        "type": [
          "string",
          "null"
        ]
      },
      "secretAccessKey": {
        "type": [
          "string",
          "null"
        ]
      },
      "sessionToken": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "ProjectCreateRequest": {
    "properties": {
      "name": {
        "maxLength": 128,
        "minLength": 0,
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "ProjectInviteAcceptRequest": {
    "properties": {
      "inviteCode": {
        "maxLength": 64,
        "minLength": 0,
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "ProjectInviteCreateRequest": {
    "properties": {
      "expiresAt": {
        "format": "date-time",
        "type": [
          "string",
          "null"
        ]
      },
      "maxUse": {
        "format": "int32",
        "minimum": 1,
        "type": [
          "integer",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "ProjectInviteCreateResponse": {
    "properties": {
      "code": {
        "type": [
          "string",
          "null"
        ]
      },
      "expiresAt": {
        "format": "date-time",
        "type": [
          "string",
          "null"
        ]
      },
      "id": {
        "format": "int64",
        "type": [
          "integer",
          "null"
        ]
      },
      "status": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "ProjectInviteResponse": {
    "properties": {
      "code": {
        "type": [
          "string",
          "null"
        ]
      },
      "createdAt": {
        "format": "date-time",
        "type": [
          "string",
          "null"
        ]
      },
      "creatorId": {
        "format": "int64",
        "type": [
          "integer",
          "null"
        ]
      },
      "expiresAt": {
        "format": "date-time",
        "type": [
          "string",
          "null"
        ]
      },
      "id": {
        "format": "int64",
        "type": [
          "integer",
          "null"
        ]
      },
      "maxUse": {
        "format": "int32",
        "type": [
          "integer",
          "null"
        ]
      },
      "status": {
        "type": [
          "string",
          "null"
        ]
      },
      "usedCount": {
        "format": "int32",
        "type": [
          "integer",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "ProjectListResponse": {
    "properties": {
      "items": {
        "items": {
          "$ref": "#/components/schemas/ProjectResponse"
        },
        "type": [
          "array",
          "null"
        ]
      },
      "page": {
        "format": "int32",
        "type": [
          "integer",
          "null"
        ]
      },
      "size": {
        "format": "int32",
        "type": [
          "integer",
          "null"
        ]
      },
      "total": {
        "format": "int64",
        "type": [
          "integer",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "ProjectMemberListResponse": {
    "properties": {
      "items": {
        "items": {
          "$ref": "#/components/schemas/ProjectMemberResponse"
        },
        "type": [
          "array",
          "null"
        ]
      },
      "page": {
        "format": "int32",
        "type": [
          "integer",
          "null"
        ]
      },
      "size": {
        "format": "int32",
        "type": [
          "integer",
          "null"
        ]
      },
      "total": {
        "format": "int64",
        "type": [
          "integer",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "ProjectMemberResponse": {
    "properties": {
      "createdAt": {
        "format": "date-time",
        "type": [
          "string",
          "null"
        ]
      },
      "name": {
        "type": [
          "string",
          "null"
        ]
      },
      "role": {
        "type": [
          "string",
          "null"
        ]
      },
      "status": {
        "type": [
          "string",
          "null"
        ]
      },
      "userId": {
        "format": "int64",
        "type": [
          "integer",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "ProjectMemberRoleChangeRequest": {
    "properties": {
      "role": {
        "enum": [
          "OWNER",
          "ADMIN",
          "MEMBER"
        ],
        "type": "string"
      }
    },
    "required": [
      "role"
    ],
    "type": "object"
  },
  "ProjectRenameRequest": {
    "properties": {
      "name": {
        "maxLength": 128,
        "minLength": 0,
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "ProjectResponse": {
    "properties": {
      "createdAt": {
        "format": "date-time",
        "type": [
          "string",
          "null"
        ]
      },
      "name": {
        "type": [
          "string",
          "null"
        ]
      },
      "projectId": {
        "type": [
          "string",
          "null"
        ]
      },
      "role": {
        "type": [
          "string",
          "null"
        ]
      },
      "updatedAt": {
        "format": "date-time",
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "ProjectTransferRequest": {
    "properties": {
      "targetUserId": {
        "format": "int64",
        "type": "integer"
      }
    },
    "required": [
      "targetUserId"
    ],
    "type": "object"
  },
  "RecentVisitItemResponse": {
    "properties": {
      "available": {
        "type": [
          "boolean",
          "null"
        ]
      },
      "description": {
        "type": [
          "string",
          "null"
        ]
      },
      "kbId": {
        "type": [
          "string",
          "null"
        ]
      },
      "projectId": {
        "type": [
          "string",
          "null"
        ]
      },
      "resourceId": {
        "type": [
          "string",
          "null"
        ]
      },
      "resourceType": {
        "type": [
          "string",
          "null"
        ]
      },
      "title": {
        "type": [
          "string",
          "null"
        ]
      },
      "visitedAt": {
        "format": "date-time",
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "RecentVisitPageResponse": {
    "properties": {
      "hasMore": {
        "type": [
          "boolean",
          "null"
        ]
      },
      "items": {
        "items": {
          "$ref": "#/components/schemas/RecentVisitItemResponse"
        },
        "type": [
          "array",
          "null"
        ]
      },
      "nextCursor": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "RegisterInviteRegisterRequest": {
    "properties": {
      "deviceId": {
        "type": [
          "string",
          "null"
        ]
      },
      "email": {
        "minLength": 1,
        "type": [
          "string",
          "null"
        ]
      },
      "inviteCode": {
        "minLength": 1,
        "type": [
          "string",
          "null"
        ]
      },
      "name": {
        "maxLength": 10,
        "minLength": 0,
        "type": [
          "string",
          "null"
        ]
      },
      "password": {
        "maxLength": 50,
        "minLength": 8,
        "type": [
          "string",
          "null"
        ]
      },
      "phone": {
        "minLength": 1,
        "type": [
          "string",
          "null"
        ]
      },
      "rememberMe": {
        "type": [
          "boolean",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "RegisterRequest": {
    "properties": {
      "deviceId": {
        "type": [
          "string",
          "null"
        ]
      },
      "email": {
        "minLength": 1,
        "type": [
          "string",
          "null"
        ]
      },
      "name": {
        "maxLength": 10,
        "minLength": 0,
        "type": [
          "string",
          "null"
        ]
      },
      "password": {
        "maxLength": 50,
        "minLength": 8,
        "type": [
          "string",
          "null"
        ]
      },
      "phone": {
        "minLength": 1,
        "type": [
          "string",
          "null"
        ]
      },
      "rememberMe": {
        "type": [
          "boolean",
          "null"
        ]
      },
      "smsCode": {
        "minLength": 1,
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "ResourceCenterDocOptionResponse": {
    "properties": {
      "docId": {
        "type": [
          "string",
          "null"
        ]
      },
      "name": {
        "type": [
          "string",
          "null"
        ]
      },
      "status": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "ResourceCenterOptionsResponse": {
    "properties": {
      "docs": {
        "items": {
          "$ref": "#/components/schemas/ResourceCenterDocOptionResponse"
        },
        "type": [
          "array",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "SmsCodeRequest": {
    "properties": {
      "phone": {
        "minLength": 1,
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "SseEmitter": {
    "properties": {
      "timeout": {
        "format": "int64",
        "type": [
          "integer",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "TaskCreateRequest": {
    "properties": {
      "changeType": {
        "type": [
          "string",
          "null"
        ]
      },
      "info": {
        "type": [
          "string",
          "null"
        ]
      },
      "kbId": {
        "type": [
          "string",
          "null"
        ]
      },
      "pipelineContext": {
        "additionalProperties": true,
        "type": [
          "object",
          "null"
        ]
      },
      "projectId": {
        "type": [
          "string",
          "null"
        ]
      },
      "status": {
        "type": [
          "string",
          "null"
        ]
      },
      "type": {
        "type": [
          "string",
          "null"
        ]
      },
      "typeId": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "TaskDetailResponse": {
    "properties": {
      "createdAt": {
        "format": "date-time",
        "type": [
          "string",
          "null"
        ]
      },
      "currentStage": {
        "type": [
          "string",
          "null"
        ]
      },
      "projectId": {
        "type": [
          "string",
          "null"
        ]
      },
      "status": {
        "type": [
          "string",
          "null"
        ]
      },
      "taskId": {
        "type": [
          "string",
          "null"
        ]
      },
      "type": {
        "type": [
          "string",
          "null"
        ]
      },
      "typeId": {
        "type": [
          "string",
          "null"
        ]
      },
      "updatedAt": {
        "format": "date-time",
        "type": [
          "string",
          "null"
        ]
      },
      "userId": {
        "format": "int64",
        "type": [
          "integer",
          "null"
        ]
      },
      "viewData": {
        "additionalProperties": true,
        "type": [
          "object",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "TaskListItemResponse": {
    "properties": {
      "createdAt": {
        "format": "date-time",
        "type": [
          "string",
          "null"
        ]
      },
      "currentStage": {
        "type": [
          "string",
          "null"
        ]
      },
      "status": {
        "type": [
          "string",
          "null"
        ]
      },
      "taskId": {
        "type": [
          "string",
          "null"
        ]
      },
      "type": {
        "type": [
          "string",
          "null"
        ]
      },
      "typeId": {
        "type": [
          "string",
          "null"
        ]
      },
      "updatedAt": {
        "format": "date-time",
        "type": [
          "string",
          "null"
        ]
      },
      "viewData": {
        "additionalProperties": true,
        "type": [
          "object",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "TaskListResponse": {
    "properties": {
      "items": {
        "items": {
          "$ref": "#/components/schemas/TaskListItemResponse"
        },
        "type": [
          "array",
          "null"
        ]
      },
      "page": {
        "format": "int32",
        "type": [
          "integer",
          "null"
        ]
      },
      "size": {
        "format": "int32",
        "type": [
          "integer",
          "null"
        ]
      },
      "total": {
        "format": "int64",
        "type": [
          "integer",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "TaskRetryRequest": {
    "properties": {
      "kbId": {
        "type": [
          "string",
          "null"
        ]
      },
      "projectId": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "TaskStatusUpdateRequest": {
    "properties": {
      "changeType": {
        "type": [
          "string",
          "null"
        ]
      },
      "info": {
        "type": [
          "string",
          "null"
        ]
      },
      "projectId": {
        "type": [
          "string",
          "null"
        ]
      },
      "status": {
        "type": [
          "string",
          "null"
        ]
      },
      "viewPatch": {
        "additionalProperties": true,
        "type": [
          "object",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "TemplateRuntimeManifestResponse": {
    "properties": {
      "dataBindings": {
        "additionalProperties": true,
        "type": [
          "object",
          "null"
        ]
      },
      "name": {
        "type": [
          "string",
          "null"
        ]
      },
      "pluginId": {
        "type": [
          "string",
          "null"
        ]
      },
      "promptSchema": {
        "additionalProperties": true,
        "type": [
          "object",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "TextImportRequest": {
    "properties": {
      "kbId": {
        "maxLength": 36,
        "minLength": 0,
        "type": [
          "string",
          "null"
        ]
      },
      "name": {
        "type": [
          "string",
          "null"
        ]
      },
      "projectId": {
        "maxLength": 36,
        "minLength": 0,
        "type": [
          "string",
          "null"
        ]
      },
      "text": {
        "minLength": 1,
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "UploadConfirmRequest": {
    "properties": {
      "docId": {
        "minLength": 1,
        "type": [
          "string",
          "null"
        ]
      },
      "etag": {
        "type": [
          "string",
          "null"
        ]
      },
      "kbId": {
        "minLength": 1,
        "type": [
          "string",
          "null"
        ]
      },
      "name": {
        "type": [
          "string",
          "null"
        ]
      },
      "objectKey": {
        "minLength": 1,
        "type": [
          "string",
          "null"
        ]
      },
      "projectId": {
        "maxLength": 36,
        "minLength": 0,
        "type": [
          "string",
          "null"
        ]
      },
      "size": {
        "format": "int64",
        "type": [
          "integer",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "UploadConfirmResponse": {
    "properties": {
      "status": {
        "type": [
          "string",
          "null"
        ]
      },
      "taskId": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "UploadPolicyResponse": {
    "properties": {
      "expiresAt": {
        "format": "date-time",
        "type": [
          "string",
          "null"
        ]
      },
      "fields": {
        "additionalProperties": {
          "type": "string"
        },
        "type": [
          "object",
          "null"
        ]
      },
      "headers": {
        "additionalProperties": {
          "type": "string"
        },
        "type": [
          "object",
          "null"
        ]
      },
      "method": {
        "type": [
          "string",
          "null"
        ]
      },
      "provider": {
        "type": [
          "string",
          "null"
        ]
      },
      "uploadUrl": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "UploadPrepareRequest": {
    "properties": {
      "docId": {
        "type": [
          "string",
          "null"
        ]
      },
      "fileType": {
        "minLength": 1,
        "type": [
          "string",
          "null"
        ]
      },
      "hash": {
        "type": [
          "string",
          "null"
        ]
      },
      "kbId": {
        "type": [
          "string",
          "null"
        ]
      },
      "projectId": {
        "maxLength": 36,
        "minLength": 0,
        "type": [
          "string",
          "null"
        ]
      },
      "purpose": {
        "type": [
          "string",
          "null"
        ]
      },
      "size": {
        "format": "int64",
        "type": "integer"
      }
    },
    "required": [
      "size"
    ],
    "type": "object"
  },
  "UploadPrepareResponse": {
    "properties": {
      "docId": {
        "type": [
          "string",
          "null"
        ]
      },
      "objectKey": {
        "type": [
          "string",
          "null"
        ]
      },
      "taskId": {
        "type": [
          "string",
          "null"
        ]
      },
      "tempUrl": {
        "type": [
          "string",
          "null"
        ]
      },
      "tempUrlExpiresAt": {
        "format": "date-time",
        "type": [
          "string",
          "null"
        ]
      },
      "uploadPolicy": {
        "$ref": "#/components/schemas/UploadPolicyResponse"
      }
    },
    "type": "object"
  },
  "UrlImportRequest": {
    "properties": {
      "kbId": {
        "minLength": 1,
        "type": [
          "string",
          "null"
        ]
      },
      "name": {
        "type": [
          "string",
          "null"
        ]
      },
      "projectId": {
        "maxLength": 36,
        "minLength": 0,
        "type": [
          "string",
          "null"
        ]
      },
      "url": {
        "minLength": 1,
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "UrlImportResponse": {
    "properties": {
      "docId": {
        "type": [
          "string",
          "null"
        ]
      },
      "status": {
        "type": [
          "string",
          "null"
        ]
      },
      "taskId": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "UsageCurrentCycleResponse": {
    "properties": {
      "available": {
        "format": "int64",
        "type": [
          "integer",
          "null"
        ]
      },
      "cycleId": {
        "format": "int64",
        "type": [
          "integer",
          "null"
        ]
      },
      "metric": {
        "type": [
          "string",
          "null"
        ]
      },
      "projectId": {
        "type": [
          "string",
          "null"
        ]
      },
      "quota": {
        "format": "int64",
        "type": [
          "integer",
          "null"
        ]
      },
      "reserved": {
        "format": "int64",
        "type": [
          "integer",
          "null"
        ]
      },
      "updatedAt": {
        "format": "date-time",
        "type": [
          "string",
          "null"
        ]
      },
      "used": {
        "format": "int64",
        "type": [
          "integer",
          "null"
        ]
      },
      "userId": {
        "format": "int64",
        "type": [
          "integer",
          "null"
        ]
      },
      "validFrom": {
        "format": "date-time",
        "type": [
          "string",
          "null"
        ]
      },
      "validTo": {
        "format": "date-time",
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  },
  "UserResponse": {
    "properties": {
      "email": {
        "type": [
          "string",
          "null"
        ]
      },
      "name": {
        "type": [
          "string",
          "null"
        ]
      },
      "phone": {
        "type": [
          "string",
          "null"
        ]
      },
      "userId": {
        "format": "int64",
        "type": [
          "integer",
          "null"
        ]
      },
      "userMode": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "type": "object"
  }
};

export const BACKEND_ENDPOINT_VALIDATION_BY_MODULE: Record<string, BackendEndpointValidationEntry[]> = {
  "admin": [
    {
      "module": "admin",
      "method": "GET",
      "path": "/admin/invites",
      "operationId": "inviteList",
      "responseSchema": {
        "$ref": "#/components/schemas/ApiResponseAdminInvitePageResponse"
      }
    },
    {
      "module": "admin",
      "method": "GET",
      "path": "/admin/invites/{inviteId}",
      "operationId": "inviteDetail",
      "responseSchema": {
        "$ref": "#/components/schemas/ApiResponseAdminInviteDetailResponse"
      }
    },
    {
      "module": "admin",
      "method": "GET",
      "path": "/admin/register-invites",
      "operationId": "registerInviteList",
      "responseSchema": {
        "$ref": "#/components/schemas/ApiResponseAdminRegisterInvitePageResponse"
      }
    },
    {
      "module": "admin",
      "method": "POST",
      "path": "/admin/register-invites",
      "operationId": "createRegisterInvite",
      "responseSchema": {
        "$ref": "#/components/schemas/ApiResponseListAdminRegisterInviteDetailResponse"
      }
    },
    {
      "module": "admin",
      "method": "GET",
      "path": "/admin/register-invites/{inviteId}",
      "operationId": "registerInviteDetail",
      "responseSchema": {
        "$ref": "#/components/schemas/ApiResponseAdminRegisterInviteDetailResponse"
      }
    },
    {
      "module": "admin",
      "method": "DELETE",
      "path": "/admin/register-invites/{inviteId}",
      "operationId": "deleteRegisterInvite",
      "responseSchema": {
        "$ref": "#/components/schemas/ApiResponseVoid"
      }
    },
    {
      "module": "admin",
      "method": "PUT",
      "path": "/admin/register-invites/{inviteId}:inactive",
      "operationId": "deactivateRegisterInvite",
      "responseSchema": {
        "$ref": "#/components/schemas/ApiResponseAdminRegisterInviteDetailResponse"
      }
    },
    {
      "module": "admin",
      "method": "GET",
      "path": "/admin/task-dlq-incidents",
      "operationId": "taskDlqIncidentList",
      "responseSchema": {
        "$ref": "#/components/schemas/ApiResponseAdminTaskDlqIncidentPageResponse"
      }
    },
    {
      "module": "admin",
      "method": "DELETE",
      "path": "/admin/task-dlq-incidents/{incidentId}",
      "operationId": "deleteTaskDlqIncident",
      "responseSchema": {
        "$ref": "#/components/schemas/ApiResponseVoid"
      }
    },
    {
      "module": "admin",
      "method": "PUT",
      "path": "/admin/task-dlq-incidents/{incidentId}/status",
      "operationId": "updateTaskDlqIncidentStatus",
      "responseSchema": {
        "$ref": "#/components/schemas/ApiResponseAdminTaskDlqIncidentItemResponse"
      }
    },
    {
      "module": "admin",
      "method": "GET",
      "path": "/admin/usage/current-cycle",
      "operationId": "usageCurrentCycle",
      "responseSchema": {
        "$ref": "#/components/schemas/ApiResponseAdminUsageCurrentCycleResponse"
      }
    },
    {
      "module": "admin",
      "method": "GET",
      "path": "/admin/usage/event/list",
      "operationId": "usageEventList",
      "responseSchema": {
        "$ref": "#/components/schemas/ApiResponseAdminUsageEventPageResponse"
      }
    },
    {
      "module": "admin",
      "method": "GET",
      "path": "/admin/usage/summary",
      "operationId": "usageSummary",
      "responseSchema": {
        "$ref": "#/components/schemas/ApiResponseListAdminUsageMetricSummaryResponse"
      }
    },
    {
      "module": "admin",
      "method": "GET",
      "path": "/admin/users/recent-logins",
      "operationId": "recentLogins",
      "responseSchema": {
        "$ref": "#/components/schemas/ApiResponseAdminUserRecentLoginPageResponse"
      }
    },
    {
      "module": "admin",
      "method": "GET",
      "path": "/admin/users/summary",
      "operationId": "userSummary",
      "responseSchema": {
        "$ref": "#/components/schemas/ApiResponseAdminUserSummaryResponse"
      }
    },
    {
      "module": "admin",
      "method": "GET",
      "path": "/admin/users/{userId}",
      "operationId": "userDetail",
      "responseSchema": {
        "$ref": "#/components/schemas/ApiResponseAdminUserRecentLoginItemResponse"
      }
    },
    {
      "module": "admin",
      "method": "GET",
      "path": "/admin/users/{userId}/subscription-cycles",
      "operationId": "userSubscriptionCycles",
      "responseSchema": {
        "$ref": "#/components/schemas/ApiResponseListAdminUserSubscriptionCycleResponse"
      }
    },
    {
      "module": "admin",
      "method": "PUT",
      "path": "/admin/users/{userId}/subscription-cycles/{metric}",
      "operationId": "updateUserSubscriptionCycle",
      "responseSchema": {
        "$ref": "#/components/schemas/ApiResponseAdminUserSubscriptionCycleResponse"
      }
    }
  ],
  "auth": [
    {
      "module": "auth",
      "method": "POST",
      "path": "/auth/login",
      "operationId": "login",
      "responseSchema": {
        "$ref": "#/components/schemas/ApiResponseUserResponse"
      }
    },
    {
      "module": "auth",
      "method": "POST",
      "path": "/auth/logout",
      "operationId": "logout",
      "responseSchema": {
        "$ref": "#/components/schemas/ApiResponseVoid"
      }
    },
    {
      "module": "auth",
      "method": "GET",
      "path": "/auth/me",
      "operationId": "me",
      "responseSchema": {
        "$ref": "#/components/schemas/ApiResponseUserResponse"
      }
    },
    {
      "module": "auth",
      "method": "POST",
      "path": "/auth/register",
      "operationId": "register",
      "responseSchema": {
        "$ref": "#/components/schemas/ApiResponseUserResponse"
      }
    },
    {
      "module": "auth",
      "method": "POST",
      "path": "/auth/register/invite",
      "operationId": "registerWithInvite",
      "responseSchema": {
        "$ref": "#/components/schemas/ApiResponseUserResponse"
      }
    },
    {
      "module": "auth",
      "method": "POST",
      "path": "/auth/sms-code",
      "operationId": "sendSmsCode",
      "responseSchema": {
        "$ref": "#/components/schemas/ApiResponseVoid"
      }
    }
  ],
  "kb": [
    {
      "module": "kb",
      "method": "GET",
      "path": "/kb/docs",
      "operationId": "list_3",
      "responseSchema": {
        "$ref": "#/components/schemas/ApiResponseKbDocListResponse"
      }
    },
    {
      "module": "kb",
      "method": "POST",
      "path": "/kb/docs/bind",
      "operationId": "bind",
      "responseSchema": {
        "$ref": "#/components/schemas/ApiResponseBoolean"
      }
    },
    {
      "module": "kb",
      "method": "DELETE",
      "path": "/kb/docs/bind",
      "operationId": "unbind",
      "responseSchema": {
        "$ref": "#/components/schemas/ApiResponseBoolean"
      }
    },
    {
      "module": "kb",
      "method": "POST",
      "path": "/kb/docs/import/text",
      "operationId": "importText",
      "responseSchema": {
        "$ref": "#/components/schemas/ApiResponseUrlImportResponse"
      }
    },
    {
      "module": "kb",
      "method": "POST",
      "path": "/kb/docs/import/url",
      "operationId": "importUrl",
      "responseSchema": {
        "$ref": "#/components/schemas/ApiResponseUrlImportResponse"
      }
    },
    {
      "module": "kb",
      "method": "GET",
      "path": "/kb/docs/options",
      "operationId": "listOptions",
      "responseSchema": {
        "$ref": "#/components/schemas/ApiResponseListKbDocOptionItemResponse"
      }
    },
    {
      "module": "kb",
      "method": "POST",
      "path": "/kb/docs/preview/credentials",
      "operationId": "previewCredentials",
      "responseSchema": {
        "$ref": "#/components/schemas/ApiResponsePreviewCredentialsResponse"
      }
    },
    {
      "module": "kb",
      "method": "GET",
      "path": "/kb/docs/recent",
      "operationId": "recent_2",
      "responseSchema": {
        "$ref": "#/components/schemas/ApiResponseListString"
      }
    },
    {
      "module": "kb",
      "method": "POST",
      "path": "/kb/docs/upload/confirm",
      "operationId": "confirm",
      "responseSchema": {
        "$ref": "#/components/schemas/ApiResponseUploadConfirmResponse"
      }
    },
    {
      "module": "kb",
      "method": "POST",
      "path": "/kb/docs/upload/prepare",
      "operationId": "prepare",
      "responseSchema": {
        "$ref": "#/components/schemas/ApiResponseUploadPrepareResponse"
      }
    },
    {
      "module": "kb",
      "method": "GET",
      "path": "/kb/docs/{docId}",
      "operationId": "detail",
      "responseSchema": {
        "$ref": "#/components/schemas/ApiResponseKbDocDetailResponse"
      }
    },
    {
      "module": "kb",
      "method": "PATCH",
      "path": "/kb/docs/{docId}",
      "operationId": "updateDetail",
      "responseSchema": {
        "$ref": "#/components/schemas/ApiResponseKbDocDetailResponse"
      }
    },
    {
      "module": "kb",
      "method": "DELETE",
      "path": "/kb/docs/{docId}",
      "operationId": "delete_2",
      "responseSchema": {
        "$ref": "#/components/schemas/ApiResponseBoolean"
      }
    },
    {
      "module": "kb",
      "method": "GET",
      "path": "/kb/docs/{docId}/text-chunks",
      "operationId": "listTextChunks",
      "responseSchema": {
        "$ref": "#/components/schemas/ApiResponseKbDocTextChunkPageResponse"
      }
    },
    {
      "module": "kb",
      "method": "GET",
      "path": "/kb/recent",
      "operationId": "recent_3",
      "responseSchema": {
        "$ref": "#/components/schemas/ApiResponseListString"
      }
    }
  ],
  "knowledge-bases": [
    {
      "module": "knowledge-bases",
      "method": "GET",
      "path": "/knowledge-bases",
      "operationId": "list_2",
      "responseSchema": {
        "$ref": "#/components/schemas/ApiResponseKnowledgeBaseListResponse"
      }
    },
    {
      "module": "knowledge-bases",
      "method": "POST",
      "path": "/knowledge-bases",
      "operationId": "create_2",
      "responseSchema": {
        "$ref": "#/components/schemas/ApiResponseKnowledgeBaseResponse"
      }
    },
    {
      "module": "knowledge-bases",
      "method": "GET",
      "path": "/knowledge-bases/recent",
      "operationId": "recent_1",
      "responseSchema": {
        "$ref": "#/components/schemas/ApiResponseListKnowledgeBaseResponse"
      }
    },
    {
      "module": "knowledge-bases",
      "method": "GET",
      "path": "/knowledge-bases/{kbId}",
      "operationId": "get",
      "responseSchema": {
        "$ref": "#/components/schemas/ApiResponseKnowledgeBaseResponse"
      }
    },
    {
      "module": "knowledge-bases",
      "method": "PATCH",
      "path": "/knowledge-bases/{kbId}",
      "operationId": "update",
      "responseSchema": {
        "$ref": "#/components/schemas/ApiResponseKnowledgeBaseResponse"
      }
    },
    {
      "module": "knowledge-bases",
      "method": "GET",
      "path": "/knowledge-bases/{kbId}/canvas",
      "operationId": "getCanvas",
      "responseSchema": {
        "$ref": "#/components/schemas/ApiResponseKnowledgeBaseCanvasResponse"
      }
    },
    {
      "module": "knowledge-bases",
      "method": "PATCH",
      "path": "/knowledge-bases/{kbId}/canvas",
      "operationId": "updateCanvas",
      "responseSchema": {
        "$ref": "#/components/schemas/ApiResponseKnowledgeBaseCanvasResponse"
      }
    }
  ],
  "projects": [
    {
      "module": "projects",
      "method": "GET",
      "path": "/projects",
      "operationId": "list_1",
      "responseSchema": {
        "$ref": "#/components/schemas/ApiResponseProjectListResponse"
      }
    },
    {
      "module": "projects",
      "method": "POST",
      "path": "/projects",
      "operationId": "create_1",
      "responseSchema": {
        "$ref": "#/components/schemas/ApiResponseProjectResponse"
      }
    },
    {
      "module": "projects",
      "method": "POST",
      "path": "/projects/invites/accept",
      "operationId": "acceptInvite",
      "responseSchema": {
        "$ref": "#/components/schemas/ApiResponseProjectResponse"
      }
    },
    {
      "module": "projects",
      "method": "PATCH",
      "path": "/projects/{projectId}",
      "operationId": "rename",
      "responseSchema": {
        "$ref": "#/components/schemas/ApiResponseProjectResponse"
      }
    },
    {
      "module": "projects",
      "method": "GET",
      "path": "/projects/{projectId}/invites",
      "operationId": "listInvites",
      "responseSchema": {
        "$ref": "#/components/schemas/ApiResponseListProjectInviteResponse"
      }
    },
    {
      "module": "projects",
      "method": "POST",
      "path": "/projects/{projectId}/invites",
      "operationId": "createInvite",
      "responseSchema": {
        "$ref": "#/components/schemas/ApiResponseProjectInviteCreateResponse"
      }
    },
    {
      "module": "projects",
      "method": "GET",
      "path": "/projects/{projectId}/members",
      "operationId": "members",
      "responseSchema": {
        "$ref": "#/components/schemas/ApiResponseProjectMemberListResponse"
      }
    }
  ],
  "resource-center": [
    {
      "module": "resource-center",
      "method": "GET",
      "path": "/resource-center/options",
      "operationId": "options",
      "responseSchema": {
        "$ref": "#/components/schemas/ApiResponseResourceCenterOptionsResponse"
      }
    }
  ],
  "skills": [
    {
      "module": "skills",
      "method": "POST",
      "path": "/skills/kb/token",
      "operationId": "createToken",
      "responseSchema": {
        "$ref": "#/components/schemas/ApiResponseKbSkillTokenResponse"
      }
    },
    {
      "module": "skills",
      "method": "POST",
      "path": "/skills/search",
      "operationId": "createSearch",
      "responseSchema": {
        "$ref": "#/components/schemas/ApiResponseKbSkillSearchResponse"
      }
    },
    {
      "module": "skills",
      "method": "GET",
      "path": "/skills/tasks",
      "operationId": "skillTaskDetail",
      "responseSchema": {
        "$ref": "#/components/schemas/ApiResponseKbSkillSearchResponse"
      }
    }
  ],
  "tasks": [
    {
      "module": "tasks",
      "method": "GET",
      "path": "/tasks",
      "operationId": "list",
      "responseSchema": {
        "$ref": "#/components/schemas/ApiResponseTaskListResponse"
      }
    },
    {
      "module": "tasks",
      "method": "POST",
      "path": "/tasks",
      "operationId": "create",
      "responseSchema": {
        "$ref": "#/components/schemas/ApiResponseTaskDetailResponse"
      }
    },
    {
      "module": "tasks",
      "method": "GET",
      "path": "/tasks/{taskId}",
      "operationId": "detail_1",
      "responseSchema": {
        "$ref": "#/components/schemas/ApiResponseTaskDetailResponse"
      }
    },
    {
      "module": "tasks",
      "method": "POST",
      "path": "/tasks/{taskId}/retry",
      "operationId": "retryTask",
      "responseSchema": {
        "$ref": "#/components/schemas/ApiResponseBoolean"
      }
    },
    {
      "module": "tasks",
      "method": "POST",
      "path": "/tasks/{taskRecordId}/status",
      "operationId": "updateTaskStatus",
      "responseSchema": {
        "$ref": "#/components/schemas/ApiResponseBoolean"
      }
    }
  ],
  "templates": [
    {
      "module": "templates",
      "method": "GET",
      "path": "/templates/plugin-manifest",
      "operationId": "runtimeManifest",
      "responseSchema": {
        "$ref": "#/components/schemas/ApiResponseTemplateRuntimeManifestResponse"
      }
    }
  ],
  "usage": [
    {
      "module": "usage",
      "method": "GET",
      "path": "/usage/current-cycle",
      "operationId": "currentCycleUsage",
      "responseSchema": {
        "$ref": "#/components/schemas/ApiResponseUsageCurrentCycleResponse"
      }
    }
  ],
  "visits": [
    {
      "module": "visits",
      "method": "GET",
      "path": "/visits/recent",
      "operationId": "recent",
      "responseSchema": {
        "$ref": "#/components/schemas/ApiResponseRecentVisitPageResponse"
      }
    }
  ],
  "sse": [
    {
      "module": "sse",
      "method": "GET",
      "path": "/sse/tasks",
      "operationId": "subscribe",
      "responseSchema": {
        "$ref": "#/components/schemas/SseEmitter"
      }
    }
  ]
};

export const BACKEND_ENDPOINT_VALIDATION: BackendEndpointValidationEntry[] = [
  {
    "module": "admin",
    "method": "GET",
    "path": "/admin/invites",
    "operationId": "inviteList",
    "responseSchema": {
      "$ref": "#/components/schemas/ApiResponseAdminInvitePageResponse"
    }
  },
  {
    "module": "admin",
    "method": "GET",
    "path": "/admin/invites/{inviteId}",
    "operationId": "inviteDetail",
    "responseSchema": {
      "$ref": "#/components/schemas/ApiResponseAdminInviteDetailResponse"
    }
  },
  {
    "module": "admin",
    "method": "GET",
    "path": "/admin/register-invites",
    "operationId": "registerInviteList",
    "responseSchema": {
      "$ref": "#/components/schemas/ApiResponseAdminRegisterInvitePageResponse"
    }
  },
  {
    "module": "admin",
    "method": "POST",
    "path": "/admin/register-invites",
    "operationId": "createRegisterInvite",
    "responseSchema": {
      "$ref": "#/components/schemas/ApiResponseListAdminRegisterInviteDetailResponse"
    }
  },
  {
    "module": "admin",
    "method": "GET",
    "path": "/admin/register-invites/{inviteId}",
    "operationId": "registerInviteDetail",
    "responseSchema": {
      "$ref": "#/components/schemas/ApiResponseAdminRegisterInviteDetailResponse"
    }
  },
  {
    "module": "admin",
    "method": "DELETE",
    "path": "/admin/register-invites/{inviteId}",
    "operationId": "deleteRegisterInvite",
    "responseSchema": {
      "$ref": "#/components/schemas/ApiResponseVoid"
    }
  },
  {
    "module": "admin",
    "method": "PUT",
    "path": "/admin/register-invites/{inviteId}:inactive",
    "operationId": "deactivateRegisterInvite",
    "responseSchema": {
      "$ref": "#/components/schemas/ApiResponseAdminRegisterInviteDetailResponse"
    }
  },
  {
    "module": "admin",
    "method": "GET",
    "path": "/admin/task-dlq-incidents",
    "operationId": "taskDlqIncidentList",
    "responseSchema": {
      "$ref": "#/components/schemas/ApiResponseAdminTaskDlqIncidentPageResponse"
    }
  },
  {
    "module": "admin",
    "method": "DELETE",
    "path": "/admin/task-dlq-incidents/{incidentId}",
    "operationId": "deleteTaskDlqIncident",
    "responseSchema": {
      "$ref": "#/components/schemas/ApiResponseVoid"
    }
  },
  {
    "module": "admin",
    "method": "PUT",
    "path": "/admin/task-dlq-incidents/{incidentId}/status",
    "operationId": "updateTaskDlqIncidentStatus",
    "responseSchema": {
      "$ref": "#/components/schemas/ApiResponseAdminTaskDlqIncidentItemResponse"
    }
  },
  {
    "module": "admin",
    "method": "GET",
    "path": "/admin/usage/current-cycle",
    "operationId": "usageCurrentCycle",
    "responseSchema": {
      "$ref": "#/components/schemas/ApiResponseAdminUsageCurrentCycleResponse"
    }
  },
  {
    "module": "admin",
    "method": "GET",
    "path": "/admin/usage/event/list",
    "operationId": "usageEventList",
    "responseSchema": {
      "$ref": "#/components/schemas/ApiResponseAdminUsageEventPageResponse"
    }
  },
  {
    "module": "admin",
    "method": "GET",
    "path": "/admin/usage/summary",
    "operationId": "usageSummary",
    "responseSchema": {
      "$ref": "#/components/schemas/ApiResponseListAdminUsageMetricSummaryResponse"
    }
  },
  {
    "module": "admin",
    "method": "GET",
    "path": "/admin/users/recent-logins",
    "operationId": "recentLogins",
    "responseSchema": {
      "$ref": "#/components/schemas/ApiResponseAdminUserRecentLoginPageResponse"
    }
  },
  {
    "module": "admin",
    "method": "GET",
    "path": "/admin/users/summary",
    "operationId": "userSummary",
    "responseSchema": {
      "$ref": "#/components/schemas/ApiResponseAdminUserSummaryResponse"
    }
  },
  {
    "module": "admin",
    "method": "GET",
    "path": "/admin/users/{userId}",
    "operationId": "userDetail",
    "responseSchema": {
      "$ref": "#/components/schemas/ApiResponseAdminUserRecentLoginItemResponse"
    }
  },
  {
    "module": "admin",
    "method": "GET",
    "path": "/admin/users/{userId}/subscription-cycles",
    "operationId": "userSubscriptionCycles",
    "responseSchema": {
      "$ref": "#/components/schemas/ApiResponseListAdminUserSubscriptionCycleResponse"
    }
  },
  {
    "module": "admin",
    "method": "PUT",
    "path": "/admin/users/{userId}/subscription-cycles/{metric}",
    "operationId": "updateUserSubscriptionCycle",
    "responseSchema": {
      "$ref": "#/components/schemas/ApiResponseAdminUserSubscriptionCycleResponse"
    }
  },
  {
    "module": "auth",
    "method": "POST",
    "path": "/auth/login",
    "operationId": "login",
    "responseSchema": {
      "$ref": "#/components/schemas/ApiResponseUserResponse"
    }
  },
  {
    "module": "auth",
    "method": "POST",
    "path": "/auth/logout",
    "operationId": "logout",
    "responseSchema": {
      "$ref": "#/components/schemas/ApiResponseVoid"
    }
  },
  {
    "module": "auth",
    "method": "GET",
    "path": "/auth/me",
    "operationId": "me",
    "responseSchema": {
      "$ref": "#/components/schemas/ApiResponseUserResponse"
    }
  },
  {
    "module": "auth",
    "method": "POST",
    "path": "/auth/register",
    "operationId": "register",
    "responseSchema": {
      "$ref": "#/components/schemas/ApiResponseUserResponse"
    }
  },
  {
    "module": "auth",
    "method": "POST",
    "path": "/auth/register/invite",
    "operationId": "registerWithInvite",
    "responseSchema": {
      "$ref": "#/components/schemas/ApiResponseUserResponse"
    }
  },
  {
    "module": "auth",
    "method": "POST",
    "path": "/auth/sms-code",
    "operationId": "sendSmsCode",
    "responseSchema": {
      "$ref": "#/components/schemas/ApiResponseVoid"
    }
  },
  {
    "module": "kb",
    "method": "GET",
    "path": "/kb/docs",
    "operationId": "list_3",
    "responseSchema": {
      "$ref": "#/components/schemas/ApiResponseKbDocListResponse"
    }
  },
  {
    "module": "kb",
    "method": "POST",
    "path": "/kb/docs/bind",
    "operationId": "bind",
    "responseSchema": {
      "$ref": "#/components/schemas/ApiResponseBoolean"
    }
  },
  {
    "module": "kb",
    "method": "DELETE",
    "path": "/kb/docs/bind",
    "operationId": "unbind",
    "responseSchema": {
      "$ref": "#/components/schemas/ApiResponseBoolean"
    }
  },
  {
    "module": "kb",
    "method": "POST",
    "path": "/kb/docs/import/text",
    "operationId": "importText",
    "responseSchema": {
      "$ref": "#/components/schemas/ApiResponseUrlImportResponse"
    }
  },
  {
    "module": "kb",
    "method": "POST",
    "path": "/kb/docs/import/url",
    "operationId": "importUrl",
    "responseSchema": {
      "$ref": "#/components/schemas/ApiResponseUrlImportResponse"
    }
  },
  {
    "module": "kb",
    "method": "GET",
    "path": "/kb/docs/options",
    "operationId": "listOptions",
    "responseSchema": {
      "$ref": "#/components/schemas/ApiResponseListKbDocOptionItemResponse"
    }
  },
  {
    "module": "kb",
    "method": "POST",
    "path": "/kb/docs/preview/credentials",
    "operationId": "previewCredentials",
    "responseSchema": {
      "$ref": "#/components/schemas/ApiResponsePreviewCredentialsResponse"
    }
  },
  {
    "module": "kb",
    "method": "GET",
    "path": "/kb/docs/recent",
    "operationId": "recent_2",
    "responseSchema": {
      "$ref": "#/components/schemas/ApiResponseListString"
    }
  },
  {
    "module": "kb",
    "method": "POST",
    "path": "/kb/docs/upload/confirm",
    "operationId": "confirm",
    "responseSchema": {
      "$ref": "#/components/schemas/ApiResponseUploadConfirmResponse"
    }
  },
  {
    "module": "kb",
    "method": "POST",
    "path": "/kb/docs/upload/prepare",
    "operationId": "prepare",
    "responseSchema": {
      "$ref": "#/components/schemas/ApiResponseUploadPrepareResponse"
    }
  },
  {
    "module": "kb",
    "method": "GET",
    "path": "/kb/docs/{docId}",
    "operationId": "detail",
    "responseSchema": {
      "$ref": "#/components/schemas/ApiResponseKbDocDetailResponse"
    }
  },
  {
    "module": "kb",
    "method": "PATCH",
    "path": "/kb/docs/{docId}",
    "operationId": "updateDetail",
    "responseSchema": {
      "$ref": "#/components/schemas/ApiResponseKbDocDetailResponse"
    }
  },
  {
    "module": "kb",
    "method": "DELETE",
    "path": "/kb/docs/{docId}",
    "operationId": "delete_2",
    "responseSchema": {
      "$ref": "#/components/schemas/ApiResponseBoolean"
    }
  },
  {
    "module": "kb",
    "method": "GET",
    "path": "/kb/docs/{docId}/text-chunks",
    "operationId": "listTextChunks",
    "responseSchema": {
      "$ref": "#/components/schemas/ApiResponseKbDocTextChunkPageResponse"
    }
  },
  {
    "module": "kb",
    "method": "GET",
    "path": "/kb/recent",
    "operationId": "recent_3",
    "responseSchema": {
      "$ref": "#/components/schemas/ApiResponseListString"
    }
  },
  {
    "module": "knowledge-bases",
    "method": "GET",
    "path": "/knowledge-bases",
    "operationId": "list_2",
    "responseSchema": {
      "$ref": "#/components/schemas/ApiResponseKnowledgeBaseListResponse"
    }
  },
  {
    "module": "knowledge-bases",
    "method": "POST",
    "path": "/knowledge-bases",
    "operationId": "create_2",
    "responseSchema": {
      "$ref": "#/components/schemas/ApiResponseKnowledgeBaseResponse"
    }
  },
  {
    "module": "knowledge-bases",
    "method": "GET",
    "path": "/knowledge-bases/recent",
    "operationId": "recent_1",
    "responseSchema": {
      "$ref": "#/components/schemas/ApiResponseListKnowledgeBaseResponse"
    }
  },
  {
    "module": "knowledge-bases",
    "method": "GET",
    "path": "/knowledge-bases/{kbId}",
    "operationId": "get",
    "responseSchema": {
      "$ref": "#/components/schemas/ApiResponseKnowledgeBaseResponse"
    }
  },
  {
    "module": "knowledge-bases",
    "method": "PATCH",
    "path": "/knowledge-bases/{kbId}",
    "operationId": "update",
    "responseSchema": {
      "$ref": "#/components/schemas/ApiResponseKnowledgeBaseResponse"
    }
  },
  {
    "module": "knowledge-bases",
    "method": "GET",
    "path": "/knowledge-bases/{kbId}/canvas",
    "operationId": "getCanvas",
    "responseSchema": {
      "$ref": "#/components/schemas/ApiResponseKnowledgeBaseCanvasResponse"
    }
  },
  {
    "module": "knowledge-bases",
    "method": "PATCH",
    "path": "/knowledge-bases/{kbId}/canvas",
    "operationId": "updateCanvas",
    "responseSchema": {
      "$ref": "#/components/schemas/ApiResponseKnowledgeBaseCanvasResponse"
    }
  },
  {
    "module": "projects",
    "method": "GET",
    "path": "/projects",
    "operationId": "list_1",
    "responseSchema": {
      "$ref": "#/components/schemas/ApiResponseProjectListResponse"
    }
  },
  {
    "module": "projects",
    "method": "POST",
    "path": "/projects",
    "operationId": "create_1",
    "responseSchema": {
      "$ref": "#/components/schemas/ApiResponseProjectResponse"
    }
  },
  {
    "module": "projects",
    "method": "POST",
    "path": "/projects/invites/accept",
    "operationId": "acceptInvite",
    "responseSchema": {
      "$ref": "#/components/schemas/ApiResponseProjectResponse"
    }
  },
  {
    "module": "projects",
    "method": "PATCH",
    "path": "/projects/{projectId}",
    "operationId": "rename",
    "responseSchema": {
      "$ref": "#/components/schemas/ApiResponseProjectResponse"
    }
  },
  {
    "module": "projects",
    "method": "GET",
    "path": "/projects/{projectId}/invites",
    "operationId": "listInvites",
    "responseSchema": {
      "$ref": "#/components/schemas/ApiResponseListProjectInviteResponse"
    }
  },
  {
    "module": "projects",
    "method": "POST",
    "path": "/projects/{projectId}/invites",
    "operationId": "createInvite",
    "responseSchema": {
      "$ref": "#/components/schemas/ApiResponseProjectInviteCreateResponse"
    }
  },
  {
    "module": "projects",
    "method": "GET",
    "path": "/projects/{projectId}/members",
    "operationId": "members",
    "responseSchema": {
      "$ref": "#/components/schemas/ApiResponseProjectMemberListResponse"
    }
  },
  {
    "module": "resource-center",
    "method": "GET",
    "path": "/resource-center/options",
    "operationId": "options",
    "responseSchema": {
      "$ref": "#/components/schemas/ApiResponseResourceCenterOptionsResponse"
    }
  },
  {
    "module": "skills",
    "method": "POST",
    "path": "/skills/kb/token",
    "operationId": "createToken",
    "responseSchema": {
      "$ref": "#/components/schemas/ApiResponseKbSkillTokenResponse"
    }
  },
  {
    "module": "skills",
    "method": "POST",
    "path": "/skills/search",
    "operationId": "createSearch",
    "responseSchema": {
      "$ref": "#/components/schemas/ApiResponseKbSkillSearchResponse"
    }
  },
  {
    "module": "skills",
    "method": "GET",
    "path": "/skills/tasks",
    "operationId": "skillTaskDetail",
    "responseSchema": {
      "$ref": "#/components/schemas/ApiResponseKbSkillSearchResponse"
    }
  },
  {
    "module": "tasks",
    "method": "GET",
    "path": "/tasks",
    "operationId": "list",
    "responseSchema": {
      "$ref": "#/components/schemas/ApiResponseTaskListResponse"
    }
  },
  {
    "module": "tasks",
    "method": "POST",
    "path": "/tasks",
    "operationId": "create",
    "responseSchema": {
      "$ref": "#/components/schemas/ApiResponseTaskDetailResponse"
    }
  },
  {
    "module": "tasks",
    "method": "GET",
    "path": "/tasks/{taskId}",
    "operationId": "detail_1",
    "responseSchema": {
      "$ref": "#/components/schemas/ApiResponseTaskDetailResponse"
    }
  },
  {
    "module": "tasks",
    "method": "POST",
    "path": "/tasks/{taskId}/retry",
    "operationId": "retryTask",
    "responseSchema": {
      "$ref": "#/components/schemas/ApiResponseBoolean"
    }
  },
  {
    "module": "tasks",
    "method": "POST",
    "path": "/tasks/{taskRecordId}/status",
    "operationId": "updateTaskStatus",
    "responseSchema": {
      "$ref": "#/components/schemas/ApiResponseBoolean"
    }
  },
  {
    "module": "templates",
    "method": "GET",
    "path": "/templates/plugin-manifest",
    "operationId": "runtimeManifest",
    "responseSchema": {
      "$ref": "#/components/schemas/ApiResponseTemplateRuntimeManifestResponse"
    }
  },
  {
    "module": "usage",
    "method": "GET",
    "path": "/usage/current-cycle",
    "operationId": "currentCycleUsage",
    "responseSchema": {
      "$ref": "#/components/schemas/ApiResponseUsageCurrentCycleResponse"
    }
  },
  {
    "module": "visits",
    "method": "GET",
    "path": "/visits/recent",
    "operationId": "recent",
    "responseSchema": {
      "$ref": "#/components/schemas/ApiResponseRecentVisitPageResponse"
    }
  },
  {
    "module": "sse",
    "method": "GET",
    "path": "/sse/tasks",
    "operationId": "subscribe",
    "responseSchema": {
      "$ref": "#/components/schemas/SseEmitter"
    }
  }
];
