// resourceCenterTypes 负责定义资源中心侧栏与聊天使用的基础类型。
export type ResourceFileKind =
  | 'pdf'
  | 'docx'
  | 'pptx'
  | 'md'
  | 'txt'
  | 'url'
  | 'wav'
  | 'mp3'
  | 'm4a'
  | 'aac'
  | 'flac'
  | 'ogg'
  | 'other';

export interface ResourceFile {
  kind: ResourceFileKind;
  name: string;
  url?: string;
  content?: string;
}

export interface SidebarResource {
  id: string;
  code: string;
  title: string;
  description: string;
  type: 'KB' | 'VIS' | 'DOC' | 'DATA';
  icon: string;
  category: string;
  status?: 'UPLOADING' | 'UPLOADED' | 'PROCESSING' | 'DONE' | 'FAILED';
  file?: ResourceFile;
}
