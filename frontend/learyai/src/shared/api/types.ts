// types 为 shared api 提供请求选项类型与通用响应结构。
import type { AxiosRequestConfig } from 'axios';
import type { components } from './backend.generated';

type BackendSchemas = components['schemas'];
type AnyApiResponse = BackendSchemas['ApiResponseProjectListResponse'];

export interface ApiRequestInit extends Omit<AxiosRequestConfig, 'data' | 'url'> {
  body?: AxiosRequestConfig['data'];
  params?: AxiosRequestConfig['params'];
  headers?: AxiosRequestConfig['headers'];
  method?: AxiosRequestConfig['method'];
}

export interface ApiResponse<T> extends Omit<AnyApiResponse, 'data'> {
  code: string;
  message: string;
  data: T;
}
