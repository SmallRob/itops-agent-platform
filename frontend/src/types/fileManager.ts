import type {
  FileItem,
  FileInfo,
  FileOperations,
  FileManagerConfig,
  ClipboardItem,
  SearchMatch,
  SearchResult,
  Operation,
  OperationLog,
} from '../../../shared/types/fileManager';

export type {
  FileItem,
  FileInfo,
  FileOperations,
  FileManagerConfig,
  ClipboardItem,
  SearchMatch,
  SearchResult,
  Operation,
  OperationLog,
};

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

export interface FileManagerState {
  currentServerId: string | null;
  fileTree: Record<string, FileItem[]>; // Serializable
  expandedPaths: string[]; // Serializable
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
  openFiles: {
    path: string;
    encoding: string;
    lineEnding: 'LF' | 'CRLF';
    editorType: 'monaco' | 'text';
  }[];
  recentFiles: string[];
  editorSettings: {
    fontSize: number;
    tabSize: number;
    wordWrap: 'on' | 'off';
    minimap: boolean;
  };
}
