// contract 负责封装 backend OpenAPI 生成类型的统一导入入口，供业务模块按路径+方法提取请求/响应类型。
import type { components, paths } from './backend.generated';

export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';
export type ApiPath = keyof paths & string;

type PathOperation<P extends ApiPath, M extends HttpMethod> = NonNullable<paths[P][M]>;

type PickContent<C> = C extends { 'application/json': infer Body }
  ? Body
  : C extends { '*/*': infer Body }
    ? Body
    : never;

type SuccessStatus = 200 | 201 | 202 | 203 | 204 | 205 | 206;

type SuccessResponse<Op> = Op extends { responses: infer Res }
  ? Res extends Record<number, unknown>
    ? Res[Extract<keyof Res, SuccessStatus>]
    : never
  : never;

type SuccessResponseBody<Op> = SuccessResponse<Op> extends { content: infer C } ? PickContent<C> : never;

type RequestBody<Op> = Op extends { requestBody?: infer ReqBody }
  ? ReqBody extends { content: infer C }
    ? PickContent<C>
    : never
  : never;

type QueryParams<Op> = Op extends { parameters: infer Params }
  ? Params extends { query?: infer Q }
    ? Exclude<Q, undefined>
    : never
  : never;
type PathParams<Op> = Op extends { parameters: infer Params }
  ? Params extends { path?: infer P }
    ? Exclude<P, undefined>
    : never
  : never;

export type ApiReq<P extends ApiPath, M extends HttpMethod> = RequestBody<PathOperation<P, M>>;
export type ApiRes<P extends ApiPath, M extends HttpMethod> = SuccessResponseBody<PathOperation<P, M>>;
export type ApiQuery<P extends ApiPath, M extends HttpMethod> = QueryParams<PathOperation<P, M>>;
export type ApiPathParams<P extends ApiPath, M extends HttpMethod> = PathParams<PathOperation<P, M>>;

export type ApiEnvelope<T> = {
  code: string;
  message: string;
  data: T;
};

export type BackendComponents = components['schemas'];
