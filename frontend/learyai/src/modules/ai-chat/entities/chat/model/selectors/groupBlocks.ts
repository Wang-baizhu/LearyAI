// groupBlocks 负责把原始 content block 聚合成仅描述关系的中间结构。
import type { ContentBlock } from '../types/schema';
import type {
  GroupedBlock,
  GroupedSubagentGroupBlock,
  GroupedToolGroupBlock,
} from '../view/groupedBlock';

type MutableSubagentGroup = Omit<GroupedSubagentGroupBlock, 'kind' | 'key'>;

const createGroupedToolGroup = (
  key: string,
  call: Extract<ContentBlock, { type: 'tool_call' }>,
  result: Extract<ContentBlock, { type: 'tool_result' }>
): GroupedToolGroupBlock => ({
  kind: 'grouped_tool_group',
  key,
  call,
  result,
});

const createStandaloneGroupedBlock = (
  block: ContentBlock,
  key: string
): GroupedBlock | null => {
  switch (block.type) {
    case 'text':
      return { kind: 'grouped_text', key, text: block.text };
    case 'thinking':
      return { kind: 'grouped_thinking', key, text: block.text };
    case 'plan':
      return { kind: 'grouped_plan', key, content: block.content, filePath: block.filePath };
    case 'notification':
      return { kind: 'grouped_notification', key, notification: block };
    case 'status':
      return { kind: 'grouped_status', key, status: block };
    case 'tool_call':
      return { kind: 'grouped_tool_call', key, call: block };
    case 'user_question':
      return { kind: 'grouped_user_question', key, text: block.text };
    default:
      return null;
  }
};

const collectSubagentGroups = (blocks: ContentBlock[], messageId: string) => {
  const subagentGroups = new Map<string, MutableSubagentGroup>();

  const ensureGroup = (taskToolCallId: string) => {
    const existing = subagentGroups.get(taskToolCallId);
    if (existing) return existing;
    const next: MutableSubagentGroup = {
      taskToolCallId,
      name: 'subagent',
      status: 'update',
      description: undefined,
      flowBlocks: [],
      resultBlocks: [],
    };
    subagentGroups.set(taskToolCallId, next);
    return next;
  };

  blocks.forEach((block, index) => {
    if (block.type === 'subagent' && block.taskToolCallId) {
      const group = ensureGroup(block.taskToolCallId);
      if (block.name && block.name !== 'subagent') {
        group.name = block.name;
      }
      group.status = block.status;
      if (block.status === 'begin' && block.text && !group.description) {
        group.description = block.text;
      }
      if (block.status === 'update' && block.text) {
        group.flowBlocks.push({
          kind: 'grouped_text',
          key: `${messageId}-subagent-flow-${block.taskToolCallId}-text-${index}`,
          text: block.text,
        });
      }
      return;
    }

    if (block.type === 'tool_call' && block.taskToolCallId) {
      const group = ensureGroup(block.taskToolCallId);
      if (block.subagentName && block.subagentName !== 'subagent') {
        group.name = block.subagentName;
      }
      const next = blocks[index + 1];
      if (
        next?.type === 'tool_result' &&
        next.toolCallId === block.toolCallId &&
        next.taskToolCallId === block.taskToolCallId &&
        next.toolCallId !== next.taskToolCallId
      ) {
        group.flowBlocks.push(
          createGroupedToolGroup(
            `${messageId}-subagent-flow-${block.taskToolCallId}-tool-group-${block.toolCallId}-${index}`,
            block,
            next
          )
        );
        return;
      }
      group.flowBlocks.push({
        kind: 'grouped_tool_call',
        key: `${messageId}-subagent-flow-${block.taskToolCallId}-tool-call-${index}`,
        call: block,
      });
      return;
    }

    if (block.type === 'tool_result' && block.taskToolCallId) {
      const group = ensureGroup(block.taskToolCallId);
      if (block.toolCallId === block.taskToolCallId) {
        group.resultBlocks.push(block);
        return;
      }
      const previous = blocks[index - 1];
      if (
        previous?.type === 'tool_call' &&
        previous.toolCallId === block.toolCallId &&
        previous.taskToolCallId === block.taskToolCallId
      ) {
        return;
      }
    }
  });

  return subagentGroups;
};

export const buildGroupedBlocks = (blocks: ContentBlock[], messageId: string): GroupedBlock[] => {
  const subagentGroups = collectSubagentGroups(blocks, messageId);
  const renderedTaskIds = new Set<string>();
  const items: GroupedBlock[] = [];

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    const taskToolCallId =
      block.type === 'subagent' && block.taskToolCallId
        ? block.taskToolCallId
        : block.type === 'tool_call' && block.taskToolCallId
        ? block.taskToolCallId
        : block.type === 'tool_result' && block.taskToolCallId
        ? block.taskToolCallId
        : null;

    if (taskToolCallId) {
      if (renderedTaskIds.has(taskToolCallId)) {
        continue;
      }
      const group = subagentGroups.get(taskToolCallId);
      if (group) {
        items.push({
          kind: 'grouped_subagent_group',
          key: `${messageId}-subagent-${taskToolCallId}-${index}`,
          taskToolCallId,
          name: group.name,
          status: group.status,
          description: group.description,
          flowBlocks: group.flowBlocks,
          resultBlocks: group.resultBlocks,
        });
        renderedTaskIds.add(taskToolCallId);
        continue;
      }
    }

    if (block.type === 'tool_call') {
      const next = blocks[index + 1];
      if (next?.type === 'tool_result' && next.toolCallId === block.toolCallId) {
        items.push(
          createGroupedToolGroup(
            `${messageId}-tool-group-${block.toolCallId}-${index}`,
            block,
            next
          )
        );
        index += 1;
        continue;
      }
    }

    if (block.type === 'tool_result' || block.type === 'permission' || block.type === 'subagent') {
      continue;
    }

    const groupedBlock = createStandaloneGroupedBlock(block, `${messageId}-${block.type}-${index}`);
    if (groupedBlock) {
      items.push(groupedBlock);
    }
  }

  return items;
};
