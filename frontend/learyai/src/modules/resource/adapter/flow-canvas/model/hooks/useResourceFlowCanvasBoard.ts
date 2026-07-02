// useResourceFlowCanvasBoard 负责加载资源中心全局视图数据并处理画布事件保存。
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  openResourceCenterResourceDetail,
  type ResourceCenterDetailOpenHandler,
} from '../../../../entities/resource-center';
import {
  parseFlowCanvasSnapshot,
} from '@/modules/flow-canvas';
import type {
  FlowCanvasEvent,
  FlowCanvasSnapshot,
} from '@/modules/flow-canvas';
import { resourceFlowCanvasApi } from '../effects/api';

const flowCanvasKeys = {
  canvas: (projectId?: string, kbId?: string) =>
    ['resource', 'flow-canvas', 'canvas', projectId ?? 'none', kbId ?? 'none'] as const,
  resourceCatalog: (projectId?: string, kbId?: string) =>
    ['resource', 'flow-canvas', 'resource-catalog', projectId ?? 'none', kbId ?? 'none'] as const,
};

export const useResourceFlowCanvasBoard = (
  projectId?: string,
  kbId?: string,
  onOpenDetailTab?: ResourceCenterDetailOpenHandler,
) => {
  const saveTimerRef = useRef<number | null>(null);
  const boardKey = `${projectId ?? 'none'}:${kbId ?? 'none'}`;
  const [localSnapshot, setLocalSnapshot] = useState<{
    boardKey: string;
    snapshot: FlowCanvasSnapshot;
  } | null>(null);
  const canvasQuery = useQuery({
    queryKey: flowCanvasKeys.canvas(projectId, kbId),
    queryFn: () => resourceFlowCanvasApi.getCanvas(projectId as string, kbId as string),
    enabled: Boolean(projectId) && Boolean(kbId),
  });
  const resourceCatalogQuery = useQuery({
    queryKey: flowCanvasKeys.resourceCatalog(projectId, kbId),
    queryFn: () => resourceFlowCanvasApi.getResourceCatalog(projectId as string, kbId as string),
    enabled: Boolean(projectId) && Boolean(kbId),
  });
  const updateCanvasMutation = useMutation({
    mutationFn: (snapshot: FlowCanvasSnapshot) =>
      resourceFlowCanvasApi.updateCanvas(projectId as string, kbId as string, snapshot),
  });
  const { mutate: saveCanvasSnapshot } = updateCanvasMutation;

  const queriedSnapshot = useMemo(() => (
    canvasQuery.data ? parseFlowCanvasSnapshot(canvasQuery.data) : undefined
  ), [canvasQuery.data]);

  const workingSnapshot = localSnapshot?.boardKey === boardKey
    ? localSnapshot.snapshot
    : queriedSnapshot;

  const handleEvent = useCallback((event: FlowCanvasEvent) => {
    if (event.type === 'nodeOpened') {
      if (!onOpenDetailTab || !event.refId || !event.refKind) {
        return;
      }
      const refId = event.refId;
      const label = event.label;
      openResourceCenterResourceDetail(onOpenDetailTab, {
        docId: refId,
        label,
      });
      return;
    }

    if (event.type !== 'snapshotChanged' || !projectId || !kbId) {
      return;
    }
    setLocalSnapshot({
      boardKey,
      snapshot: event.snapshot,
    });
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      saveCanvasSnapshot(event.snapshot);
    }, 1000);
  }, [boardKey, kbId, onOpenDetailTab, projectId, saveCanvasSnapshot]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [boardKey]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, []);

  return {
    snapshot: workingSnapshot,
    resourceCatalog: resourceCatalogQuery.data,
    state: {
      isLoading: canvasQuery.isLoading || resourceCatalogQuery.isLoading,
      isError: canvasQuery.isError || resourceCatalogQuery.isError,
      isSaving: updateCanvasMutation.isPending,
      saveError: updateCanvasMutation.isError,
    },
    handleEvent,
  };
};
