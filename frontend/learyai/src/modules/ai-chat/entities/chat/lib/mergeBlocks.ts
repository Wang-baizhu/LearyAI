// mergeMessageBlocks 负责合并消息 blocks，并同步工具调用与结果的状态。
import type { ChatMessage } from '../model/types/schema';

const MARKDOWN_TABLE_SEPARATOR_PATTERN = /^\s*\|?(?:\s*:?-{3,}:?\s*\|)+(?:\s*:?-{3,}:?\s*)?$/;
const MARKDOWN_TABLE_ROW_PATTERN = /^\s*\|(?:[^|\n]*\|)+\s*$/;

const getLastLine = (value: string) => {
  const segments = value.split('\n');
  return segments[segments.length - 1] ?? '';
};

const getFirstLine = (value: string) => {
  const segments = value.split('\n');
  return segments[0] ?? '';
};

const isMarkdownTableSeparatorLine = (value: string) => MARKDOWN_TABLE_SEPARATOR_PATTERN.test(value.trim());

const isMarkdownTableRowLine = (value: string) => MARKDOWN_TABLE_ROW_PATTERN.test(value.trim());

const shouldInsertMarkdownBoundaryNewline = (existing: string, incoming: string) => {
  if (!existing || !incoming || existing.endsWith('\n') || incoming.startsWith('\n')) {
    return false;
  }

  const existingLastLine = getLastLine(existing);
  const incomingFirstLine = getFirstLine(incoming);

  if (!existingLastLine || !incomingFirstLine) {
    return false;
  }

  return (
    (isMarkdownTableRowLine(existingLastLine) &&
      (isMarkdownTableSeparatorLine(incomingFirstLine) || isMarkdownTableRowLine(incomingFirstLine))) ||
    (isMarkdownTableSeparatorLine(existingLastLine) && isMarkdownTableRowLine(incomingFirstLine))
  );
};

const findOverlapSize = (existing: string, incoming: string) => {
  const maxOverlap = Math.min(existing.length, incoming.length);
  for (let size = maxOverlap; size > 0; size -= 1) {
    if (existing.endsWith(incoming.slice(0, size))) {
      return size;
    }
  }

  return 0;
};

const mergeOverlappingText = (existing: string, incoming: string) => {
  if (!incoming) return existing;
  if (!existing) return incoming;

  if (shouldInsertMarkdownBoundaryNewline(existing, incoming)) {
    const overlapSize = findOverlapSize(existing, incoming);
    if (overlapSize <= 1) {
      return `${existing}\n${incoming}`;
    }

    const remaining = incoming.slice(overlapSize);
    if (!remaining) {
      return existing;
    }

    return shouldInsertMarkdownBoundaryNewline(existing, remaining)
      ? `${existing}\n${remaining}`
      : `${existing}${remaining}`;
  }

  const overlapSize = findOverlapSize(existing, incoming);
  if (overlapSize > 0) {
    const remaining = incoming.slice(overlapSize);
    if (!remaining) {
      return existing;
    }

    return shouldInsertMarkdownBoundaryNewline(existing, remaining)
      ? `${existing}\n${remaining}`
      : `${existing}${remaining}`;
  }

  return shouldInsertMarkdownBoundaryNewline(existing, incoming)
    ? `${existing}\n${incoming}`
    : `${existing}${incoming}`;
};

export const mergeMessageBlocks = (
  existing: ChatMessage['blocks'],
  incoming: ChatMessage['blocks']
) => mergeBlocks(existing, incoming);

const mergeBlocks = (existing: ChatMessage['blocks'], incoming: ChatMessage['blocks']) => {
  const merged = [...existing];
  incoming.forEach((block) => {
    if (block.type === 'text') {
      const lastIndex = merged.length - 1;
      const last = merged[lastIndex];
      if (last?.type === 'text') {
        merged[lastIndex] = {
          ...last,
          text: mergeOverlappingText(last.text, block.text),
        };
        return;
      }
    }
    if (block.type === 'thinking') {
      const lastIndex = merged.length - 1;
      const last = merged[lastIndex];
      if (last?.type === 'thinking') {
        merged[lastIndex] = {
          ...last,
          text: mergeOverlappingText(last.text ?? '', block.text ?? ''),
        };
        return;
      }
    }
    if (block.type === 'tool_call') {
      const index = merged.findIndex(
        (item) => item.type === 'tool_call' && item.toolCallId === block.toolCallId
      );
      if (index >= 0) {
        const current = merged[index] as Extract<ChatMessage['blocks'][number], { type: 'tool_call' }>;
        const next = {
          ...current,
          ...block,
          title: block.title || current.title,
          args: block.args || current.args,
          subagentName: block.subagentName ?? current.subagentName,
          taskToolCallId: block.taskToolCallId ?? current.taskToolCallId,
        };
        const isCompleted = ['completed', 'succeeded', 'failed'].includes(block.status);
        const hasSearchArgs = Boolean(current.args);
        const hasResultArgs = Boolean(block.args) && block.args !== current.args;
        if (isCompleted && hasSearchArgs && hasResultArgs && block.args) {
          next.args = current.args;
          const resultIndex = merged.findIndex(
            (item) => item.type === 'tool_result' && item.toolCallId === block.toolCallId
          );
          const resultBlock = {
            type: 'tool_result' as const,
            toolCallId: block.toolCallId,
            result: block.args,
            status: block.status,
          };
          if (resultIndex >= 0) {
            const currentResult = merged[resultIndex] as Extract<
              ChatMessage['blocks'][number],
              { type: 'tool_result' }
            >;
            merged[resultIndex] = { ...currentResult, ...resultBlock };
          } else {
            merged.splice(index + 1, 0, resultBlock);
          }
        }
        merged[index] = next;
        return;
      }
    }
    if (block.type === 'tool_result') {
      const index = merged.findIndex(
        (item) => item.type === 'tool_result' && item.toolCallId === block.toolCallId
      );
      const callIndex = merged.findIndex(
        (item) => item.type === 'tool_call' && item.toolCallId === block.toolCallId
      );
      if (index >= 0) {
        const currentResult = merged[index] as Extract<ChatMessage['blocks'][number], { type: 'tool_result' }>;
        merged[index] = { ...currentResult, ...block };
      } else {
        merged.push(block);
      }
      if (callIndex >= 0) {
        const updatedResultIndex = merged.findIndex(
          (item) => item.type === 'tool_result' && item.toolCallId === block.toolCallId
        );
        const updatedCallIndex = merged.findIndex(
          (item) => item.type === 'tool_call' && item.toolCallId === block.toolCallId
        );
        if (updatedResultIndex >= 0 && updatedCallIndex >= 0 && updatedResultIndex !== updatedCallIndex + 1) {
          const [resultItem] = merged.splice(updatedResultIndex, 1);
          const callIndexAfterRemoval =
            updatedResultIndex < updatedCallIndex ? updatedCallIndex - 1 : updatedCallIndex;
          merged.splice(callIndexAfterRemoval + 1, 0, resultItem);
        }
      }
      if (callIndex >= 0) {
        const call = merged[callIndex] as Extract<ChatMessage['blocks'][number], { type: 'tool_call' }>;
        if (call.status === 'in_progress') {
          merged[callIndex] = {
            ...call,
            status: block.status ?? 'succeeded',
          };
        }
      }
      if (callIndex < 0 && block.taskToolCallId) {
        let lastSubagentIndex = -1;
        for (let idx = 0; idx < merged.length; idx += 1) {
          const item = merged[idx];
          if (item.type === 'subagent' && item.taskToolCallId === block.taskToolCallId) {
            lastSubagentIndex = idx;
          }
        }
        if (lastSubagentIndex >= 0) {
          const updatedResultIndex = merged.findIndex(
            (item) => item.type === 'tool_result' && item.toolCallId === block.toolCallId
          );
          if (updatedResultIndex >= 0 && updatedResultIndex !== lastSubagentIndex + 1) {
            const [resultItem] = merged.splice(updatedResultIndex, 1);
            const insertIndex =
              updatedResultIndex < lastSubagentIndex ? lastSubagentIndex : lastSubagentIndex + 1;
            merged.splice(insertIndex, 0, resultItem);
          }
        }
      }
      return;
    }
    if (block.type === 'subagent' && block.taskToolCallId) {
      const index = merged.findIndex(
        (item) =>
          item.type === 'subagent' &&
          item.taskToolCallId === block.taskToolCallId &&
          item.status === block.status
      );
      if (index >= 0) {
        const current = merged[index] as Extract<ChatMessage['blocks'][number], { type: 'subagent' }>;
        const nextText =
          block.status === 'update' && block.text
            ? mergeOverlappingText(current.text ?? '', block.text)
            : current.text;
        merged[index] = {
          ...current,
          name: block.name || current.name,
          status: block.status ?? current.status,
          text: nextText,
        };
        return;
      }
    }
    if (block.type === 'permission') {
      const index = merged.findIndex(
        (item) => item.type === 'permission' && item.toolCallId === block.toolCallId
      );
      if (index >= 0) {
        merged[index] = { ...merged[index], ...block };
        return;
      }
    }
    merged.push(block);
  });
  return merged;
};
