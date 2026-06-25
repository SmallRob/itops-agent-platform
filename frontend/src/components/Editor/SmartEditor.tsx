import MonacoEditor from './MonacoEditor';
import TextEditor from './TextEditor';

interface SmartEditorProps {
  content: string;
  editorType: 'monaco' | 'text';
  language?: string;
  readOnly?: boolean;
  onChange?: (value: string) => void;
  onSave?: () => void;
}

export default function SmartEditor({
  content,
  editorType,
  language = 'plaintext',
  readOnly = false,
  onChange,
  onSave,
}: SmartEditorProps) {
  if (editorType === 'monaco') {
    return (
      <MonacoEditor
        content={content}
        language={language}
        readOnly={readOnly}
        onChange={onChange}
        onSave={onSave}
      />
    );
  }

  return (
    <TextEditor
      content={content}
      readOnly={readOnly}
      onChange={onChange}
      onSave={onSave}
    />
  );
}
