// SidebarChatInput 负责渲染输入区与引用提示交互。
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import MaterialIcon from '@/shared/ui/icons/MaterialIcon';
import { TourStep } from '@leary/tour-guide';

interface SidebarChatInputProps {
  inputText: string;
  referencedResources: { id: string; title: string }[];
  variant?: 'default' | 'mobile-floating';
  onInputChange: (value: string) => void;
  onOpenAddModal: () => void;
  onSend: () => void;
  onMockReplay?: () => void;
  onCancel: () => void;
  isStreaming?: boolean;
  isSendDisabled?: boolean;
  showMockReplayButton?: boolean;
}

const RESOURCE_CENTER_GUIDE_TAG = 'guide:resource-center:v1';
const MOBILE_SINGLE_LINE_HEIGHT = 24;
const MOBILE_MAX_TEXTAREA_HEIGHT = 152;
const MOBILE_CONTROL_BUTTON_SIZE = 32;
const MOBILE_CONTROL_GAP = 16;

const SidebarChatInput: React.FC<SidebarChatInputProps> = ({
  inputText,
  referencedResources,
  variant = 'default',
  onInputChange,
  onOpenAddModal,
  onSend,
  onMockReplay,
  onCancel,
  isStreaming = false,
  isSendDisabled = false,
  showMockReplayButton = false,
}) => {
  const isMobileFloating = variant === 'mobile-floating';
  const referenceCount = referencedResources.length;
  const referenceLabel =
    referenceCount > 1 ? `参考了${referenceCount}个文件` : referencedResources[0]?.title;
  const mobileControlsRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [isMobileExpanded, setIsMobileExpanded] = useState(false);

  const resizeTextarea = () => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = '0px';
    const targetHeight = Math.min(textarea.scrollHeight, 152);
    textarea.style.height = `${targetHeight}px`;
  };

  const syncMobileExpandedState = () => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    const computedStyle = window.getComputedStyle(textarea);
    const lineHeight = Number.parseFloat(computedStyle.lineHeight) || MOBILE_SINGLE_LINE_HEIGHT;
    const paddingTop = Number.parseFloat(computedStyle.paddingTop) || 0;
    const paddingBottom = Number.parseFloat(computedStyle.paddingBottom) || 0;
    const singleLineHeight = Math.max(lineHeight + paddingTop + paddingBottom, MOBILE_SINGLE_LINE_HEIGHT);
    const collapsedContentWidth = Math.max(
      (mobileControlsRef.current?.clientWidth ?? 0) -
        MOBILE_CONTROL_BUTTON_SIZE * 2 -
        MOBILE_CONTROL_GAP,
      0
    );

    let collapsedContentHeight = 0;
    if (collapsedContentWidth > 0) {
      const measureTextarea = document.createElement('textarea');
      measureTextarea.value = textarea.value;
      measureTextarea.rows = 1;
      measureTextarea.style.position = 'absolute';
      measureTextarea.style.left = '-9999px';
      measureTextarea.style.top = '0';
      measureTextarea.style.visibility = 'hidden';
      measureTextarea.style.pointerEvents = 'none';
      measureTextarea.style.height = '0px';
      measureTextarea.style.minHeight = '0px';
      measureTextarea.style.maxHeight = 'none';
      measureTextarea.style.overflow = 'hidden';
      measureTextarea.style.resize = 'none';
      measureTextarea.style.boxSizing = computedStyle.boxSizing;
      measureTextarea.style.width = `${collapsedContentWidth}px`;
      measureTextarea.style.paddingTop = computedStyle.paddingTop;
      measureTextarea.style.paddingBottom = computedStyle.paddingBottom;
      measureTextarea.style.paddingLeft = computedStyle.paddingLeft;
      measureTextarea.style.paddingRight = computedStyle.paddingRight;
      measureTextarea.style.border = '0';
      measureTextarea.style.fontFamily = computedStyle.fontFamily;
      measureTextarea.style.fontSize = computedStyle.fontSize;
      measureTextarea.style.fontWeight = computedStyle.fontWeight;
      measureTextarea.style.fontStyle = computedStyle.fontStyle;
      measureTextarea.style.letterSpacing = computedStyle.letterSpacing;
      measureTextarea.style.lineHeight = computedStyle.lineHeight;
      measureTextarea.style.whiteSpace = 'pre-wrap';
      measureTextarea.style.wordBreak = 'break-word';
      document.body.appendChild(measureTextarea);
      collapsedContentHeight = measureTextarea.scrollHeight;
      document.body.removeChild(measureTextarea);
    }

    textarea.style.height = '0px';
    const contentHeight = textarea.scrollHeight;
    const nextHeight = Math.min(Math.max(contentHeight, singleLineHeight), MOBILE_MAX_TEXTAREA_HEIGHT);
    const collapsedLineCount =
      collapsedContentHeight > 0
        ? Math.round(
            Math.max(collapsedContentHeight - paddingTop - paddingBottom, lineHeight) / lineHeight
          )
        : 1;
    const shouldExpand = collapsedLineCount >= 2;
    textarea.style.height = shouldExpand ? `${nextHeight}px` : `${singleLineHeight}px`;
    setIsMobileExpanded((previous) => (previous === shouldExpand ? previous : shouldExpand));
  };

  useLayoutEffect(() => {
    if (isMobileFloating && textareaRef.current) {
      const animationFrameId = window.requestAnimationFrame(() => {
        syncMobileExpandedState();
      });
      return () => {
        window.cancelAnimationFrame(animationFrameId);
      };
    }
    resizeTextarea();
  }, [inputText, isMobileFloating, isMobileExpanded]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    if (isMobileFloating) {
      const animationFrameId = window.requestAnimationFrame(() => {
        syncMobileExpandedState();
      });
      const handleWindowResize = () => {
        syncMobileExpandedState();
      };
      window.addEventListener('resize', handleWindowResize);
      return () => {
        window.cancelAnimationFrame(animationFrameId);
        window.removeEventListener('resize', handleWindowResize);
      };
      return;
    }

    resizeTextarea();
    const observer = new ResizeObserver(() => {
      resizeTextarea();
    });
    observer.observe(textarea);

    const handleWindowResize = () => {
      resizeTextarea();
    };
    window.addEventListener('resize', handleWindowResize);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', handleWindowResize);
    };
  }, [isMobileFloating]);

  if (isMobileFloating) {
    return (
      <div
        className={`border border-slate-200/80 bg-white/95 shadow-[0_14px_36px_rgba(15,23,42,0.12)] backdrop-blur transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] dark:border-[#2a2a2a] dark:bg-[#171717]/95 ${
          isMobileExpanded ? 'rounded-[22px] px-4 py-2.5' : 'rounded-[22px] px-4 py-2.5'
        }`}
      >
        <div
          className={`overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            referenceCount > 0 ? 'mb-1.5 max-h-12 opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-[11px] font-bold text-slate-600 dark:border-[#2a2a2a] dark:bg-[#121212] dark:text-[#e0e0e0]">
            <MaterialIcon name="attach_file" className="text-[16px] text-primary" />
            <span className="truncate">{referenceLabel}</span>
          </div>
        </div>

        <div
          ref={mobileControlsRef}
          className={`grid transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            isMobileExpanded
              ? 'mt-1 grid-cols-[32px_1fr_32px] gap-x-2 gap-y-1.5 border-t border-slate-200/70 pt-1.5 dark:border-[#2a2a2a]/70'
              : 'mt-0 grid-cols-[32px_1fr_32px] items-center gap-2 pt-0'
          }`}
        >
          <TourStep
            tag={RESOURCE_CENTER_GUIDE_TAG}
            order={2}
            title="参考文档来源"
            content="点击这里可以选择本次对话参考的文档来源。"
            actionLabel="知道了"
          >
            <button
              type="button"
              onClick={onOpenAddModal}
              className={`flex size-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-500 transition-all duration-300 active:scale-95 dark:border-[#2a2a2a] dark:bg-[#121212] dark:text-[#d0d0d0] ${
                isMobileExpanded ? 'col-start-1 row-start-2' : 'col-start-1 row-start-1'
              }`}
            >
              <MaterialIcon name="add" className="text-[16px]" />
            </button>
          </TourStep>
          <textarea
            ref={textareaRef}
            rows={1}
            className={`w-full resize-none border-none bg-transparent text-sm leading-6 text-slate-700 placeholder-slate-400 outline-none ring-0 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] focus:border-none focus:outline-none focus:ring-0 dark:text-[#e0e0e0] ${
              isMobileExpanded
                ? 'col-span-3 col-start-1 row-start-1 min-h-6 max-h-[152px] overflow-y-auto px-1 py-0'
                : 'col-start-2 row-start-1 min-h-6 overflow-hidden px-3 py-0'
            }`}
            placeholder="输入您的问题..."
            value={inputText}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                if (inputText.trim() && !isStreaming && !isSendDisabled) {
                  onSend();
                }
              }
            }}
          />
          <button
            onClick={() => {
              if (isStreaming) {
                onCancel();
                return;
              }
              if (!isSendDisabled && inputText.trim()) {
                onSend();
              }
            }}
            className={`flex size-8 shrink-0 items-center justify-center transition-all duration-300 active:scale-95 ${
              isStreaming
                ? 'rounded-full border-2 border-slate-800 bg-white text-slate-900 shadow-sm dark:bg-white'
                : !isSendDisabled && inputText.trim()
                  ? 'rounded-full bg-primary text-white shadow-lg shadow-primary/20'
                  : 'rounded-full bg-slate-200 text-white cursor-not-allowed dark:bg-[#2a2a2a]'
            } ${isMobileExpanded ? 'col-start-3 row-start-2' : 'col-start-3 row-start-1'}`}
            type="button"
            disabled={isSendDisabled && !isStreaming}
          >
            {isStreaming ? (
              <span className="size-2 rounded-[3px] bg-slate-900" />
            ) : (
              <MaterialIcon name="arrow_upward" className="text-[16px]" />
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 border-t border-slate-50 dark:border-[#2a2a2a] bg-white dark:bg-[#1a1a1a]">
      <div className="bg-slate-50 dark:bg-[#121212] rounded-2xl border border-slate-200 dark:border-[#2a2a2a] p-3 shadow-inner">
        {referenceCount > 0 && (
          <div className="flex items-center gap-2 mb-2 px-2.5 py-1.5 bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#2a2a2a] rounded-xl text-[11px] font-bold text-slate-600 dark:text-[#e0e0e0] animate-in zoom-in-95 duration-200">
            <MaterialIcon name="attach_file" className="text-[16px] text-primary" />
            <span className="truncate flex-1">{referenceLabel}</span>
          </div>
        )}

        <textarea
          ref={textareaRef}
          className="w-full bg-transparent border-none focus:ring-0 text-sm text-slate-700 dark:text-[#e0e0e0] placeholder-slate-400 resize-none min-h-8 max-h-40 overflow-y-auto py-1"
          placeholder="输入您的问题..."
          value={inputText}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              if (inputText.trim() && !isStreaming && !isSendDisabled) {
                onSend();
              }
            }
          }}
        />

        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200/50 dark:border-[#2a2a2a]/50">
          <div className="flex items-center gap-2">
            <TourStep
              tag={RESOURCE_CENTER_GUIDE_TAG}
              order={2}
              title="参考文档来源"
              content="点击这里可以选择本次对话参考的文档来源。"
              actionLabel="知道了"
            >
              <button
                type="button"
                onClick={onOpenAddModal}
                className="size-8 flex items-center justify-center rounded-xl border border-slate-200 dark:border-[#2a2a2a] text-slate-400 hover:bg-white dark:hover:bg-[#121212] hover:text-primary hover:border-primary transition-all active:scale-90"
              >
                <MaterialIcon name="add" className="text-[20px]" />
              </button>
            </TourStep>
            {showMockReplayButton ? (
              <button
                type="button"
                onClick={() => onMockReplay?.()}
                disabled={isStreaming}
                className={`h-8 rounded-xl border px-3 text-[11px] font-semibold transition-all active:scale-90 ${
                  isStreaming
                    ? 'cursor-not-allowed border-slate-200 dark:border-[#2a2a2a] text-slate-400 dark:text-[#666]'
                    : 'border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-300 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200'
                }`}
              >
                回放
              </button>
            ) : null}
          </div>
          <button
            onClick={() => {
              if (isStreaming) {
                onCancel();
                return;
              }

              if (!isSendDisabled && inputText.trim()) {
                onSend();
              }
            }}
            className={`size-7 flex items-center justify-center transition-all active:scale-95 ${
              isStreaming
                ? 'rounded-full bg-white dark:bg-white text-slate-900 border-2 border-slate-800 shadow-sm'
                : 'rounded-xl ' +
                  (!isSendDisabled && inputText.trim()
                    ? 'bg-primary text-white shadow-lg shadow-primary/20'
                    : 'bg-slate-200 dark:bg-[#2a2a2a] text-white cursor-not-allowed')
            }`}
            type="button"
            disabled={isSendDisabled && !isStreaming}
          >
            {isStreaming ? (
              <span className="size-2.5 rounded-[3px] bg-slate-900" />
            ) : (
              <MaterialIcon name="arrow_upward" className="text-[20px]" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SidebarChatInput;
