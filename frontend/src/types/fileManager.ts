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

export interface OpenFile {
  id: string;
  path: string;
  name: string;
  content: string;
  modified: boolean;
  editorType: 'monaco' | 'text';
  encoding: string;
  lineEnding: 'LF' | 'CRLF';
  cursorPosition: { line: number; column: number };
  scrollPosition: { top: number; left: number };
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

export interface FileManagerState {
  currentServerId: string | null;
  fileTree: Map<string, FileItem[]>;
  expandedPaths: Set<string>;
  selectedPath: string | null;
  openFiles: OpenFile[];
  activeFileId: string | null;
  clipboard: {
    items: ClipboardItem[];
    operation: 'copy' | 'cut' | null;
  };
  search: {
    query: string;
    results: SearchResult[];
    isSearching: boolean;
  };
  history: {
    navigation: string[];
    recentFiles: string[];
    undoStack: Operation[];
    redoStack: Operation[];
  };
  loading: boolean;
  error: string | null;
  operationLogs: OperationLog[];
  operations: FileOperations;
}

export interface PersistedState {
  expandedPaths: string[];
  openFiles: string[];
  recentFiles: string[];
  editorSettings: {
    fontSize: number;
    tabSize: number;
    wordWrap: 'on' | 'off';
    minimap: boolean;
  };
}
