// ResourceImportModal 负责选择文件并完成上传流程（支持拖拽与多文件并行上传）。
import React, { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppDispatch, useAppSelector } from '@/app/store/hooks';
import { closeImport } from '../../../../resource';
import { resourceApi, resolveUploadContentType, resolveUploadTempUrl } from '../../../entities/resource';
import type { ResourceFileType } from '../../../entities/resource';
import { uploadToTempUrl } from '../../../shared/api';
import MaterialIcon from '@/shared/ui/icons/MaterialIcon';

const AUDIO_FILE_TYPES = ['wav', 'mp3', 'm4a', 'aac', 'flac', 'ogg'] as const;
const AUDIO_FILE_SUFFIXES = AUDIO_FILE_TYPES.map((item) => `.${item}`);
const SUPPORTED_FILE_ACCEPT = [
  '.pdf',
  '.docx',
  '.pptx',
  '.md',
  '.txt',
  ...AUDIO_FILE_SUFFIXES,
].join(',');
const SUPPORTED_FILE_LABEL = `PDF / DOCX / PPTX / MD / TXT / ${AUDIO_FILE_TYPES.map((item) => item.toUpperCase()).join(' / ')}`;

const resolveFileType = (file: File): ResourceFileType => {
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith('.pdf')) return 'pdf';
  if (lowerName.endsWith('.docx')) return 'docx';
  if (lowerName.endsWith('.pptx')) return 'pptx';
  if (lowerName.endsWith('.md') || lowerName.endsWith('.markdown')) return 'md';
  if (lowerName.endsWith('.txt')) return 'txt';
  if (lowerName.endsWith('.wav')) return 'wav';
  if (lowerName.endsWith('.mp3')) return 'mp3';
  if (lowerName.endsWith('.m4a')) return 'm4a';
  if (lowerName.endsWith('.aac')) return 'aac';
  if (lowerName.endsWith('.flac')) return 'flac';
  if (lowerName.endsWith('.ogg')) return 'ogg';
  return 'other';
};

type SupportedFileType = Exclude<ResourceFileType, 'other'>;

const formatSize = (size: number) => {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

interface ResourceImportModalProps {
  projectId?: string;
}

const ResourceImportModal: React.FC<ResourceImportModalProps> = ({ projectId }) => {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const isOpen = useAppSelector((state) => state.resourceCenter.isImportOpen);
  const [files, setFiles] = useState<File[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, number>>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const { kbId: kbIdParam } = useParams<{ kbId: string }>();
  const kbId = kbIdParam ?? '';

  const validFiles = useMemo(
    () => files.filter((item) => resolveFileType(item) !== 'other'),
    [files],
  );

  const fileKey = (item: File) => `${item.name}-${item.size}-${item.lastModified}`;

  const uploadMutation = useMutation({
    mutationFn: async (targets: File[]) => {
      if (!kbId) {
        throw new Error('缺少知识库ID，无法上传');
      }
      if (!projectId) {
        throw new Error('缺少项目ID，无法上传');
      }
      const tasks = targets.map(async (target) => {
        const type = resolveFileType(target);
        if (type === 'other') {
          throw new Error(`${target.name} 暂不支持该文件格式`);
        }
        const supportedType = type as SupportedFileType;
        const prepare = await resourceApi.prepareUpload({
          fileType: supportedType,
          size: target.size,
          purpose: 'UPLOAD',
          kbId,
          projectId,
        });
        const uploadUrl = resolveUploadTempUrl(prepare);
        const uploadContentType = resolveUploadContentType(prepare, target.type);
        const key = fileKey(target);

        const etag = await uploadToTempUrl(uploadUrl, target, uploadContentType, (percent) => {
          setProgressMap((prev) => ({
            ...prev,
            [key]: percent,
          }));
        });

        await resourceApi.confirmUpload({
          docId: prepare.docId,
          objectKey: prepare.objectKey,
          kbId,
          etag: etag ?? undefined,
          size: target.size,
          name: target.name,
          projectId,
        });

        return {
          docId: prepare.docId,
          name: target.name,
          fileType: supportedType,
        };
      });

      const results = await Promise.allSettled(tasks);
      const failedFiles = results
        .map((item, index) => (item.status === 'rejected' ? targets[index] : null))
        .filter((item): item is File => Boolean(item));
      const successes = results
        .filter((item): item is PromiseFulfilledResult<{ docId: string; name: string; fileType: SupportedFileType }> => item.status === 'fulfilled')
        .map((item) => item.value);
      return {
        successes,
        failedFiles,
      };
    },
    onSuccess: (result) => {
      if (result.successes.length) {
        queryClient.invalidateQueries({ queryKey: ['resource'] });
      }
      if (result.failedFiles.length) {
        setErrors([`部分文件上传失败：${result.failedFiles.length} 个`]);
        setFiles(result.failedFiles);
        setProgressMap({});
        return;
      }
      setFiles([]);
      setProgressMap({});
      setErrors([]);
      dispatch(closeImport());
    },
    onError: (err) => {
      setErrors([err instanceof Error ? err.message : '上传失败']);
    },
  });

  if (!isOpen) return null;

  const resetAndClose = () => {
    if (uploadMutation.isPending) return;
    setFiles([]);
    setProgressMap({});
    setErrors([]);
    dispatch(closeImport());
  };

  const handleUpload = (targets: File[]) => {
    if (!targets.length || uploadMutation.isPending) return;
    setProgressMap({});
    uploadMutation.mutate(targets);
  };

  const handleSelectFiles = (incomingFiles: File[], autoUpload: boolean) => {
    const supported = incomingFiles.filter((item) => resolveFileType(item) !== 'other');
    const unsupportedCount = incomingFiles.length - supported.length;
    setFiles(incomingFiles);
    setProgressMap({});
    setErrors(unsupportedCount ? [`已跳过 ${unsupportedCount} 个不支持的文件格式`] : []);
    if (autoUpload && supported.length) {
      handleUpload(supported);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm sm:p-6">
      <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-[#2a2a2a] dark:bg-[#1a1a1a] sm:max-h-[calc(100vh-3rem)]">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-[#2a2a2a] flex items-center justify-between bg-slate-50/50 dark:bg-[#121212]">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">导入文档</h2>
            <p className="text-[11px] text-slate-400 dark:text-[#a0a0a0]">支持 {SUPPORTED_FILE_LABEL}</p>
          </div>
          <button
            onClick={resetAndClose}
            className="text-slate-400 hover:text-slate-600"
          >
            <MaterialIcon name="close" />
          </button>
        </div>

        <div className="min-h-0 overflow-y-auto p-6 space-y-4">
          <label className="block">
            <input
              type="file"
              accept={SUPPORTED_FILE_ACCEPT}
              multiple
              className="hidden"
              onChange={(event) => {
                const selected = Array.from(event.target.files ?? []);
                handleSelectFiles(selected, false);
                event.target.value = '';
              }}
            />
            <div
              className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-colors ${
                isDragActive
                  ? 'border-primary bg-primary/5'
                  : 'border-slate-200 dark:border-[#2a2a2a] hover:border-primary'
              }`}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragActive(true);
              }}
              onDragLeave={() => setIsDragActive(false)}
              onDrop={(event) => {
                event.preventDefault();
                setIsDragActive(false);
                const dropped = Array.from(event.dataTransfer.files ?? []);
                handleSelectFiles(dropped, true);
              }}
            >
              <div className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-[#a0a0a0] mb-2">选择文件</div>
              <p className="text-sm text-slate-600 dark:text-[#e0e0e0]">
                {files.length ? `已选择 ${files.length} 个文件` : '点击选择或拖拽文件到此处'}
              </p>
              {files.length ? (
                <div className="mt-3 space-y-2">
                  {files.map((item) => {
                    const type = resolveFileType(item);
                    return (
                      <div key={fileKey(item)} className="text-[11px] text-slate-400 flex items-center justify-between">
                        <span className="truncate">{item.name}</span>
                        <span className="ml-3 shrink-0">{formatSize(item.size)} · {type.toUpperCase()}</span>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </label>

          {errors.length ? (
            <div className="space-y-2">
              {errors.map((item, index) => (
                <div key={`${item}-${index}`} className="text-sm text-rose-500 bg-rose-50 dark:bg-rose-500/10 rounded-xl px-4 py-3">
                  {item}
                </div>
              ))}
            </div>
          ) : null}

          {uploadMutation.isPending ? (
            <div>
              <div className="text-[11px] text-slate-400 mb-2">上传进度</div>
              <div className="space-y-3">
                {validFiles.map((item) => {
                  const key = fileKey(item);
                  const percent = progressMap[key] ?? 0;
                  return (
                    <div key={key}>
                      <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2">
                        <span className="truncate mr-3">{item.name}</span>
                        <span>{percent}%</span>
                      </div>
                      <div className="h-2 bg-slate-100 dark:bg-[#121212] rounded-full overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${percent}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50/50 px-6 py-4 dark:border-[#2a2a2a] dark:bg-[#121212]">
          <div className="flex items-center gap-3">
            <button
              onClick={resetAndClose}
              className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700"
            >
              取消
            </button>
            <button
              onClick={() => handleUpload(validFiles)}
              disabled={!validFiles.length || uploadMutation.isPending}
              className="px-5 py-2 rounded-xl bg-primary text-white text-xs font-bold shadow-lg shadow-primary/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {uploadMutation.isPending ? '上传中...' : '开始上传'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResourceImportModal;
