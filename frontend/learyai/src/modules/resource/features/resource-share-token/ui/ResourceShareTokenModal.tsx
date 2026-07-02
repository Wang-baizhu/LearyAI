// ResourceShareTokenModal 负责确认分享文档范围并申请可复制的 KB skills token。
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAppDispatch } from '@/app/store/hooks';
import { openDialog } from '@/app/store/ui/dialogSlice';
import { enqueueToast } from '@/app/store/ui/toastSlice';
import { resolveApiErrorMessage } from '@/shared/api/resolveApiError';
import { formatUrlDisplayName } from '@/shared/lib/formatters';
import { Modal } from '@leary/ui';
import MaterialIcon from '@/shared/ui/icons/MaterialIcon';
import type { ResourceOptionItem } from '../../../../kbdoc';
import { resolveDocReferenceState } from '../../../entities/resource-center';
import {
  resourceShareTokenApi,
  type ResourceShareTokenResult,
} from '../model/effects/api';

interface ResourceShareTokenModalProps {
  isOpen: boolean;
  resources: ResourceOptionItem[];
  projectId?: string;
  kbId?: string;
  isLoading?: boolean;
  onClose: () => void;
}

type TokenExpiresOption = {
  value: string;
  label: string;
  expiresInDays?: number;
  custom?: boolean;
  neverExpires?: boolean;
};

const TOKEN_EXPIRES_OPTIONS: TokenExpiresOption[] = [
  { value: '1d', label: '1 天', expiresInDays: 1 },
  { value: '3d', label: '3 天', expiresInDays: 3 },
  { value: '7d', label: '7 天', expiresInDays: 7 },
  { value: '30d', label: '30 天', expiresInDays: 30 },
  { value: 'custom', label: '自定义天数', custom: true },
  { value: 'never', label: '永久不过期', neverExpires: true },
];

const DEFAULT_EXPIRES_OPTION = TOKEN_EXPIRES_OPTIONS[0].value;

const ResourceShareTokenModal: React.FC<ResourceShareTokenModalProps> = ({
  isOpen,
  resources,
  projectId,
  kbId,
  isLoading = false,
  onClose,
}) => {
  const dispatch = useAppDispatch();
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [hasTouched, setHasTouched] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [issuedToken, setIssuedToken] = useState<ResourceShareTokenResult | null>(null);
  const [expiresOption, setExpiresOption] = useState(DEFAULT_EXPIRES_OPTION);
  const [customExpiresInDays, setCustomExpiresInDays] = useState('1');
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  const [isDescriptionCollapsed, setIsDescriptionCollapsed] = useState(false);
  const copyFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const defaultSelectedIds = useMemo(
    () =>
      resources
        .filter((item) =>
          resolveDocReferenceState({
            projectId,
            kbId,
            docId: item.docId,
            status: item.status,
          })
        )
        .map((item) => item.docId),
    [kbId, projectId, resources]
  );

  const effectiveSelectedDocIds = hasTouched ? selectedDocIds : defaultSelectedIds;
  const selectableResources = useMemo(
    () => resources.filter((item) => item.status === 'DONE'),
    [resources]
  );
  const selectedDocRefs = useMemo(
    () =>
      resources
        .filter((item) => effectiveSelectedDocIds.includes(item.docId))
        .map((item) => ({ id: item.docId, name: item.name })),
    [effectiveSelectedDocIds, resources]
  );
  const selectedExpiresOption = useMemo(
    () =>
      TOKEN_EXPIRES_OPTIONS.find((item) => item.value === expiresOption) ?? TOKEN_EXPIRES_OPTIONS[0],
    [expiresOption]
  );
  const expiresAtText = useMemo(() => {
    if (!issuedToken?.expiresAt) return null;
    const date = new Date(issuedToken.expiresAt);
    if (Number.isNaN(date.getTime())) return issuedToken.expiresAt;
    return date.toLocaleString('zh-CN', { hour12: false });
  }, [issuedToken]);

  const resetModalState = () => {
    setSelectedDocIds([]);
    setHasTouched(false);
    setIsSubmitting(false);
    setIsCopying(false);
    setIsCopied(false);
    setIssuedToken(null);
    setExpiresOption(DEFAULT_EXPIRES_OPTION);
    setCustomExpiresInDays('1');
    if (copyFeedbackTimerRef.current) {
      clearTimeout(copyFeedbackTimerRef.current);
      copyFeedbackTimerRef.current = null;
    }
  };

  useEffect(
    () => () => {
      if (copyFeedbackTimerRef.current) {
        clearTimeout(copyFeedbackTimerRef.current);
        copyFeedbackTimerRef.current = null;
      }
    },
    []
  );

  useEffect(() => {
    if (!isOpen) return;
    const mediaQuery = window.matchMedia('(max-width: 640px)');
    const syncScreenState = (matches: boolean) => {
      setIsSmallScreen(matches);
      setIsDescriptionCollapsed(matches);
    };
    syncScreenState(mediaQuery.matches);
    const handleChange = (event: MediaQueryListEvent) => syncScreenState(event.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [isOpen]);

  const handleRequestClose = () => {
    if (isSubmitting || isCopying) return;
    resetModalState();
    onClose();
  };

  const handleToggle = (item: ResourceOptionItem) => {
    if (item.status !== 'DONE') return;
    const currentSelectedIds = hasTouched ? selectedDocIds : defaultSelectedIds;
    const nextSelectedIds = currentSelectedIds.includes(item.docId)
      ? currentSelectedIds.filter((id) => id !== item.docId)
      : [...currentSelectedIds, item.docId];
    setHasTouched(true);
    setSelectedDocIds(nextSelectedIds);
  };

  const handleSubmit = async () => {
    if (!projectId || !kbId) {
      dispatch(openDialog({
        type: 'error',
        payload: {
          title: '分享失败',
          message: '缺少项目或知识库信息，无法生成分享 Token。',
        },
      }));
      return;
    }
    if (selectedDocRefs.length === 0) {
      dispatch(openDialog({
        type: 'error',
        payload: {
          title: '请选择分享文档',
          message: '至少选择 1 条已完成的文档后再生成分享 Token。',
        },
      }));
      return;
    }

    let resolvedExpiresInDays: number | undefined;
    if (selectedExpiresOption.neverExpires) {
      resolvedExpiresInDays = undefined;
    } else if (selectedExpiresOption.custom) {
      const parsedDays = Number.parseInt(customExpiresInDays, 10);
      if (!Number.isInteger(parsedDays) || parsedDays <= 0) {
        dispatch(openDialog({
          type: 'error',
          payload: {
            title: '过期时间无效',
            message: '自定义天数必须是大于 0 的整数。',
          },
        }));
        return;
      }
      resolvedExpiresInDays = parsedDays;
    } else {
      resolvedExpiresInDays = selectedExpiresOption.expiresInDays as number;
    }

    try {
      setIsSubmitting(true);
      const result = await resourceShareTokenApi.createToken({
        projectId,
        kbId,
        docRefs: selectedDocRefs,
        expiresInDays: resolvedExpiresInDays,
        neverExpires: selectedExpiresOption.neverExpires,
      });
      setIssuedToken(result);
      dispatch(enqueueToast({
        variant: 'success',
        message: '分享 Token 已生成',
      }));
    } catch (error) {
      dispatch(openDialog({
        type: 'error',
        payload: {
          title: '分享失败',
          message: resolveApiErrorMessage(error, '生成分享 Token 失败，请稍后重试。'),
        },
      }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyToken = async () => {
    if (!issuedToken?.token) return;
    try {
      setIsCopying(true);
      setIsCopied(false);
      await navigator.clipboard.writeText(issuedToken.token);
      setIsCopied(true);
      if (copyFeedbackTimerRef.current) {
        clearTimeout(copyFeedbackTimerRef.current);
      }
      copyFeedbackTimerRef.current = setTimeout(() => {
        setIsCopied(false);
        copyFeedbackTimerRef.current = null;
      }, 1500);
      dispatch(enqueueToast({
        variant: 'success',
        message: '分享 Token 已复制',
      }));
    } catch (error) {
      console.error('复制分享 Token 失败：', error);
      dispatch(openDialog({
        type: 'error',
        payload: {
          title: '复制失败',
          message: '浏览器暂时无法复制分享 Token，请手动复制。',
        },
      }));
    } finally {
      setIsCopying(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      title="分享(skills)"
      onClose={handleRequestClose}
    >
      <div className="flex max-h-[calc(100vh-12rem)] flex-col sm:max-h-[min(42rem,calc(100vh-10rem))]">
        {issuedToken ? (
          <>
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
                已生成分享 Token，可复制后用于后续检索调用。
              </div>
              <div className="space-y-2">
                <div className="text-sm font-semibold text-slate-800 dark:text-[#e0e0e0]">
                  Token
                </div>
                <textarea
                  readOnly
                  value={issuedToken.token}
                  rows={4}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-700 outline-none dark:border-[#2a2a2a] dark:bg-[#1a1a1a] dark:text-[#e0e0e0]"
                />
              </div>
              <div className="space-y-2 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-xs text-slate-500 dark:border-[#2a2a2a] dark:bg-[#1a1a1a] dark:text-[#c7d8db]">
                <div>已授权文档：{issuedToken.docRefs.length} 条</div>
                <div>能力范围：{issuedToken.abilities.join(', ') || 'search'}</div>
                <div>过期时间：{expiresAtText ?? '永久不过期'}</div>
              </div>
            </div>
            <div className="mt-5 flex shrink-0 flex-col-reverse gap-3 border-t border-slate-200 bg-white pt-4 dark:border-[#2a2a2a] dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-end">
              <button
                type="button"
                onClick={handleRequestClose}
                className="w-full rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700 sm:w-auto"
              >
                关闭
              </button>
              <button
                type="button"
                onClick={handleCopyToken}
                disabled={isCopying}
                className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-2 text-xs font-semibold text-white shadow-md shadow-primary/30 transition-transform active:scale-95 disabled:opacity-60 sm:min-w-[136px] sm:w-auto"
              >
                <MaterialIcon name={isCopied ? 'check' : 'content_copy'} className="text-sm" />
                <span>{isCopying ? '复制中...' : isCopied ? '已复制' : '复制 Token'}</span>
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
              <div className="space-y-2 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-xs text-slate-500 dark:border-[#2a2a2a] dark:bg-[#1a1a1a] dark:text-[#c7d8db]">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-semibold text-slate-700 dark:text-[#e0e0e0]">
                    说明
                  </div>
                  {isSmallScreen && (
                    <button
                      type="button"
                      onClick={() => setIsDescriptionCollapsed((value) => !value)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary"
                    >
                      <span>{isDescriptionCollapsed ? '展开' : '收起'}</span>
                      <MaterialIcon
                        name={isDescriptionCollapsed ? 'keyboard_arrow_down' : 'keyboard_arrow_up'}
                        className="text-sm"
                      />
                    </button>
                  )}
                </div>
                {(!isSmallScreen || !isDescriptionCollapsed) && (
                  <div>
                    当前已选 {selectedDocRefs.length} 条文档，生成Token复制后在相应终端导出即可使用leary skills（在相应终端输入 export LEARY_KB_TOKEN="你的token" ）。
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="text-sm font-semibold text-slate-800 dark:text-[#e0e0e0]">
                  过期时间
                </div>
                <select
                  value={expiresOption}
                  onChange={(event) => {
                    const nextOption = event.target.value;
                    setExpiresOption(nextOption);
                    if (nextOption !== 'custom') return;
                    if (customExpiresInDays.trim().length > 0) return;
                    setCustomExpiresInDays('1');
                  }}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-colors hover:border-primary/40 focus:border-primary dark:border-[#2a2a2a] dark:bg-[#1a1a1a] dark:text-[#e0e0e0]"
                >
                  {TOKEN_EXPIRES_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
                {selectedExpiresOption.custom && (
                  <div className="space-y-2">
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={customExpiresInDays}
                      onChange={(event) => setCustomExpiresInDays(event.target.value)}
                      placeholder="请输入天数"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-colors hover:border-primary/40 focus:border-primary dark:border-[#2a2a2a] dark:bg-[#1a1a1a] dark:text-[#e0e0e0]"
                    />
                    <div className="text-xs text-slate-400 dark:text-[#a0a0a0]">
                      请输入大于 0 的整数天数。
                    </div>
                  </div>
                )}
                <div className="text-xs text-slate-400 dark:text-[#a0a0a0]">
                  默认 1 天，按天计算；选择永久后，Token 不会自动过期。
                </div>
              </div>

              <div className="max-h-[320px] space-y-2 overflow-y-auto custom-scrollbar">
                {isLoading && (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-xs text-slate-400">
                    正在加载知识库资源...
                  </div>
                )}
                {!isLoading && resources.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-xs text-slate-400">
                    当前没有可选的知识库资源
                  </div>
                )}
                {!isLoading && resources.length > 0 && selectableResources.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-xs text-slate-400">
                    当前还没有可分享的已完成文档
                  </div>
                )}
                {!isLoading &&
                  resources.map((item) => {
                    const isSelected = effectiveSelectedDocIds.includes(item.docId);
                    const isDisabled = item.status !== 'DONE';
                    const statusLabel = isDisabled ? '处理中' : isSelected ? '已选中' : '未选中';
                    const displayName = formatUrlDisplayName(item.name);
                    return (
                      <button
                        key={item.docId}
                        type="button"
                        onClick={() => handleToggle(item)}
                        disabled={isDisabled}
                        className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all ${
                          isSelected
                            ? 'border-primary bg-primary/5 shadow-sm'
                            : 'border-slate-100 bg-white hover:border-primary/30 dark:border-[#2a2a2a] dark:bg-[#1a1a1a] dark:hover:border-primary/40'
                        } ${isDisabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                      >
                        <div
                          className={`flex size-8 items-center justify-center rounded-xl ${
                            isSelected
                              ? 'bg-primary text-white'
                              : 'bg-slate-100 text-slate-400 dark:bg-[#121212] dark:text-[#a0a0a0]'
                          }`}
                        >
                          <MaterialIcon name="description" className="text-[16px]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div
                            className="truncate text-sm font-semibold text-slate-800 dark:text-[#e0e0e0]"
                            title={item.name}
                          >
                            {displayName}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500 dark:text-[#c7d8db]">
                          <span>{statusLabel}</span>
                          {isSelected && (
                            <span className="flex size-5 items-center justify-center rounded-full bg-primary text-white">
                              <MaterialIcon name="check" className="text-[12px]" />
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>

            <div className="mt-5 flex shrink-0 flex-col-reverse gap-3 border-t border-slate-200 bg-white pt-4 dark:border-[#2a2a2a] dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-end">
              <button
                type="button"
                onClick={handleRequestClose}
                disabled={isSubmitting}
                className="w-full rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700 disabled:opacity-60 sm:w-auto"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting || isLoading || selectableResources.length === 0}
                className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-2 text-xs font-semibold text-white shadow-md shadow-primary/30 transition-transform active:scale-95 disabled:opacity-60 sm:w-auto"
              >
                <MaterialIcon name="share" className="text-sm" />
                <span>{isSubmitting ? '生成中...' : '生成分享 Token'}</span>
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

export default ResourceShareTokenModal;
