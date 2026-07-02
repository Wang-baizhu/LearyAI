// 责任：上传文件到对象存储预签名地址并返回对象 ETag。
import axios from 'axios';

export const uploadToTempUrl = async (
  url: string,
  file: File,
  contentType?: string,
  headers?: Record<string, string>,
  onProgress?: (percent: number) => void,
): Promise<string | null> => {
  const resolvedContentType = contentType?.trim() || file.type || 'application/octet-stream';
  const response = await axios.put(url, file, {
    headers: {
      ...headers,
      'Content-Type': resolvedContentType,
    },
    onUploadProgress: (event) => {
      if (!event.total) return;
      const percent = Math.round((event.loaded / event.total) * 100);
      onProgress?.(percent);
    },
  });
  const etagHeader = response.headers?.etag ?? response.headers?.ETag;
  return typeof etagHeader === 'string' ? etagHeader : null;
};
