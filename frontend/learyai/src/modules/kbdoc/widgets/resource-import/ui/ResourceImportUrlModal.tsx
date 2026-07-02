// ResourceImportUrlModal 负责收集外部链接并触发知识库 URL 导入流程。
import React, { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppDispatch, useAppSelector } from '@/app/store/hooks';
import { closeImport } from '../../../../resource';
import { resourceApi } from '../../../entities/resource';
import MaterialIcon from '@/shared/ui/icons/MaterialIcon';

interface ResourceImportUrlModalProps {
  projectId?: string;
}

const normalizeUrl = (value: string) => value.trim();

const isSupportedMediaUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:'
      && parsed.hostname.toLowerCase() === 'www.bilibili.com'
      && parsed.pathname.toLowerCase().startsWith('/video');
  } catch {
    return false;
  }
};

const ResourceImportUrlModal: React.FC<ResourceImportUrlModalProps> = ({ projectId }) => {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const isOpen = useAppSelector((state) => state.resourceCenter.isImportUrlOpen);
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { kbId: kbIdParam } = useParams<{ kbId: string }>();
  const kbId = kbIdParam ?? '';

  const normalizedUrl = useMemo(() => normalizeUrl(url), [url]);

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!projectId) {
        throw new Error('缺少项目ID，无法导入链接');
      }
      if (!kbId) {
        throw new Error('缺少知识库ID，无法导入链接');
      }
      if (!normalizedUrl) {
        throw new Error('请输入链接');
      }
      if (!isSupportedMediaUrl(normalizedUrl)) {
        throw new Error('仅支持 https://www.bilibili.com/video 开头的链接');
      }
      return resourceApi.importUrl({
        projectId,
        kbId,
        url: normalizedUrl,
        name: name.trim() || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resource'] });
      queryClient.invalidateQueries({ queryKey: ['resource-options'] });
      setUrl('');
      setName('');
      setError(null);
      dispatch(closeImport());
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : '链接导入失败');
    },
  });

  if (!isOpen) return null;

  const resetAndClose = () => {
    if (importMutation.isPending) return;
    setUrl('');
    setName('');
    setError(null);
    dispatch(closeImport());
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="w-full max-w-xl bg-white dark:bg-[#1a1a1a] rounded-3xl border border-slate-200 dark:border-[#2a2a2a] shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-[#2a2a2a] flex items-center justify-between bg-slate-50/50 dark:bg-[#121212]">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">导入链接</h2>
            <p className="text-[11px] text-slate-400 dark:text-[#a0a0a0]">
              请输入 https://www.bilibili.com/video 开头的 B 站视频链接
            </p>
          </div>
          <button
            onClick={resetAndClose}
            className="text-slate-400 hover:text-slate-600"
          >
            <MaterialIcon name="close" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <label htmlFor="resource-import-url" className="text-xs font-semibold text-slate-500 dark:text-[#b0b0b0]">
              链接地址
            </label>
            <input
              id="resource-import-url"
              type="url"
              placeholder="https://www.bilibili.com/video/BV..."
              value={url}
              onChange={(event) => {
                setUrl(event.target.value);
                if (error) setError(null);
              }}
              className="w-full rounded-2xl border border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#111111] px-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:border-primary"
            />
          </div>

          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
              {error}
            </div>
          ) : null}

          <div className="rounded-2xl bg-slate-50 dark:bg-[#121212] px-4 py-3 text-[12px] leading-6 text-slate-500 dark:text-[#b0b0b0]">
            当前仅支持 B 站视频链接，请勿上传其他链接~
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 dark:border-[#2a2a2a] flex items-center justify-end gap-3 bg-slate-50/50 dark:bg-[#121212]">
          <button
            type="button"
            onClick={resetAndClose}
            disabled={importMutation.isPending}
            className="px-4 py-2 rounded-2xl text-sm font-medium text-slate-500 border border-slate-200 hover:border-slate-300 disabled:opacity-60 dark:text-[#d0d0d0] dark:border-[#2a2a2a]"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => importMutation.mutate()}
            disabled={importMutation.isPending}
            className="px-4 py-2 rounded-2xl text-sm font-medium text-white bg-primary hover:opacity-90 disabled:opacity-60"
          >
            {importMutation.isPending ? '导入中...' : '开始导入'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResourceImportUrlModal;
