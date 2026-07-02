// entities/user/types 定义与用户会话相关的共享类型。
export interface UserSession {
  id: number;
  name: string;
  email: string;
  phone?: string;
  userMode?: string;
}
