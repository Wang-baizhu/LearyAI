// modules/kbdoc/shared/api/upload 负责上传文件到临时直传地址并返回 etag。
import axios from 'axios';

export const uploadToTempUrl = async (
  url: string,
  file: File,
  contentType?: string,
  onProgress?: (percent: number) => void
): Promise<string | null> => {
  const resolvedContentType = contentType?.trim() || file.type || 'application/octet-stream';
  const response = await axios.put(url, file, {
    headers: {
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
