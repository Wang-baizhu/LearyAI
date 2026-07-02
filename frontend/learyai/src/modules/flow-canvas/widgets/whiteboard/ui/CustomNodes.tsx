/** 责任：定义白板普通节点与注释节点的视觉结构和交互样式。 */
import React from 'react';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import MaterialIcon from '@/shared/ui/icons/MaterialIcon';
import type { AppNodeData } from '../../../entities/graph';
import { mergeClassName } from '../../../shared/lib/className';

export const ResizableNode: React.FC<NodeProps> = ({ id, data, selected }) => {
  const nodeData = data as unknown as AppNodeData;
  const isDocNode = nodeData.resourceKind === 'kbdoc';
  const isTemplateNode = nodeData.resourceKind === 'template';
  const isResourceNode = isDocNode || isTemplateNode;
  const templateKind = nodeData.pluginId ?? nodeData.templateType;
  const isMindmapNode = templateKind === 'mindmap';
  const isQuizNode = templateKind === 'quiz';
  const emphasis = nodeData.emphasis;
  const toneClassName = isDocNode
    ? 'border-sky-300 bg-sky-50 text-sky-950'
    : isMindmapNode
      ? 'border-emerald-300 bg-emerald-50 text-emerald-950'
      : isQuizNode
        ? 'border-amber-300 bg-amber-50 text-amber-950'
        : isTemplateNode
          ? 'border-violet-300 bg-violet-50 text-violet-950'
          : 'border-slate-200 bg-white text-slate-900';
  const badgeLabel = isDocNode
    ? '文档'
    : isMindmapNode
      ? '思维导图'
      : isQuizNode
        ? '测验'
        : isTemplateNode
          ? '模板'
          : null;
  const cardStateClassName = selected
    ? 'border-blue-500 shadow-blue-100 ring-2 ring-blue-200/80'
    : emphasis === 'related'
      ? 'shadow-xl ring-1 ring-slate-300/80'
      : emphasis === 'dim'
        ? 'shadow-sm saturate-[0.7]'
        : '';

  return (
    <div className="group relative w-full h-full min-w-[100px] min-h-[40px]">
      <NodeResizer
        color="#3b82f6"
        isVisible={selected}
        minWidth={100}
        minHeight={40}
        handleClassName="!w-2 !h-2 !bg-white !border-2 !border-blue-500 rounded-full"
      />

      {/* 视觉卡片：在这里控制背景，不填充完整区域以留出手柄余量 */}
      <div
        className={mergeClassName(
          'w-full h-full px-4 py-3 shadow-lg rounded-2xl border-2 flex items-center justify-center text-center transition-shadow',
          toneClassName,
          cardStateClassName
        )}
      >
        {isResourceNode ? (
          <button
            type="button"
            aria-label="打开详情标签"
            className={mergeClassName(
              'absolute top-2 right-2 z-20 flex h-7 w-7 items-center justify-center rounded-full border border-white/80 bg-white/90 text-slate-500 shadow-sm transition hover:border-blue-200 hover:text-blue-600',
              selected || emphasis === 'related' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            )}
            onClick={(event) => {
              event.stopPropagation();
              nodeData.onOpenResource?.({
                nodeId: id,
                label: nodeData.label,
                refId: nodeData.refId,
                refKind: nodeData.refKind,
              });
            }}
          >
            <MaterialIcon name="open_in_new" className="text-[16px]" />
          </button>
        ) : null}
        <div className="flex flex-col gap-2 pointer-events-none select-none">
          {badgeLabel && (
            <div className="flex items-center justify-center gap-2">
              <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold tracking-[0.08em] text-slate-600">
                {badgeLabel}
              </span>
            </div>
          )}
          <span className="font-bold text-sm whitespace-nowrap">{nodeData.label}</span>
          {nodeData.description && (
            <span className="text-[10px] max-w-full truncate opacity-70">
              {nodeData.description}
            </span>
          )}
        </div>
      </div>

      {/* 四个方向的连接点 - 每个方向都支持起点和终点 */}
      {/* Top */}
      <Handle type="target" position={Position.Top} id="t-t" className="!w-2 !h-2 !bg-blue-400 !border-white transition-transform hover:scale-150" />
      <Handle type="source" position={Position.Top} id="t-s" className="!w-2 !h-2 !bg-blue-400 !border-white opacity-0" />

      {/* Bottom */}
      <Handle type="target" position={Position.Bottom} id="b-t" className="!w-2 !h-2 !bg-blue-400 !border-white transition-transform hover:scale-150" />
      <Handle type="source" position={Position.Bottom} id="b-s" className="!w-2 !h-2 !bg-blue-400 !border-white opacity-0" />

      {/* Left */}
      <Handle type="target" position={Position.Left} id="l-t" className="!w-2 !h-2 !bg-blue-400 !border-white transition-transform hover:scale-150" />
      <Handle type="source" position={Position.Left} id="l-s" className="!w-2 !h-2 !bg-blue-400 !border-white opacity-0" />

      {/* Right */}
      <Handle type="target" position={Position.Right} id="r-t" className="!w-2 !h-2 !bg-blue-400 !border-white transition-transform hover:scale-150" />
      <Handle type="source" position={Position.Right} id="r-s" className="!w-2 !h-2 !bg-blue-400 !border-white opacity-0" />
    </div>
  );
};

export const AnnotationNode: React.FC<NodeProps> = ({ data, selected }) => {
  const nodeData = data as unknown as AppNodeData;

  return (
    <div className="relative w-full h-full min-w-[150px] min-h-[100px]">
      <NodeResizer
        color="#facc15"
        isVisible={selected}
        minWidth={150}
        minHeight={100}
        handleClassName="!w-2 !h-2 !bg-white !border-2 !border-yellow-500 rounded-full"
      />

      <div
        className={mergeClassName(
          'relative w-full h-full p-6 shadow-sm border-2 border-dashed bg-yellow-50/40 rounded-2xl overflow-hidden transition-all',
          selected ? 'border-yellow-400 bg-yellow-100/50' : 'border-yellow-200'
        )}
      >
        <div className="absolute inset-0 -z-10 bg-transparent" aria-hidden="true" />
        <div
          className={mergeClassName(
            'relative flex h-full flex-col items-center justify-center text-center pointer-events-none select-none transition-all',
            selected ? 'z-10' : '-z-10'
          )}
        >
          <span className="text-yellow-800 text-lg font-medium italic">
            {nodeData.label}
          </span>
          {nodeData.description && (
            <span className="text-yellow-600/60 text-xs mt-3 max-w-[80%]">
              {nodeData.description}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
