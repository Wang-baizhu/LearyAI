// authApi 负责认证相关接口调用，使用 .env(.local) 中的 baseURL 并对接后端 OpenAPI 契约。
import { apiRequest } from '@/shared/api/client';
import type { ApiEnvelope, ApiReq, ApiRes } from '@/shared/api/contract';
import type { UserSession } from '../../../entities/user';

export interface LoginPayload {
  email: string;
  password: string;
  rememberMe?: boolean;
  deviceId?: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  phone?: string;
  smsCode?: string;
  rememberMe?: boolean;
  deviceId?: string;
}

export interface RegisterInvitePayload {
  name: string;
  email: string;
  phone: string;
  password: string;
  inviteCode: string;
  rememberMe?: boolean;
  deviceId?: string;
}

export interface VerificationPayload {
  phone: string;
  code: string;
}

type LoginRequestBody = ApiReq<'/api/auth/login', 'post'>;
type LoginApiResponse = ApiRes<'/api/auth/login', 'post'>;
type MeApiResponse = ApiRes<'/api/auth/me', 'get'>;
type RegisterRequestBody = ApiReq<'/api/auth/register', 'post'>;
type RegisterApiResponse = ApiRes<'/api/auth/register', 'post'>;
type RegisterInviteRequestBody = ApiReq<'/api/auth/register/invite', 'post'>;
type RegisterInviteApiResponse = ApiRes<'/api/auth/register/invite', 'post'>;
type SendSmsCodeRequestBody = ApiReq<'/api/auth/sms-code', 'post'>;
type SendSmsCodeResponse = ApiRes<'/api/auth/sms-code', 'post'>;
type LogoutApiResponse = ApiRes<'/api/auth/logout', 'post'>;

type UserResponseData = NonNullable<LoginApiResponse['data']>;

const requiredField = <T>(value: T | null | undefined, field: string): T => {
  if (value === null || value === undefined) {
    throw new Error(`auth api 响应缺少字段: ${field}`);
  }
  return value;
};

const mapSession = (data: UserResponseData): UserSession => ({
  id: requiredField(data.userId, 'userId'),
  name: requiredField(data.name, 'name'),
  email: requiredField(data.email, 'email'),
  phone: requiredField(data.phone, 'phone'),
  userMode: requiredField(data.userMode, 'userMode'),
});

const normalizeDeviceId = () => {
  if (typeof navigator !== 'undefined' && navigator.userAgent) {
    return navigator.userAgent;
  }
  return 'web-client';
};

export interface LoginResponse {
  session: UserSession;
  message: string;
}

export const authApi = {
  login: async (payload: LoginPayload): Promise<LoginResponse> => {
    const response = await apiRequest<LoginApiResponse>('/auth/login', {
      method: 'POST',
      body: {
        email: payload.email,
        password: payload.password,
        rememberMe: payload.rememberMe ?? true,
        deviceId: payload.deviceId ?? normalizeDeviceId(),
      } satisfies LoginRequestBody,
    });
    return {
      session: mapSession(requiredField(response.data, 'data')),
      message: requiredField(response.message, 'message'),
    };
  },
  me: async (): Promise<LoginResponse> => {
    const response = await apiRequest<MeApiResponse>('/auth/me', {
      method: 'GET',
    });
    return {
      session: mapSession(requiredField(response.data, 'data')),
      message: requiredField(response.message, 'message'),
    };
  },
  register: async (payload: RegisterPayload): Promise<{ message: string }> => {
    const response = await apiRequest<RegisterApiResponse>('/auth/register', {
      method: 'POST',
      body: {
        name: payload.name,
        email: payload.email,
        password: payload.password,
        phone: payload.phone ?? '',
        smsCode: payload.smsCode ?? '',
        rememberMe: payload.rememberMe ?? true,
        deviceId: payload.deviceId ?? normalizeDeviceId(),
      } satisfies RegisterRequestBody,
    });
    return {
      message: requiredField(response.message, 'message'),
    };
  },
  registerWithInvite: async (payload: RegisterInvitePayload): Promise<{ message: string }> => {
    const response = await apiRequest<RegisterInviteApiResponse>('/auth/register/invite', {
      method: 'POST',
      body: {
        name: payload.name,
        email: payload.email,
        phone: payload.phone,
        password: payload.password,
        inviteCode: payload.inviteCode,
        rememberMe: payload.rememberMe ?? true,
        deviceId: payload.deviceId ?? normalizeDeviceId(),
      } satisfies RegisterInviteRequestBody,
    });
    return {
      message: requiredField(response.message, 'message'),
    };
  },
  sendVerificationCode: async (phone: string): Promise<{ message: string }> => {
    const response = await apiRequest<SendSmsCodeResponse>('/auth/sms-code', {
      method: 'POST',
      body: {
        phone,
      } satisfies SendSmsCodeRequestBody,
    });
    return {
      message: requiredField(response.message, 'message'),
    };
  },
  verifyCode: async (payload: VerificationPayload): Promise<{ message: string }> => {
    const response = await apiRequest<ApiEnvelope<Record<string, never>>>('/auth/sms-code/verify', {
      method: 'POST',
      body: payload,
    });
    return {
      message: requiredField(response.message, 'message'),
    };
  },
  logout: async (): Promise<{ message: string }> => {
    const response = await apiRequest<LogoutApiResponse>('/auth/logout', {
      method: 'POST',
    });
    return {
      message: requiredField(response.message, 'message'),
    };
  },
};
