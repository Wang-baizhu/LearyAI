// ProjectEntryModal 负责新建空间与邀请码加入的弹窗切换展示。
import React, { useState } from 'react';
import type { UseMutationResult } from '@tanstack/react-query';
import { Modal } from '@leary/ui';
import { CreateProjectForm, ProjectInviteJoinForm, type Project, type ProjectCreatePayload } from '../../../../project';
import MaterialIcon from '@/shared/ui/icons/MaterialIcon';
import { TourOverlay, TourProvider, TourStep } from '@leary/tour-guide';

const PROJECT_ENTRY_MODAL_GUIDE_TAG = 'guide:project-entry-modal:v1';

interface ProjectEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  createMutation: UseMutationResult<{ item: Project; message: string }, Error, ProjectCreatePayload>;
  onSubmitProject: (payload: ProjectCreatePayload) => void;
  onInviteAccepted: () => void;
  guideTag?: string;
  toggleGuideOrder?: number;
  toggleGuideTitle?: string;
  toggleGuideContent?: React.ReactNode;
  toggleGuideActionLabel?: string;
}

const ProjectEntryModal: React.FC<ProjectEntryModalProps> = ({
  isOpen,
  onClose,
  createMutation,
  onSubmitProject,
  onInviteAccepted,
  guideTag,
  toggleGuideOrder,
  toggleGuideTitle,
  toggleGuideContent,
  toggleGuideActionLabel,
}) => {
  const [mode, setMode] = useState<'create' | 'invite'>('create');

  const resolvedGuideTag = guideTag ?? PROJECT_ENTRY_MODAL_GUIDE_TAG;
  const resolvedToggleGuideOrder = toggleGuideOrder ?? 1;

  const isInviteMode = mode === 'invite';
  const title = isInviteMode ? '使用邀请码加入' : '新建空间';
  const toggleLabel = isInviteMode ? '返回新建空间' : '使用邀请码加入';
  const toggleIcon = isInviteMode ? 'arrow_back' : 'vpn_key';
  const toggleButton = (
    <button
      type="button"
      onClick={() => setMode(isInviteMode ? 'create' : 'invite')}
      className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
    >
      <MaterialIcon name={toggleIcon} className="text-[16px]" />
      {toggleLabel}
    </button>
  );
  const toggleButtonWithGuide = (
    <TourStep
      tag={resolvedGuideTag}
      order={resolvedToggleGuideOrder}
      title={toggleGuideTitle ?? '使用邀请码加入'}
      content={toggleGuideContent ?? '如需加入他人空间，请点击此处后粘贴他人分享的邀请码后加入。'}
      actionLabel={toggleGuideActionLabel ?? '知道了'}
    >
      {toggleButton}
    </TourStep>
  );

  return (
    <TourProvider tags={isOpen ? [resolvedGuideTag] : []}>
      <Modal
        isOpen={isOpen}
        title={title}
        onClose={() => {
          setMode('create');
          onClose();
        }}
        headerActions={toggleButtonWithGuide}
      >
        {isInviteMode ? (
          <ProjectInviteJoinForm
            onAccepted={() => {
              setMode('create');
              onInviteAccepted();
            }}
          />
        ) : (
          <CreateProjectForm mutation={createMutation} onSubmit={onSubmitProject} />
        )}
      </Modal>
      <TourOverlay />
    </TourProvider>
  );
};

export default ProjectEntryModal;
