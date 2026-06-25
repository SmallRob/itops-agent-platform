import type { OpenFile } from '../../types/fileManager';
import SmartEditor from './SmartEditor';

interface EditorTabsProps {
  files: OpenFile[];
  activeFileId: string | null;
  onSelect: (fileId: string) => void;
  onClose: (fileId: string) => void;
  onChange?: (fileId: string, value: string) => void;
  onSave?: (fileId: string) => void;
}

export default function EditorTabs({
  files,
  activeFileId,
  onSelect,
  onClose,
  onChange,
  onSave,
}: EditorTabsProps) {
  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const iconMap: Record<string, string> = {
      js: '📜',
      ts: '📜',
      jsx: '⚛️',
      tsx: '⚛️',
      py: '🐍',
      java: '☕',
      go: '🐹',
      rs: '🦀',
      html: '🌐',
      css: '🎨',
      json: '📋',
      md: '📝',
      txt: '📄',
      sh: '💻',
      bash: '💻',
    };
    return iconMap[ext || ''] || '📄';
  };

  if (files.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-800 text-gray-400">
        <p>No files open</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex bg-gray-800 border-b border-gray-700 overflow-x-auto">
        {files.map((file) => (
          <div
            key={file.id}
            className={`flex items-center px-3 py-2 cursor-pointer border-r border-gray-700 min-w-0 ${
              activeFileId === file.id
                ? 'bg-gray-900 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
            onClick={() => onSelect(file.id)}
          >
            <span className="mr-2">{getFileIcon(file.name)}</span>
            <span className="truncate text-sm">
              {file.name}
              {file.modified && <span className="ml-1 text-yellow-500">●</span>}
            </span>
            <button
              className="ml-2 text-gray-500 hover:text-gray-300 focus:outline-none"
              onClick={(e) => {
                e.stopPropagation();
                onClose(file.id);
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="flex-1">
        {files.map((file) => (
          <div
            key={file.id}
            className={`h-full ${activeFileId === file.id ? 'block' : 'hidden'}`}
          >
            <SmartEditor
              content={file.content}
              editorType={file.editorType}
              language={getLanguageFromFilename(file.name)}
              onChange={(value) => onChange?.(file.id, value)}
              onSave={() => onSave?.(file.id)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function getLanguageFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const languageMap: Record<string, string> = {
    js: 'javascript',
    ts: 'typescript',
    jsx: 'javascript',
    tsx: 'typescript',
    vue: 'html',
    svelte: 'html',
    html: 'html',
    htm: 'html',
    css: 'css',
    scss: 'scss',
    sass: 'sass',
    less: 'less',
    py: 'python',
    java: 'java',
    go: 'go',
    rs: 'rust',
    rb: 'ruby',
    php: 'php',
    c: 'c',
    cpp: 'cpp',
    h: 'c',
    hpp: 'cpp',
    cs: 'csharp',
    swift: 'swift',
    kt: 'kotlin',
    sh: 'shell',
    bash: 'shell',
    zsh: 'shell',
    fish: 'shell',
    ps1: 'powershell',
    bat: 'bat',
    cmd: 'bat',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    xml: 'xml',
    toml: 'toml',
    ini: 'ini',
    cfg: 'ini',
    conf: 'ini',
    sql: 'sql',
    md: 'markdown',
    txt: 'plaintext',
    rst: 'restructuredtext',
    tex: 'latex',
    dockerfile: 'dockerfile',
    makefile: 'makefile',
    cmake: 'cmake',
    gradle: 'groovy',
    maven: 'xml',
  };
  return languageMap[ext || ''] || 'plaintext';
}
