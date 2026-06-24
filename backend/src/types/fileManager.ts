export interface FileItem {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size: number;
  modified: Date;
  permissions: string;
  owner: string;
  group: string;
}

export interface FileInfo {
  path: string;
  name: string;
  type: 'file' | 'directory';
  size: number;
  modified: Date;
  created: Date;
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
  maxFileSize: number;
  allowedExtensions: string[];
  blockedPaths: string[];
  operations: FileOperations;
}

export interface ClipboardItem {
  path: string;
  name: string;
  type: 'file' | 'directory';
}

export interface SearchResult {
  path: string;
  name: string;
  type: 'file' | 'directory';
  matches: {
    line: number;
    content: string;
    startIndex: number;
    endIndex: number;
  }[];
}

export interface Operation {
  id: string;
  type: 'create' | 'delete' | 'rename' | 'move' | 'copy' | 'edit';
  path: string;
  oldPath?: string;
  newPath?: string;
  content?: string;
  timestamp: Date;
}

export interface OperationLog {
  id: string;
  operation: string;
  path: string;
  user: string;
  timestamp: Date;
  details: string;
  status: 'success' | 'failed';
}
