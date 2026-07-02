// 责任：封装管理员模板开发调试安装包版本管理接口调用。
import { apiRequest } from '@/shared/api/client';
import { uploadToTempUrl } from '@/shared/api/upload';
import type {
  AdminTemplateDevPackageUploadConfirmResponse,
  AdminTemplateDevPackageUploadPrepareResponse,
  AdminTemplateDevPackageVersionActivateResponse,
  AdminTemplateDevPackageVersionItemResponse,
  ApiResponse,
} from '@/shared/types/api';

export const templateDevPackageApi = {
  listVersions: () =>
    apiRequest<ApiResponse<AdminTemplateDevPackageVersionItemResponse[]>>('/admin/template-dev-packages', {
      method: 'GET',
    }),
  uploadVersion: async (params: { platform: string; version: string; file: File }) => {
    const prepareResponse = await apiRequest<ApiResponse<AdminTemplateDevPackageUploadPrepareResponse>>(
      '/admin/template-dev-packages/upload/prepare',
      {
        method: 'POST',
        body: {
          platform: params.platform,
          version: params.version,
          fileName: params.file.name,
          size: params.file.size,
          contentType: params.file.type || undefined,
        },
      },
    );
    const prepare = prepareResponse.data;
    const etag = await uploadToTempUrl(
      prepare.uploadPolicy.uploadUrl,
      params.file,
      prepare.contentType,
      prepare.uploadPolicy.headers ?? undefined,
    );
    return apiRequest<ApiResponse<AdminTemplateDevPackageUploadConfirmResponse>>(
      '/admin/template-dev-packages/upload/confirm',
      {
        method: 'POST',
        body: {
          platform: prepare.platform,
          version: prepare.version,
          fileName: prepare.fileName,
          objectKey: prepare.objectKey,
          size: prepare.size,
          contentType: prepare.contentType,
          etag: etag ?? undefined,
        },
      },
    );
  },
  activateVersion: (params: { platform: string; version: string }) =>
    apiRequest<ApiResponse<AdminTemplateDevPackageVersionActivateResponse>>(
      `/admin/template-dev-packages/${encodeURIComponent(params.platform)}/${encodeURIComponent(params.version)}:activate`,
      {
        method: 'PUT',
      },
    ),
};
