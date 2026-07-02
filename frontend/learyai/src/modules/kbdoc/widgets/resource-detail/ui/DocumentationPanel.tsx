// DocumentationPanel 负责装配文档目录树、筛选、展开态与节点文本编辑入口。
import React from 'react';
import MaterialIcon from '@/shared/ui/icons/MaterialIcon';
import {
  collectExpandedNodeIds,
  filterDocumentationNodes,
  type DocumentationCitationPayload,
  type DocumentationTree,
} from '../../../entities/resource';
import type { ResourceTextEditAnchor } from '../lib/resourceTextEdit';
import DocumentationTreeNode from './DocumentationTreeNode';

interface DocumentationPanelProps {
  docId: string;
  tree: DocumentationTree;
  className?: string;
  onCitationClick?: (payload: DocumentationCitationPayload) => void;
  onRequestTextEdit?: (payload: {
    title: string;
    value: string;
    anchor: ResourceTextEditAnchor;
    multiline?: boolean;
  }) => void;
}

interface DocumentationPanelContentProps {
  className?: string;
  docId: string;
  documentationTree: DocumentationTree;
  onCitationClick?: (payload: DocumentationCitationPayload) => void;
  onRequestTextEdit?: (payload: {
    title: string;
    value: string;
    anchor: ResourceTextEditAnchor;
    multiline?: boolean;
  }) => void;
}

const DocumentationPanelContent: React.FC<DocumentationPanelContentProps> = ({
  className,
  docId,
  documentationTree,
  onCitationClick,
  onRequestTextEdit,
}) => {
  const expandableNodeIds = React.useMemo(
    () => collectExpandedNodeIds(documentationTree.nodes),
    [documentationTree]
  );
  const [expandedNodeIds, setExpandedNodeIds] = React.useState<Set<string>>(
    () => new Set(expandableNodeIds)
  );
  const [expandedTextNodeIds, setExpandedTextNodeIds] = React.useState<Set<string>>(new Set());
  const [filterText, setFilterText] = React.useState('');
  const visibleNodes = React.useMemo(
    () => filterDocumentationNodes(documentationTree.nodes, filterText),
    [documentationTree.nodes, filterText]
  );
  const visibleExpandableNodeIds = React.useMemo(
    () => collectExpandedNodeIds(visibleNodes),
    [visibleNodes]
  );
  const forcedExpandedNodeIds = React.useMemo(
    () => new Set(visibleExpandableNodeIds),
    [visibleExpandableNodeIds]
  );
  const normalizedFilterText = filterText.trim();
  const effectiveExpandedNodeIds = normalizedFilterText ? forcedExpandedNodeIds : expandedNodeIds;
  const isAllExpanded = visibleExpandableNodeIds.every((nodeId) => effectiveExpandedNodeIds.has(nodeId));

  const handleToggle = React.useCallback((nodeId: string) => {
    setExpandedNodeIds((currentSet) => {
      const nextSet = new Set(currentSet);
      if (nextSet.has(nodeId)) {
        nextSet.delete(nodeId);
      } else {
        nextSet.add(nodeId);
      }
      return nextSet;
    });
  }, []);

  const handleToggleText = React.useCallback((nodeId: string) => {
    setExpandedTextNodeIds((currentSet) => {
      const nextSet = new Set(currentSet);
      if (nextSet.has(nodeId)) {
        nextSet.delete(nodeId);
      } else {
        nextSet.add(nodeId);
      }
      return nextSet;
    });
  }, []);

  const handleToggleAll = React.useCallback(() => {
    if (normalizedFilterText) {
      return;
    }
    setExpandedNodeIds(isAllExpanded ? new Set() : new Set(expandableNodeIds));
  }, [expandableNodeIds, isAllExpanded, normalizedFilterText]);

  return (
    <section className={`flex h-full min-h-0 flex-col overflow-hidden bg-[#f5f6fa] dark:bg-[#171717] ${className ?? ''}`}>
      <div className="flex items-center justify-between border-b border-slate-300 bg-[#eef0f5] px-4 py-4 dark:border-[#2a2a2a] dark:bg-[#1b1b1b]">
        <div className="text-[15px] font-semibold tracking-tight text-slate-800 dark:text-slate-100">
          Directory
        </div>
        <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
          <button
            type="button"
            className="inline-flex size-8 items-center justify-center rounded-lg transition-colors hover:bg-white hover:text-slate-800 dark:hover:bg-white/10 dark:hover:text-white"
            aria-label={isAllExpanded ? '收起全部' : '展开全部'}
            onClick={handleToggleAll}
            disabled={Boolean(normalizedFilterText)}
          >
            <MaterialIcon name={isAllExpanded ? 'unfold_less' : 'unfold_more'} className="text-[18px]" />
          </button>
        </div>
      </div>
      <div className="border-b border-slate-200 px-3 py-3 dark:border-[#2a2a2a]">
        <label className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-400 shadow-sm dark:border-[#2a2a2a] dark:bg-[#121212]">
          <MaterialIcon name="filter_list" className="text-base" />
          <input
            value={filterText}
            onChange={(event) => setFilterText(event.target.value)}
            placeholder="Filter nodes..."
            className="w-full bg-transparent text-[13px] text-slate-600 outline-none placeholder:text-slate-400 dark:text-slate-200"
          />
        </label>
      </div>
      <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-3 custom-scrollbar">
        {visibleNodes.map((node) => (
          <DocumentationTreeNode
            key={node.id}
            docId={docId}
            expandedNodeIds={effectiveExpandedNodeIds}
            expandedTextNodeIds={expandedTextNodeIds}
            level={0}
            node={node}
            onCitationClick={onCitationClick}
            onRequestTextEdit={onRequestTextEdit}
            onToggleText={handleToggleText}
            onToggle={handleToggle}
          />
        ))}
      </ul>
    </section>
  );
};

const DocumentationPanel: React.FC<DocumentationPanelProps> = ({
  docId,
  tree,
  className,
  onCitationClick,
  onRequestTextEdit,
}) => (
  <DocumentationPanelContent
    key={`${docId}-${tree.version}-${tree.nodes.length}`}
    className={className}
    docId={docId}
    documentationTree={tree}
    onCitationClick={onCitationClick}
    onRequestTextEdit={onRequestTextEdit}
  />
);

export default DocumentationPanel;
