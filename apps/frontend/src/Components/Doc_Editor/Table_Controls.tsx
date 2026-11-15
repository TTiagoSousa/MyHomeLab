import { useTranslation } from 'react-i18next';
import type { Editor } from '@tiptap/react';
import Toolbar_Button from './Toolbar_Button';
import { Table_Icon } from './toolbarIcons';

interface Table_Controls_Props {
  editor: Editor;
  inTable: boolean;
}

const Table_Controls = ({ editor, inTable }: Table_Controls_Props) => {
  const { t } = useTranslation('docs');
  const chain = () => editor.chain().focus();

  const actions = [
    { key: 'addRow', run: () => chain().addRowAfter().run() },
    { key: 'removeRow', run: () => chain().deleteRow().run() },
    { key: 'addColumn', run: () => chain().addColumnAfter().run() },
    { key: 'removeColumn', run: () => chain().deleteColumn().run() },
    { key: 'toggleHeader', run: () => chain().toggleHeaderRow().run() },
    { key: 'deleteTable', run: () => chain().deleteTable().run() },
  ];

  return (
    <div className={`Doc_Toolbar_Table${inTable ? ' active' : ''}`}>
      <Toolbar_Button
        label={t('editor.table.insert')}
        disabled={inTable}
        wide
        onClick={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
      >
        <Table_Icon />
        <span>{t('editor.table.insertShort')}</span>
      </Toolbar_Button>

      {actions.map((action) => (
        <Toolbar_Button key={action.key} label={t(`editor.table.${action.key}`)} disabled={!inTable} wide onClick={action.run}>
          <span>{t(`editor.table.${action.key}`)}</span>
        </Toolbar_Button>
      ))}
    </div>
  );
};

export default Table_Controls;
