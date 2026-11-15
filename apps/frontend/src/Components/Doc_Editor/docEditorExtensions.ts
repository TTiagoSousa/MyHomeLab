import { ReactNodeViewRenderer } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { CodeBlock } from '@tiptap/extension-code-block';
import { TableKit } from '@tiptap/extension-table';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { Placeholder } from '@tiptap/extensions';
import { Markdown } from '@tiptap/markdown';
import Code_Block_View from './Code_Block_View';

const Doc_Code_Block = CodeBlock.extend({
  addNodeView() {
    return ReactNodeViewRenderer(Code_Block_View);
  },
});

export const docEditorExtensions = (placeholder: string) => [
  StarterKit.configure({
    codeBlock: false,
    link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
  }),
  Doc_Code_Block,
  TableKit.configure({ table: { resizable: false } }),
  TaskList,
  TaskItem.configure({ nested: true }),
  Placeholder.configure({ placeholder }),
  Markdown,
];
