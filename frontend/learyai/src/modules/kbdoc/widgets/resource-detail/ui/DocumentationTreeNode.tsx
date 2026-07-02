// DocumentationTreeNode 负责渲染单个目录节点、引用跳转与标题摘要就地编辑入口。
import React from 'react';
import { EditableText } from '@leary/text-editable';
import {
  buildDocumentationCitationPayload,
  type DocumentationCitationPayload,
  type DocumentationNode,
} from '../../../entities/resource';
import type { ResourceTextEditAnchor } from '../lib/resourceTextEdit';
import MaterialIcon from '@/shared/ui/icons/MaterialIcon';

interface DocumentationTreeNodeProps {
  docId: string;
  expandedNodeIds: Set<string>;
  expandedTextNodeIds: Set<string>;
  level: number;
  node: DocumentationNode;
  onCitationClick?: (payload: DocumentationCitationPayload) => void;
  onRequestTextEdit?: (payload: {
    title: string;
    value: string;
    anchor: ResourceTextEditAnchor;
    multiline?: boolean;
  }) => void;
  onToggleText: (nodeId: string) => void;
  onToggle: (nodeId: string) => void;
}

const createTitleAnchor = (nodeId: string): ResourceTextEditAnchor => ({
  kind: 'directory',
  nodeId,
  field: 'title',
});

const createSummaryAnchor = (nodeId: string): ResourceTextEditAnchor => ({
  kind: 'directory',
  nodeId,
  field: 'summary',
});

const DocumentationTreeNode: React.FC<DocumentationTreeNodeProps> = ({
  docId,
  expandedNodeIds,
  expandedTextNodeIds,
  level,
  node,
  onCitationClick,
  onRequestTextEdit,
  onToggleText,
  onToggle,
}) => {
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedNodeIds.has(node.id);
  const isTextExpanded = expandedTextNodeIds.has(node.id);
  const titleRef = React.useRef<HTMLDivElement | null>(null);
  const summaryRef = React.useRef<HTMLParagraphElement | null>(null);
  const [shouldShowTextToggle, setShouldShowTextToggle] = React.useState(false);

  React.useLayoutEffect(() => {
    const titleElement = titleRef.current;
    const summaryElement = summaryRef.current;
    if (!titleElement || !summaryElement) {
      setShouldShowTextToggle(false);
      return;
    }

    const detectOverflow = () => {
      const titleOverflow = titleElement.clientWidth > 0
        ? titleElement.scrollWidth > titleElement.clientWidth
        : node.title.length > 20;
      const summaryOverflow = summaryElement.clientHeight > 0
        ? summaryElement.scrollHeight > summaryElement.clientHeight + 1
        : node.summary.length > 54;
      setShouldShowTextToggle(titleOverflow || summaryOverflow);
    };

    detectOverflow();
    const frameId = window.requestAnimationFrame(detectOverflow);
    const timerId = window.setTimeout(detectOverflow, 120);
    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => detectOverflow())
      : null;
    resizeObserver?.observe(titleElement);
    resizeObserver?.observe(summaryElement);
    if (titleElement.parentElement) {
      resizeObserver?.observe(titleElement.parentElement);
    }
    window.addEventListener('resize', detectOverflow);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timerId);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', detectOverflow);
    };
  }, [isTextExpanded, node.summary, node.title]);

  const handleCitationActivate = React.useCallback(() => {
    onCitationClick?.(buildDocumentationCitationPayload(docId, node));
  }, [docId, node, onCitationClick]);

  return (
    <li className="list-none">
      <div
        className="relative overflow-hidden rounded-2xl border border-transparent px-3 py-2.5 transition-colors hover:border-slate-200 hover:bg-white/80 dark:hover:border-[#2a2a2a] dark:hover:bg-white/[0.02]"
        style={{ marginLeft: `${level * 18}px` }}
      >
        <div className="flex items-start gap-3">
          {level > 0 ? (
            <span
              className="absolute left-0 top-0 h-full w-px bg-slate-200 dark:bg-[#2a2a2a]"
              style={{ left: `${level * 18 - 10}px` }}
              aria-hidden="true"
            />
          ) : null}
          {hasChildren ? (
            <button
              type="button"
              className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-200/70 hover:text-slate-700 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
              onClick={() => onToggle(node.id)}
              aria-label={isExpanded ? `收起 ${node.title}` : `展开 ${node.title}`}
              aria-expanded={isExpanded}
            >
              <MaterialIcon name={isExpanded ? 'keyboard_arrow_down' : 'keyboard_arrow_right'} className="text-base" />
            </button>
          ) : (
            <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center text-slate-400 dark:text-slate-500">
              <MaterialIcon name="chevron_right" className="text-sm opacity-0" />
            </span>
          )}
          <div
            role="button"
            tabIndex={0}
            className="flex min-w-0 flex-1 items-start rounded-xl px-2 py-1.5 pr-3 text-left transition-colors hover:bg-slate-100/80 dark:hover:bg-white/[0.03]"
            onClick={handleCitationActivate}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                handleCitationActivate();
              }
            }}
          >
            <div className={`min-w-0 flex-1 ${shouldShowTextToggle ? 'pb-6' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 pr-2">
                  <EditableText
                    title="目录标题"
                    value={node.title}
                    anchor={createTitleAnchor(node.id)}
                    className="w-full max-w-full"
                    triggerClassName="right-0 top-0"
                    onRequestEdit={(payload) => onRequestTextEdit?.({ ...payload, multiline: false })}
                  >
                    <div
                      ref={titleRef}
                      className={`${isTextExpanded ? 'whitespace-normal break-words' : 'truncate'} text-[15px] font-semibold text-slate-800 dark:text-slate-100`}
                    >
                      {node.title}
                    </div>
                  </EditableText>
                  <EditableText
                    title="目录摘要"
                    value={node.summary}
                    anchor={createSummaryAnchor(node.id)}
                    className="mt-0.5 w-full max-w-full"
                    triggerClassName="right-0 top-0"
                    onRequestEdit={(payload) => onRequestTextEdit?.({ ...payload, multiline: true })}
                  >
                    <p
                      ref={summaryRef}
                      className={`text-[13px] leading-5 text-slate-500 dark:text-slate-400 ${isTextExpanded ? 'whitespace-normal break-words' : 'line-clamp-2'}`}
                    >
                      {node.summary}
                    </p>
                  </EditableText>
                </div>
                <span className="shrink-0 text-[12px] font-semibold text-slate-500 dark:text-slate-400">
                  P. {node.page_start}
                  {node.page_end !== node.page_start ? `-${node.page_end}` : ''}
                </span>
              </div>
            </div>
          </div>
          {shouldShowTextToggle ? (
            <button
              type="button"
              className="absolute bottom-4 right-4 rounded-md bg-white/70 px-1.5 py-0.5 text-[11px] font-semibold text-slate-500/70 opacity-75 transition hover:bg-slate-200/80 hover:text-slate-700 hover:opacity-100 dark:bg-[#171717]/70 dark:text-slate-400/70 dark:hover:bg-white/10 dark:hover:text-white"
              aria-label={isTextExpanded ? `收起文本 ${node.title}` : `展开文本 ${node.title}`}
              onClick={() => onToggleText(node.id)}
            >
              {isTextExpanded ? '收起' : '展开'}
            </button>
          ) : null}
        </div>
      </div>
      {hasChildren && isExpanded ? (
        <ul className="mt-1 space-y-1">
          {node.children.map((childNode) => (
            <DocumentationTreeNode
              key={childNode.id}
              docId={docId}
              expandedNodeIds={expandedNodeIds}
              expandedTextNodeIds={expandedTextNodeIds}
              level={level + 1}
              node={childNode}
              onCitationClick={onCitationClick}
              onRequestTextEdit={onRequestTextEdit}
              onToggleText={onToggleText}
              onToggle={onToggle}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
};

export default DocumentationTreeNode;
