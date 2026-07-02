// client 封装应用级 axios 实例，负责构造 baseURL、content-type、包含凭据与统一错误处理。
import axios, { type AxiosError, type AxiosRequestConfig } from 'axios';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { z } from 'zod';
import { getRuntimeEndpoints } from '@/shared/config/endpoints';
import {
  BACKEND_COMPONENT_SCHEMAS,
  BACKEND_ENDPOINT_VALIDATION_BY_MODULE,
  type BackendEndpointValidationEntry,
} from './backend.validation.generated';
import type { ApiRequestInit } from './types';

const { apiBaseUrl: BASE_URL } = getRuntimeEndpoints();

const buildPath = (path: string) => (path.startsWith('/') ? path : `/${path}`);

const apiClient = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

const ajv = new Ajv2020({
  allErrors: true,
  strict: false,
});
addFormats(ajv);
const responseValidatorCache = new Map<string, ReturnType<Ajv2020['compile']>>();

const apiResponseEnvelopeSchema = z.object({
  code: z.string(),
  message: z.string(),
  data: z.unknown(),
});

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const shouldValidateApiEnvelope = (payload: unknown): payload is Record<string, unknown> =>
  isObjectRecord(payload) && ('code' in payload || 'message' in payload || 'data' in payload);

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const toPathRegex = (templatePath: string) => {
  const pattern = templatePath
    .split('/')
    .map((segment) => {
      if (!segment) return '';
      if (segment.startsWith('{') && segment.endsWith('}')) {
        return '[^/]+';
      }
      return escapeRegExp(segment);
    })
    .join('/');
  return new RegExp(`^${pattern}$`);
};

const extractModuleFromPath = (path: string) => {
  const segs = path.split('/').filter(Boolean);
  if (segs.length === 0) return 'root';
  return segs[0];
};

const responseSchemaKey = (entry: BackendEndpointValidationEntry) => `${entry.method} ${entry.path}`;

const compileResponseValidator = (entry: BackendEndpointValidationEntry) => {
  const key = responseSchemaKey(entry);
  const cached = responseValidatorCache.get(key);
  if (cached) {
    return cached;
  }
  const rootSchema = {
    ...(entry.responseSchema as Record<string, unknown>),
    components: {
      schemas: BACKEND_COMPONENT_SCHEMAS,
    },
  };
  const validator = ajv.compile(rootSchema);
  responseValidatorCache.set(key, validator);
  return validator;
};

const findEndpointValidation = (method: string, path: string) => {
  const normalizedMethod = method.toUpperCase();
  const module = extractModuleFromPath(path);
  const moduleEntries = BACKEND_ENDPOINT_VALIDATION_BY_MODULE[module] ?? [];
  return moduleEntries.find(
    (entry) => entry.method === normalizedMethod && toPathRegex(entry.path).test(path),
  );
};

const logResponseValidationFailure = (params: {
  method: string;
  requestPath: string;
  operationPath: string;
  operationId: string;
  response: unknown;
  errors: unknown;
}) => {
  const toPrintable = (value: unknown) => {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  };
  console.error('[api-validation] 响应 data 校验失败', params);
  console.error('[api-validation] 详细 errors:\n' + toPrintable(params.errors));
  console.error('[api-validation] 详细 response:\n' + toPrintable(params.response));
};

export interface ApiError extends Error {
  status?: number;
  code?: string;
  raw?: unknown;
}

const createApiError = (message: string): ApiError => {
  const apiError = new Error(message) as ApiError;
  apiError.name = 'ApiError';
  return apiError;
};

export const apiRequest = async <T = unknown>(path: string, options: ApiRequestInit = {}): Promise<T> => {
  const { body, headers, method, ...rest } = options;
  const requestMethod = (method ?? (body ? 'POST' : 'GET')) as AxiosRequestConfig['method'];
  const requestPath = buildPath(path);
  const isFormDataBody = typeof FormData !== 'undefined' && body instanceof FormData;
  const requestConfig: AxiosRequestConfig = {
    url: requestPath,
    method: requestMethod,
    headers: isFormDataBody
      ? {
          ...headers,
        }
      : {
          'Content-Type': 'application/json',
          ...headers,
        },
    data: body ?? undefined,
    ...rest,
  };

  try {
    const response = await apiClient.request<T>(requestConfig);
    const payload = response.data as unknown;
    const endpointValidation = findEndpointValidation(String(requestMethod), requestPath);
    if (shouldValidateApiEnvelope(payload)) {
      const parsed = apiResponseEnvelopeSchema.safeParse(payload);
      if (!parsed.success) {
        const apiError = createApiError('响应格式不符合 ApiResponse 约定');
        apiError.status = response.status;
        apiError.raw = payload;
        throw apiError;
      }
      if (parsed.data.code === 'OK' && endpointValidation) {
        const validator = compileResponseValidator(endpointValidation);
        if (!validator(parsed.data)) {
          logResponseValidationFailure({
            method: String(requestMethod).toUpperCase(),
            requestPath,
            operationPath: endpointValidation.path,
            operationId: endpointValidation.operationId,
            response: parsed.data,
            errors: validator.errors,
          });
          const apiError = createApiError(
            `响应 data 校验失败: ${endpointValidation.method} ${endpointValidation.path}`,
          );
          apiError.status = response.status;
          apiError.raw = {
            response: parsed.data,
            errors: validator.errors,
          };
          throw apiError;
        }
      }
      return parsed.data as T;
    }
    if (endpointValidation) {
      const validator = compileResponseValidator(endpointValidation);
      if (!validator(payload)) {
        logResponseValidationFailure({
          method: String(requestMethod).toUpperCase(),
          requestPath,
          operationPath: endpointValidation.path,
          operationId: endpointValidation.operationId,
          response: payload,
          errors: validator.errors,
        });
        const apiError = createApiError(
          `响应 data 校验失败: ${endpointValidation.method} ${endpointValidation.path}`,
        );
        apiError.status = response.status;
        apiError.raw = {
          response: payload,
          errors: validator.errors,
        };
        throw apiError;
      }
    }
    return payload as T;
  } catch (error) {
    if (error instanceof Error && error.name === 'ApiError') {
      throw error;
    }
    const axiosError = error as AxiosError<unknown>;
    const payload = axiosError.response?.data;
    const message =
      (payload as { message?: string })?.message ?? axiosError.message ?? '请求失败';
    const apiError = createApiError(message);
    apiError.status = axiosError.response?.status;
    if (payload && typeof payload === 'object') {
      const code = (payload as { code?: string }).code;
      if (code) {
        apiError.code = code;
      }
    }
    apiError.raw = payload ?? axiosError.response?.data;
    throw apiError;
  }
};
