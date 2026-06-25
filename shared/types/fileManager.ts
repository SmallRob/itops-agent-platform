export interface FileItem {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size: number;
  modified: string; // ISO 8601 string
  permissions: string;
  owner: string;
  group: string;
}

export interface FileInfo {
  path: string;
  name: string;
  type: 'file' | 'directory';
  size: number;
  modified: string; // ISO 8601 string
  created: string; // ISO 8601 string
  permissions: string;
  owner: string;
  group: string;
  mimeType: string;
  encoding: string;
}

export interface FileOperations {
  create: boolean;
  read: boolean;
  update: boolean;
  delete: boolean;
  rename: boolean;
  upload: boolean;
  download: boolean;
  copy: boolean;
  paste: boolean;
  cut: boolean;
  compress: boolean;
  extract: boolean;
  permissions: boolean;
  ownership: boolean;
}

export interface FileManagerConfig {
  maxFileSize: number; // bytes
  allowedExtensions: string[];
  blockedPaths: string[];
  operations: FileOperations;
}

export interface ClipboardItem {
  path: string;
  name: string;
  type: 'file' | 'directory';
}

export interface SearchMatch {
  line: number;
  content: string;
  startIndex: number;
  endIndex: number;
}

export interface SearchResult {
  path: string;
  name: string;
  type: 'file' | 'directory';
  matches: SearchMatch[];
}

export interface Operation {
  id: string;
  type: 'create' | 'delete' | 'rename' | 'move' | 'copy' | 'edit';
  path: string;
  oldPath?: string;
  newPath?: string;
  content?: string;
  timestamp: string; // ISO 8601 string
}

export interface OperationLog {
  id: string;
  operation: string;
  path: string;
  user: string;
  timestamp: string; // ISO 8601 string
  details: string;
  status: 'success' | 'failed';
}
