// useScopedSessionView 负责按当前知识库隔离会话列表，并在知识库切换时重置当前会话。
import { useEffect, useMemo, useRef } from 'react';
import type { AppDispatch } from '@/app/store';
import { enterTempSession, setActiveSessionId, TEMP_SESSION_ID } from '../store/slice';
import type { AgentSessionSummary } from '../types/schema';

interface UseScopedSessionViewParams {
  sessions: AgentSessionSummary[];
  activeSessionId: string | null;
  kbId?: string;
  dispatch: AppDispatch;
}

const normalizeId = (value?: string | null) => (value?.trim() ? value.trim() : undefined);

export const useScopedSessionView = ({
  sessions,
  activeSessionId,
  kbId,
  dispatch,
}: UseScopedSessionViewParams) => {
  const normalizedCurrentKbId = normalizeId(kbId);
  const filteredSessions = useMemo(
    () =>
      sessions.filter((session) => {
        if (session.sessionType === 'subagent') {
          return false;
        }
        if (!normalizedCurrentKbId) {
          return true;
        }
        return normalizeId(session.kbId) === normalizedCurrentKbId;
      }),
    [normalizedCurrentKbId, sessions]
  );
  const previousKbIdRef = useRef<string | undefined>(normalizedCurrentKbId);

  useEffect(() => {
    const previousKbId = previousKbIdRef.current;
    previousKbIdRef.current = normalizedCurrentKbId;
    const kbChanged = previousKbId !== undefined && previousKbId !== normalizedCurrentKbId;
    const activeSession = sessions.find((session) => session.id === activeSessionId);
    const hasVisibleActiveSession =
      activeSessionId === TEMP_SESSION_ID ||
      activeSession?.sessionType === 'subagent' ||
      filteredSessions.some((session) => session.id === activeSessionId);
    if (hasVisibleActiveSession && !kbChanged) {
      return;
    }
    if (filteredSessions.length > 0) {
      const nextSessionId = filteredSessions[0]?.id ?? null;
      if (nextSessionId && nextSessionId !== activeSessionId) {
        dispatch(setActiveSessionId(nextSessionId));
      }
      return;
    }
    dispatch(enterTempSession());
  }, [activeSessionId, dispatch, filteredSessions, normalizedCurrentKbId, sessions]);

  const activeSession = sessions.find((session) => session.id === activeSessionId);
  const isActiveSessionVisible =
    activeSessionId === TEMP_SESSION_ID ||
    activeSession?.sessionType === 'subagent' ||
    filteredSessions.some((session) => session.id === activeSessionId);

  return {
    filteredSessions,
    isActiveSessionVisible,
  };
};
