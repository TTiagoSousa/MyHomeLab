import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useEditorState, type Editor } from '@tiptap/react';
import Toolbar_Button from './Toolbar_Button';
import Toolbar_Link_Field from './Toolbar_Link_Field';
import Table_Controls from './Table_Controls';
import * as Glyph from './toolbarIcons';
import './Doc_Toolbar.scss';

const HEADING_LEVELS = [1, 2, 3] as const;

const Doc_Toolbar = ({ editor }: { editor: Editor }) => {
  const { t } = useTranslation('docs');
  const [linkOpen, setLinkOpen] = useState(false);

  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      heading1: current.isActive('heading', { level: 1 }),
      heading2: current.isActive('heading', { level: 2 }),
      heading3: current.isActive('heading', { level: 3 }),
      bold: current.isActive('bold'),
      italic: current.isActive('italic'),
      strike: current.isActive('strike'),
      code: current.isActive('code'),
      bulletList: current.isActive('bulletList'),
      orderedList: current.isActive('orderedList'),
      taskList: current.isActive('taskList'),
      blockquote: current.isActive('blockquote'),
      codeBlock: current.isActive('codeBlock'),
      link: current.isActive('link'),
      inTable: current.isActive('table'),
      canUndo: current.can().undo(),
      canRedo: current.can().redo(),
    }),
  });

  const chain = () => editor.chain().focus();

  const insertDiagram = () =>
    chain()
      .insertContent({
        type: 'codeBlock',
        attrs: { language: 'mermaid' },
        content: [{ type: 'text', text: t('editor.diagram.example') }],
      })
      .run();

  return (
    <div className='Doc_Toolbar'>
      <div className='Doc_Toolbar_Group'>
        {HEADING_LEVELS.map((level) => (
          <Toolbar_Button
            key={level}
            label={t('editor.toolbar.heading', { level })}
            active={state[`heading${level}`]}
            onClick={() => chain().toggleHeading({ level }).run()}
          >
            <span className='Toolbar_Glyph'>{t('editor.glyph.heading', { level })}</span>
          </Toolbar_Button>
        ))}
      </div>

      <div className='Doc_Toolbar_Group'>
        <Toolbar_Button label={t('editor.toolbar.bold')} active={state.bold} onClick={() => chain().toggleBold().run()}>
          <span className='Toolbar_Glyph bold'>{t('editor.glyph.bold')}</span>
        </Toolbar_Button>
        <Toolbar_Button label={t('editor.toolbar.italic')} active={state.italic} onClick={() => chain().toggleItalic().run()}>
          <span className='Toolbar_Glyph italic'>{t('editor.glyph.italic')}</span>
        </Toolbar_Button>
        <Toolbar_Button label={t('editor.toolbar.strike')} active={state.strike} onClick={() => chain().toggleStrike().run()}>
          <span className='Toolbar_Glyph strike'>{t('editor.glyph.strike')}</span>
        </Toolbar_Button>
        <Toolbar_Button label={t('editor.toolbar.code')} active={state.code} onClick={() => chain().toggleCode().run()}>
          <Glyph.Inline_Code_Icon />
        </Toolbar_Button>
        <Toolbar_Button label={t('editor.toolbar.link')} active={state.link || linkOpen} onClick={() => setLinkOpen(!linkOpen)}>
          <Glyph.Link_Icon />
        </Toolbar_Button>
      </div>

      <div className='Doc_Toolbar_Group'>
        <Toolbar_Button label={t('editor.toolbar.bulletList')} active={state.bulletList} onClick={() => chain().toggleBulletList().run()}>
          <Glyph.Bullet_List_Icon />
        </Toolbar_Button>
        <Toolbar_Button label={t('editor.toolbar.orderedList')} active={state.orderedList} onClick={() => chain().toggleOrderedList().run()}>
          <Glyph.Ordered_List_Icon />
        </Toolbar_Button>
        <Toolbar_Button label={t('editor.toolbar.taskList')} active={state.taskList} onClick={() => chain().toggleTaskList().run()}>
          <Glyph.Task_List_Icon />
        </Toolbar_Button>
        <Toolbar_Button label={t('editor.toolbar.blockquote')} active={state.blockquote} onClick={() => chain().toggleBlockquote().run()}>
          <Glyph.Quote_Icon />
        </Toolbar_Button>
        <Toolbar_Button label={t('editor.toolbar.codeBlock')} active={state.codeBlock} onClick={() => chain().toggleCodeBlock().run()}>
          <Glyph.Code_Block_Icon />
        </Toolbar_Button>
        <Toolbar_Button label={t('editor.toolbar.rule')} onClick={() => chain().setHorizontalRule().run()}>
          <Glyph.Rule_Icon />
        </Toolbar_Button>
      </div>

      <div className='Doc_Toolbar_Group'>
        <Toolbar_Button label={t('editor.toolbar.diagram')} onClick={insertDiagram} wide>
          <Glyph.Diagram_Icon />
          <span>{t('editor.toolbar.diagramShort')}</span>
        </Toolbar_Button>
      </div>

      <div className='Doc_Toolbar_Group push'>
        <Toolbar_Button label={t('editor.toolbar.undo')} disabled={!state.canUndo} onClick={() => chain().undo().run()}>
          <Glyph.Undo_Icon />
        </Toolbar_Button>
        <Toolbar_Button label={t('editor.toolbar.redo')} disabled={!state.canRedo} onClick={() => chain().redo().run()}>
          <Glyph.Redo_Icon />
        </Toolbar_Button>
      </div>

      <Table_Controls editor={editor} inTable={state.inTable} />

      {linkOpen && <Toolbar_Link_Field editor={editor} onClose={() => setLinkOpen(false)} />}
    </div>
  );
};

export default Doc_Toolbar;
