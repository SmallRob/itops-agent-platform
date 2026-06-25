import { useRef } from 'react';
import Editor from '@monaco-editor/react';
import type { OnMount, OnChange } from '@monaco-editor/react';

interface MonacoEditorProps {
  content: string;
  language: string;
  readOnly?: boolean;
  onChange?: (value: string) => void;
  onSave?: () => void;
}

export default function MonacoEditor({
  content,
  language,
  readOnly = false,
  onChange,
  onSave,
}: MonacoEditorProps) {
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      onSave?.();
    });

    editor.updateOptions({
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      minimap: { enabled: true },
      wordWrap: 'on',
      lineNumbers: 'on',
      renderWhitespace: 'selection',
      tabSize: 2,
      insertSpaces: true,
      autoClosingBrackets: 'always',
      autoClosingQuotes: 'always',
      formatOnPaste: true,
      formatOnType: true,
    });
  };

  const handleEditorChange: OnChange = (value) => {
    onChange?.(value || '');
  };

  return (
    <Editor
      height="100%"
      language={language}
      value={content}
      theme="vs-dark"
      onChange={handleEditorChange}
      onMount={handleEditorDidMount}
      options={{
        readOnly,
        automaticLayout: true,
      }}
    />
  );
}
