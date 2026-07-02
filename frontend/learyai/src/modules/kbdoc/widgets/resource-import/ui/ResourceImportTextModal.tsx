// ResourceImportTextModal 负责收集纯文本并触发知识库文本导入流程。
import React, { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppDispatch, useAppSelector } from '@/app/store/hooks';
import { closeImport } from '../../../../resource';
import { resourceApi } from '../../../entities/resource';
import MaterialIcon from '@/shared/ui/icons/MaterialIcon';

interface ResourceImportTextModalProps {
  projectId?: string;
}

const normalizeText = (value: string) => value.trim();

const buildDefaultTextDocName = (value: string) => {
  const compact = normalizeText(value).replace(/\s+/g, ' ');
  if (!compact) {
    return '';
  }
  return `${compact.slice(0, 5)}...`;
};

const ResourceImportTextModal: React.FC<ResourceImportTextModalProps> = ({ projectId }) => {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const isOpen = useAppSelector((state) => state.resourceCenter.isImportTextOpen);
  const [text, setText] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { kbId: kbIdParam } = useParams<{ kbId: string }>();
  const kbId = kbIdParam ?? '';

  const normalizedText = useMemo(() => normalizeText(text), [text]);
  const suggestedName = useMemo(() => buildDefaultTextDocName(text), [text]);

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!projectId) {
        throw new Error('缺少项目ID，无法导入文本');
      }
      if (!kbId) {
        throw new Error('缺少知识库ID，无法导入文本');
      }
      if (!normalizedText) {
        throw new Error('请输入文本内容');
      }
      return resourceApi.importText({
        projectId,
        kbId,
        text: normalizedText,
        name: name.trim() || suggestedName,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resource'] });
      queryClient.invalidateQueries({ queryKey: ['resource', 'options'] });
      setText('');
      setName('');
      setError(null);
      dispatch(closeImport());
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : '文本导入失败');
    },
  });

  if (!isOpen) return null;

  const resetAndClose = () => {
    if (importMutation.isPending) return;
    setText('');
    setName('');
    setError(null);
    dispatch(closeImport());
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm sm:p-6">
      <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-[#2a2a2a] dark:bg-[#1a1a1a] sm:max-h-[calc(100vh-3rem)]">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-[#2a2a2a] flex items-center justify-between bg-slate-50/50 dark:bg-[#121212]">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">导入文本</h2>
            <p className="text-[11px] text-slate-400 dark:text-[#a0a0a0]">
              可直接粘贴纯文本，未填写名称时默认使用前五个字加 ...
            </p>
          </div>
          <button
            onClick={resetAndClose}
            className="text-slate-400 hover:text-slate-600"
          >
            <MaterialIcon name="close" />
          </button>
        </div>

        <div className="min-h-0 overflow-y-auto p-6 space-y-4">
          <div className="space-y-2">
            <label htmlFor="resource-import-text-name" className="text-xs font-semibold text-slate-500 dark:text-[#b0b0b0]">
              文档名称
            </label>
            <input
              id="resource-import-text-name"
              type="text"
              placeholder={suggestedName || '默认使用前五个字加 ...'}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (error) setError(null);
              }}
              className="w-full rounded-2xl border border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#111111] px-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:border-primary"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="resource-import-text-content" className="text-xs font-semibold text-slate-500 dark:text-[#b0b0b0]">
              文本内容
            </label>
            <textarea
              id="resource-import-text-content"
              placeholder="请输入或粘贴纯文本内容"
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                if (error) setError(null);
              }}
              rows={10}
              className="w-full rounded-3xl border border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#111111] px-4 py-3 text-sm leading-6 text-slate-900 dark:text-white outline-none focus:border-primary resize-none"
            />
          </div>

          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
              {error}
            </div>
          ) : null}

          <div className="rounded-2xl bg-slate-50 dark:bg-[#121212] px-4 py-3 text-[12px] leading-6 text-slate-500 dark:text-[#b0b0b0]">
            默认名称：{suggestedName || '请输入文本后自动生成'}
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

export default ResourceImportTextModal;
