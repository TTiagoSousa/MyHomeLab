import { useEffect, useRef } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import { docEditorExtensions } from './docEditorExtensions';
import Doc_Toolbar from './Doc_Toolbar';
import './Doc_Editor.scss';

interface Doc_Editor_Props {
  value: string;
  onChange?: (markdown: string) => void;
  editable?: boolean;
  placeholder?: string;
  compact?: boolean;
}

const Doc_Editor = ({ value, onChange, editable = false, placeholder = '', compact = false }: Doc_Editor_Props) => {
  const lastMarkdown = useRef(value);

  const editor = useEditor({
    extensions: docEditorExtensions(placeholder),
    content: value,
    contentType: 'markdown',
    editable,
    onUpdate: ({ editor: current }) => {
      const markdown = current.getMarkdown();
      lastMarkdown.current = markdown;
      onChange?.(markdown);
    },
  });

  useEffect(() => {
    if (editor && editor.isEditable !== editable) editor.setEditable(editable, false);
  }, [editor, editable]);

  useEffect(() => {
    if (!editor || value === lastMarkdown.current) return;
    lastMarkdown.current = value;
    editor.commands.setContent(value, { contentType: 'markdown', emitUpdate: false });
  }, [editor, value]);

  return (
    <div className={`Doc_Editor${editable ? ' editable' : ' readonly'}${compact ? ' compact' : ''}`}>
      {editable && editor && <Doc_Toolbar editor={editor} />}
      <EditorContent editor={editor} className='Doc_Editor_Content' />
    </div>
  );
};

export default Doc_Editor;
