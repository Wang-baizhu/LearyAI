// resolveMessageMergeTarget 负责为 message.blocks 事件定位目标消息并执行归并策略。
import { createTraceId } from '@/shared/lib/traceId';
import { mergeMessageBlocks } from '../../lib/mergeBlocks';
import type { ChatMessage, ChatSender, ContentBlock } from '../types/schema';

const collectToolCallIds = (blocks: ContentBlock[]) => {
  const ids = new Set<string>();
  blocks.forEach((block) => {
    if (block.type === 'tool_call' || block.type === 'tool_result') {
      ids.add(block.toolCallId);
    }
  });
  return ids;
};

const collectTaskToolCallIds = (blocks: ContentBlock[]) => {
  const ids = new Set<string>();
  blocks.forEach((block) => {
    if (block.type === 'subagent' && block.taskToolCallId) {
      ids.add(block.taskToolCallId);
    }
    if (block.type === 'tool_call' && block.taskToolCallId) {
      ids.add(block.taskToolCallId);
    }
    if (block.type === 'tool_result' && block.taskToolCallId) {
      ids.add(block.taskToolCallId);
    }
  });
  return ids;
};

const isSequentialAssistantBlock = (block: ContentBlock) =>
  block.type === 'text' || block.type === 'thinking';

const getLastSequentialAssistantBlock = (message: ChatMessage) => {
  for (let index = message.blocks.length - 1; index >= 0; index -= 1) {
    const block = message.blocks[index];
    if (isSequentialAssistantBlock(block)) {
      return block;
    }
  }
  return null;
};

export const findMessageIndexByTaskToolCallId = (
  messages: ChatMessage[],
  blocks: ContentBlock[]
) => {
  const taskToolCallIds = collectTaskToolCallIds(blocks);
  if (taskToolCallIds.size !== 1) return -1;
  const [taskToolCallId] = taskToolCallIds;
  return messages.findIndex((message) =>
    message.blocks.some((block) => {
      if (block.type === 'subagent' && block.taskToolCallId === taskToolCallId) {
        return true;
      }
      if (block.type === 'tool_call' && block.taskToolCallId === taskToolCallId) {
        return true;
      }
      return block.type === 'tool_result' && block.taskToolCallId === taskToolCallId;
    })
  );
};

export const findMessageIndexByToolCallId = (
  messages: ChatMessage[],
  blocks: ContentBlock[]
) => {
  const toolCallIds = collectToolCallIds(blocks);
  if (toolCallIds.size !== 1) return -1;
  const [toolCallId] = toolCallIds;
  return messages.findIndex((message) =>
    message.blocks.some(
      (block) => block.type === 'tool_call' && block.toolCallId === toolCallId
    )
  );
};

export const findSequentialAssistantMessageIndex = (
  messages: ChatMessage[],
  assistantMessageId: string | null,
  blocks: ContentBlock[],
  sender?: ChatSender
) => {
  if ((sender ?? 'assistant') !== 'assistant') return -1;
  if (blocks.length === 0 || !blocks.every(isSequentialAssistantBlock)) return -1;
  const firstIncomingBlock = blocks[0];

  if (assistantMessageId) {
    const anchorIndex = messages.findIndex(
      (message) => message.id === assistantMessageId && message.sender === 'assistant'
    );
    if (anchorIndex >= 0) {
      const anchorMessage = messages[anchorIndex];
      const lastSequentialBlock = getLastSequentialAssistantBlock(anchorMessage);
      if (lastSequentialBlock?.type === firstIncomingBlock.type) {
        return anchorIndex;
      }
    }
  }

  return -1;
};

export const mergeIntoExistingMessage = (
  messages: ChatMessage[],
  index: number,
  blocks: ContentBlock[],
  timestamp: string
) => ({
  messages: messages.map((message, currentIndex) =>
    currentIndex === index
      ? {
          ...message,
          blocks: mergeMessageBlocks(message.blocks, blocks),
          updatedAt: timestamp,
        }
      : message
  ),
  mergedMessageId: messages[index]?.id ?? null,
});

export const appendNewMessage = (
  messages: ChatMessage[],
  blocks: ContentBlock[],
  sender: ChatSender | undefined,
  timestamp: string
) => {
  const nextMessageId = `${sender ?? 'assistant'}-${createTraceId()}`;
  return {
    messages: [
      ...messages,
      {
        id: nextMessageId,
        sender: sender ?? 'assistant',
        blocks: mergeMessageBlocks([], blocks),
        updatedAt: timestamp,
      },
    ],
    mergedMessageId: nextMessageId,
  };
};

export const resolveMessageMergeTarget = (params: {
  messages: ChatMessage[];
  blocks: ContentBlock[];
  sender?: ChatSender;
  timestamp: string;
  assistantMessageId: string | null;
}) => {
  const { messages, blocks, sender, timestamp, assistantMessageId } = params;

  if (sender === 'user' || sender === 'system') {
    return {
      ...appendNewMessage(messages, blocks, sender, timestamp),
      assistantMessageId: null,
    };
  }

  const taskIndex = findMessageIndexByTaskToolCallId(messages, blocks);
  if (taskIndex >= 0) {
    const result = mergeIntoExistingMessage(messages, taskIndex, blocks, timestamp);
    return {
      ...result,
      assistantMessageId: result.mergedMessageId,
    };
  }

  const toolIndex = findMessageIndexByToolCallId(messages, blocks);
  if (toolIndex >= 0) {
    const result = mergeIntoExistingMessage(messages, toolIndex, blocks, timestamp);
    return {
      ...result,
      assistantMessageId: result.mergedMessageId,
    };
  }

  const sequentialIndex = findSequentialAssistantMessageIndex(
    messages,
    assistantMessageId,
    blocks,
    sender
  );
  if (sequentialIndex >= 0) {
    const result = mergeIntoExistingMessage(messages, sequentialIndex, blocks, timestamp);
    return {
      ...result,
      assistantMessageId: result.mergedMessageId,
    };
  }

  const result = appendNewMessage(messages, blocks, sender, timestamp);
  return {
    ...result,
    assistantMessageId: (sender ?? 'assistant') === 'assistant' ? result.mergedMessageId : null,
  };
};
