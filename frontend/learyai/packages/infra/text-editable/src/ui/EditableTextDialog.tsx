// EditableTextDialog 负责承载通用文本编辑弹层。
import { useMemo, useState } from 'react';
import Modal from './Modal';
import type { EditableTextSession } from '../model/types';

interface EditableTextDialogProps<TAnchor = unknown> {
  session: EditableTextSession<TAnchor> | null;
  isSaving?: boolean;
  errorMessage?: string;
  onClose: () => void;
  onSave: (nextValue: string, session: EditableTextSession<TAnchor>) => void | Promise<void>;
}

export const EditableTextDialog = <TAnchor,>({
  session,
  isSaving = false,
  errorMessage,
  onClose,
  onSave,
}: EditableTextDialogProps<TAnchor>) => {
  const sessionKey = useMemo(() => {
    if (!session) {
      return 'empty';
    }
    try {
      return JSON.stringify(session);
    } catch {
      return `${session.title}:${session.value}:${session.multiline ? 'multi' : 'single'}`;
    }
  }, [session]);

  if (!session) {
    return null;
  }

  return (
    <Modal
      isOpen
      title={`编辑${session.title}`}
      onClose={() => {
        if (isSaving) return;
        onClose();
      }}
    >
      <EditableTextDialogBody
        key={sessionKey}
        session={session}
        isSaving={isSaving}
        errorMessage={errorMessage}
        onClose={onClose}
        onSave={onSave}
      />
    </Modal>
  );
};

interface EditableTextDialogBodyProps<TAnchor = unknown> {
  session: EditableTextSession<TAnchor>;
  isSaving: boolean;
  errorMessage?: string;
  onClose: () => void;
  onSave: (nextValue: string, session: EditableTextSession<TAnchor>) => void | Promise<void>;
}

const EditableTextDialogBody = <TAnchor,>({
  session,
  isSaving,
  errorMessage,
  onClose,
  onSave,
}: EditableTextDialogBodyProps<TAnchor>) => {
  const [draft, setDraft] = useState(session.value);

  return (
    <>
      <div className="space-y-4">
        {session.multiline === false ? (
          <input
            value={draft}
            disabled={isSaving}
            onChange={(event) => setDraft(event.target.value)}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
          />
        ) : (
          <textarea
            value={draft}
            disabled={isSaving}
            onChange={(event) => setDraft(event.target.value)}
            className="min-h-56 w-full resize-y rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
          />
        )}
        {errorMessage ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => void onSave(draft, session)}
            disabled={isSaving}
            className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </>
  );
};
