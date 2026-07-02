// render selectors 负责把 AI Chat 原始消息状态转换为纯渲染 view model。
import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '@/app/store';
import type { RenderMessage } from '../view/renderMessage';
import {
  selectActivePendingHooks,
  selectActivePendingPermission,
  selectActivePendingQuestions,
  selectActivePendingTools,
  selectActiveSessionMessages,
  selectActiveSessionNeedContext,
  selectActiveSessionStatus,
  selectActiveTargetSessionId,
  selectConnectionStatus,
} from './state';
import { buildGroupedBlocks } from './groupBlocks';
import { buildRenderBlocksFromGrouped } from './renderBlockBuilders';
import { deriveRenderUiState } from './deriveRenderUiState';

const EMPTY_DOC_NAME_MAP: Record<string, string> = {};

const selectDocNameMap = (state: RootState) => state.resourceCenter?.docNameMap ?? EMPTY_DOC_NAME_MAP;

export { REPLACED_CONNECTION_MESSAGE } from './renderConstants';

export const selectActiveSessionRenderMessages = createSelector(
  [
    selectActiveSessionMessages,
    selectActivePendingPermission,
    selectActivePendingQuestions,
    selectActivePendingHooks,
    selectActivePendingTools,
    selectDocNameMap,
  ],
  (messages, pendingPermission, pendingQuestions, pendingHooks, pendingTools, docNameMap) => {
    const baseMessages = messages.map<RenderMessage>((message) => ({
      id: message.id,
      sender: message.sender,
      blocks: buildRenderBlocksFromGrouped(buildGroupedBlocks(message.blocks, message.id), {
        sender: message.sender,
        docNameMap,
      }),
    }));
    const pendingMessages: Array<RenderMessage & { createdAt: string }> = [];

    if (pendingPermission) {
      pendingMessages.push({
        id: `pending-permission-${pendingPermission.requestId ?? pendingPermission.toolCallId}`,
        sender: 'assistant',
        createdAt: pendingPermission.createdAt ?? '',
        blocks: [
          {
            kind: 'permission_request',
            key: `permission-${pendingPermission.requestId ?? pendingPermission.toolCallId}`,
            request: pendingPermission,
          },
        ],
      });
    }

    pendingQuestions.forEach((request) => {
      pendingMessages.push({
        id: `pending-question-${request.requestId}`,
        sender: 'assistant',
        createdAt: request.createdAt ?? '',
        blocks: [
          {
            kind: 'question_request',
            key: `question-${request.requestId}`,
            request,
          },
        ],
      });
    });

    pendingHooks.forEach((request) => {
      pendingMessages.push({
        id: `pending-hook-${request.requestId}`,
        sender: 'assistant',
        createdAt: request.createdAt ?? '',
        blocks: [
          {
            kind: 'hook_request',
            key: `hook-${request.requestId}`,
            request,
          },
        ],
      });
    });

    pendingTools.forEach((request) => {
      pendingMessages.push({
        id: `pending-tool-${request.toolCallId}`,
        sender: 'assistant',
        createdAt: request.createdAt ?? '',
        blocks: [
          {
            kind: 'tool_request',
            key: `tool-${request.toolCallId}`,
            request,
          },
        ],
      });
    });

    pendingMessages.sort((left, right) => left.createdAt.localeCompare(right.createdAt));

    return [...baseMessages, ...pendingMessages];
  }
);

export const selectActiveSessionRenderUiState = createSelector(
  [
    selectActiveTargetSessionId,
    selectActiveSessionMessages,
    selectActiveSessionStatus,
    selectActiveSessionNeedContext,
    selectConnectionStatus,
  ],
  (activeTargetSessionId, messages, sessionStatus, needContext, connectionStatus) =>
    deriveRenderUiState({
      activeSessionId: activeTargetSessionId,
      messages,
      sessionStatus,
      needContext,
      connectionStatus,
    })
);
