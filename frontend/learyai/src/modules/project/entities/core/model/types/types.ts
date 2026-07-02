// Project 类型定义用于项目实体相关的数据结构。
export interface Project {
  projectId: string;
  name: string;
  role?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProjectMember {
  userId: number;
  name?: string | null;
  role: string;
  status: string;
  createdAt?: string | null;
}
