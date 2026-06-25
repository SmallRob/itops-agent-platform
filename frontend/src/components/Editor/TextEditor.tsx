import { useRef, useEffect } from 'react';

interface TextEditorProps {
  content: string;
  readOnly?: boolean;
  onChange?: (value: string) => void;
  onSave?: () => void;
}

export default function TextEditor({
  content,
  readOnly = false,
  onChange,
  onSave,
}: TextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.value = content;
    }
  }, [content]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange?.(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      onSave?.();
    }
  };

  return (
    <textarea
      ref={textareaRef}
      className="w-full h-full bg-gray-900 text-gray-200 p-4 font-mono text-sm resize-none focus:outline-none"
      readOnly={readOnly}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      spellCheck={false}
    />
  );
}
