// SidebarHistoryView 负责展示历史对话列表。
import React from 'react';
import type { AgentSessionSummary } from '../../../../entities';
import SessionList from './SessionList';

interface SidebarHistoryViewProps {
  isVisible: boolean;
  sessions: AgentSessionSummary[];
  pendingRequestCountBySessionId?: Record<string, number>;
  activeSessionId?: string | null;
  currentKbId?: string;
  isCreateSessionDisabled?: boolean;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onSelectSession?: (sessionId: string) => void;
  onCreateSession?: () => void;
  onRenameSession?: (sessionId: string, name: string) => void;
  onDeleteSession?: (sessionId: string) => void;
  onLoadMore?: () => void;
}

const SidebarHistoryView: React.FC<SidebarHistoryViewProps> = ({
  isVisible,
  sessions,
  pendingRequestCountBySessionId,
  activeSessionId,
  currentKbId,
  isCreateSessionDisabled,
  hasMore,
  isLoadingMore,
  onSelectSession,
  onCreateSession,
  onRenameSession,
  onDeleteSession,
  onLoadMore,
}) => (
  <SessionList
    isVisible={isVisible}
    sessions={sessions}
    pendingRequestCountBySessionId={pendingRequestCountBySessionId}
    activeSessionId={activeSessionId}
    currentKbId={currentKbId}
    isCreateSessionDisabled={isCreateSessionDisabled}
    hasMore={hasMore}
    isLoadingMore={isLoadingMore}
    onSelectSession={onSelectSession}
    onCreateSession={onCreateSession}
    onRenameSession={onRenameSession}
    onDeleteSession={onDeleteSession}
    onLoadMore={onLoadMore}
  />
);

export default SidebarHistoryView;
