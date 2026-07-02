/** 责任：渲染支持说明展示与中点快捷编辑入口的白板边。 */
import React from 'react';
import {
  BaseEdge,
  getBezierPath,
  EdgeLabelRenderer,
  Position,
} from '@xyflow/react';
import type { EdgeProps } from '@xyflow/react';
import type { AppEdgeData } from '@/modules/flow-canvas/entities/graph';

const resolveEdgeTone = (label: string) => {
  if (!label) {
    return {
      stroke: '#64748b',
      background: '#ffffff',
      text: '#475569',
      border: '#cbd5e1',
    };
  }

  if (/(前置|依赖|基于|来源)/.test(label)) {
    return {
      stroke: '#2563eb',
      background: '#eff6ff',
      text: '#1d4ed8',
      border: '#93c5fd',
    };
  }

  if (/(支撑|解释|映射|对应)/.test(label)) {
    return {
      stroke: '#059669',
      background: '#ecfdf5',
      text: '#047857',
      border: '#86efac',
    };
  }

  if (/(并列|对照|比较|互补)/.test(label)) {
    return {
      stroke: '#7c3aed',
      background: '#f5f3ff',
      text: '#6d28d9',
      border: '#c4b5fd',
    };
  }

  return {
    stroke: '#64748b',
    background: '#ffffff',
    text: '#475569',
    border: '#cbd5e1',
  };
};

const getHandleDirectionVector = (position: Position) => {
  switch (position) {
    case Position.Left:
      return { x: -1, y: 0 };
    case Position.Right:
      return { x: 1, y: 0 };
    case Position.Top:
      return { x: 0, y: -1 };
    case Position.Bottom:
      return { x: 0, y: 1 };
    default:
      return { x: 0, y: 0 };
  }
};

const sampleBezierPoint = (
  start: number,
  controlOne: number,
  controlTwo: number,
  end: number,
  ratio: number
) => {
  const inverseRatio = 1 - ratio;
  return (inverseRatio ** 3) * start
    + 3 * (inverseRatio ** 2) * ratio * controlOne
    + 3 * inverseRatio * (ratio ** 2) * controlTwo
    + (ratio ** 3) * end;
};

const getParallelBezierPath = ({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  parallelEdgeOffset,
}: {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: Position;
  targetPosition: Position;
  parallelEdgeOffset: number;
}) => {
  const deltaX = targetX - sourceX;
  const deltaY = targetY - sourceY;
  const distance = Math.hypot(deltaX, deltaY) || 1;
  const perpendicularX = -deltaY / distance;
  const perpendicularY = deltaX / distance;
  const sourceVector = getHandleDirectionVector(sourcePosition);
  const targetVector = getHandleDirectionVector(targetPosition);
  const controlDistance = Math.max(40, Math.min(120, distance * 0.35));

  const controlOneX = sourceX + sourceVector.x * controlDistance + perpendicularX * parallelEdgeOffset;
  const controlOneY = sourceY + sourceVector.y * controlDistance + perpendicularY * parallelEdgeOffset;
  const controlTwoX = targetX + targetVector.x * controlDistance + perpendicularX * parallelEdgeOffset;
  const controlTwoY = targetY + targetVector.y * controlDistance + perpendicularY * parallelEdgeOffset;
  const labelRatio = 0.5;
  const labelX = sampleBezierPoint(sourceX, controlOneX, controlTwoX, targetX, labelRatio);
  const labelY = sampleBezierPoint(sourceY, controlOneY, controlTwoY, targetY, labelRatio);

  return [
    `M${sourceX},${sourceY} C${controlOneX},${controlOneY} ${controlTwoX},${controlTwoY} ${targetX},${targetY}`,
    labelX,
    labelY,
  ] as const;
};

export const SmartReconnectEdge: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  label,
  data,
}) => {
  const [isMidpointHovered, setIsMidpointHovered] = React.useState(false);
  const edgeData = data as AppEdgeData | undefined;
  const parallelEdgeOffset = edgeData?.parallelEdgeOffset;
  const [edgePath, labelX, labelY] = parallelEdgeOffset
    ? getParallelBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
        parallelEdgeOffset,
      })
    : getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
      });
  const onEditLabel = (edgeData as { onEditLabel?: (edgeId: string, currentLabel: string) => void } | undefined)?.onEditLabel;
  const currentLabel = typeof label === 'string' ? label : '';
  const edgeTone = resolveEdgeTone(currentLabel);
  const edgeOpacity = typeof style.opacity === 'number' ? style.opacity : 1;
  const isFocusedEdge = edgeData?.emphasis === 'focus';
  const edgeLayerZIndex = typeof edgeData?.overlayZIndex === 'number' ? edgeData.overlayZIndex : 0;
  const labelOverlayZIndex = isFocusedEdge ? edgeLayerZIndex + 1000 : undefined;

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{ ...style, strokeWidth: currentLabel ? 2.4 : 1.8, stroke: edgeTone.stroke }}
      />

      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
            zIndex: labelOverlayZIndex,
            isolation: isFocusedEdge ? 'isolate' : undefined,
          }}
          onMouseEnter={() => setIsMidpointHovered(true)}
          onMouseLeave={() => setIsMidpointHovered(false)}
        >
          <div
            style={{
              position: 'relative',
              zIndex: labelOverlayZIndex,
              minWidth: '32px',
              minHeight: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {currentLabel && (
                <div
                style={{
                  position: 'relative',
                  zIndex: labelOverlayZIndex,
                  fontSize: '12px',
                  fontWeight: 600,
                  backgroundColor: edgeTone.background,
                  padding: '3px 10px',
                  borderRadius: '999px',
                  border: `1px solid ${edgeTone.border}`,
                  color: edgeTone.text,
                  boxShadow: '0 4px 14px rgba(15, 23, 42, 0.08)',
                  whiteSpace: 'nowrap',
                  opacity: edgeOpacity,
                }}
              >
                {currentLabel}
              </div>
            )}

            <button
              type="button"
              aria-label={currentLabel ? '编辑说明' : '添加说明'}
              onClick={(event) => {
                event.stopPropagation();
                onEditLabel?.(id, currentLabel);
              }}
              style={{
                position: 'relative',
                zIndex: labelOverlayZIndex,
                opacity: (!currentLabel && isMidpointHovered ? 1 : 0) * edgeOpacity,
                transform: `scale(${!currentLabel && isMidpointHovered ? 1 : 0.85})`,
                transition: 'opacity 120ms ease, transform 120ms ease',
                width: '24px',
                height: '24px',
                borderRadius: '999px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#2563eb',
                boxShadow: '0 8px 20px rgba(37, 99, 235, 0.16)',
                fontSize: '16px',
                lineHeight: 1,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: currentLabel ? 'none' : 'auto',
              }}
            >
              +
            </button>
          </div>
        </div>
      </EdgeLabelRenderer>

      {/* 交互说明：
          React Flow 的 onReconnect 功能通常配合特定的 Handle 使用。
          为了实现“点击边即可重连一半”，我们可以依赖默认的重连手柄位置，
          或者在 index.tsx 中通过 onEdgeClick 配合 setEdges 逻辑实现。
      */}
    </>
  );
};
