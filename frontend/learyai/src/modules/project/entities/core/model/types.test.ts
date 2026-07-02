// types.test.ts 负责以最小运行时断言验证项目实体类型的使用约定。
import { describe, expect, it } from 'vitest';
import type { Project, ProjectMember } from './types';

describe('project types', () => {
  it('Project 结构满足当前实体字段约定', () => {
    const project: Project = {
      projectId: 'project-1',
      name: 'Leary AI',
      role: 'OWNER',
      createdAt: '2026-03-29T00:00:00.000Z',
      updatedAt: '2026-03-29T01:00:00.000Z',
    };

    expect(project).toMatchObject({
      projectId: 'project-1',
      role: 'OWNER',
    });
  });

  it('ProjectMember 结构满足当前成员字段约定', () => {
    const member: ProjectMember = {
      userId: 1001,
      name: 'Alice',
      role: 'EDITOR',
      status: 'ACTIVE',
      createdAt: '2026-03-29T00:00:00.000Z',
    };

    expect(member).toMatchObject({
      userId: 1001,
      status: 'ACTIVE',
    });
  });
});
