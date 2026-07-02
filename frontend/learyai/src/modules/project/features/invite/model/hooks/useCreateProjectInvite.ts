// useCreateProjectInvite 负责创建项目邀请码的操作流程。
import { useMutation } from '@tanstack/react-query';
import {
  projectInviteApi,
  type ProjectInviteCreatePayload,
} from '../../api/projectInviteApi';

export const useCreateProjectInvite = () =>
  useMutation({ mutationFn: (payload: ProjectInviteCreatePayload) => projectInviteApi.createInvite(payload) });
