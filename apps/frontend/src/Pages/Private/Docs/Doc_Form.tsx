import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Doc_Editor from '../../../Components/Doc_Editor/Doc_Editor';
import Global_Dropdown from '../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import Global_Input from '../../../Components/Inputs/Global_Input/Global_Input';
import { DOC_KINDS, TYPE_PREFIX, type DocKind } from '../../../Hooks/Docs/docTypes';
import { useDocTypes } from '../../../Hooks/Docs/useDocTypes';
import Doc_Links_Editor from './Doc_Links_Editor';
import Doc_Tags_Input from './Doc_Tags_Input';
import type { DocDraft } from './docDraft';
import './Doc_Form.scss';

interface Doc_Form_Props {
  heading: string;
  initial: DocDraft;
  docId?: string;
  notice?: string;
  saving: boolean;
  onSave: (draft: DocDraft) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

const Doc_Form = ({ heading, initial, docId, notice, saving, onSave, onCancel, onDelete }: Doc_Form_Props) => {
  const { t } = useTranslation('docs');
  const [draft, setDraft] = useState<DocDraft>(initial);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [triedSave, setTriedSave] = useState(false);
  const { types } = useDocTypes();

  const kindOptions = [
    ...DOC_KINDS.map((kind) => ({ value: kind, label: t(`kinds.${kind}`) })),
    ...types.map((type) => ({ value: `${TYPE_PREFIX}${type.id}`, label: type.name })),
  ];

  const changeKind = (value: string) =>
    value.startsWith(TYPE_PREFIX) ? update({ kind: 'OTHER', typeId: value.slice(TYPE_PREFIX.length) }) : update({ kind: value as DocKind, typeId: null });

  const update = (changes: Partial<DocDraft>) => setDraft((current) => ({ ...current, ...changes }));
  const titleMissing = !draft.title.trim();

  const save = () => {
    setTriedSave(true);
    if (titleMissing || saving) return;
    onSave(draft);
  };

  return (
    <div className='Doc_Form'>
      <div className='Doc_Form_Head'>
        <span className='Doc_Form_Heading'>{heading}</span>
        {notice && <span className='Doc_Form_Notice'>{notice}</span>}
      </div>

      <div className={`Doc_Form_Field${triedSave && titleMissing ? ' invalid' : ''}`}>
        <label htmlFor='doc-title'>{t('form.title')}</label>
        <Global_Input
          id='doc-title'
          value={draft.title}
          maxLength={200}
          placeholder={t('form.titlePlaceholder')}
          onChange={(e) => update({ title: e.target.value })}
        />
        {triedSave && titleMissing && <span className='Doc_Form_Error'>{t('form.titleRequired')}</span>}
      </div>

      <div className='Doc_Form_Row'>
        <div className='Doc_Form_Field'>
          <label htmlFor='doc-kind'>{t('form.kind')}</label>
          <Global_Dropdown
            id='doc-kind'
            value={draft.typeId ? `${TYPE_PREFIX}${draft.typeId}` : draft.kind}
            options={kindOptions}
            onChange={changeKind}
            maxVisibleOptions={8}
          />
        </div>

        <label className='Doc_Form_Toggle'>
          <span>
            {t('form.required')}
            <small>{t('form.requiredHint')}</small>
          </span>
          <input type='checkbox' checked={draft.required} onChange={(e) => update({ required: e.target.checked })} />
        </label>
      </div>

      <div className='Doc_Form_Field'>
        <label htmlFor='doc-summary'>{t('form.summary')}</label>
        <Global_Input
          id='doc-summary'
          value={draft.summary}
          maxLength={300}
          placeholder={t('form.summaryPlaceholder')}
          onChange={(e) => update({ summary: e.target.value })}
        />
        <span className='Doc_Form_Hint'>{t('form.summaryHint')}</span>
      </div>

      <div className='Doc_Form_Field'>
        <label htmlFor='doc-tags'>{t('form.tags')}</label>
        <Doc_Tags_Input id='doc-tags' tags={draft.tags} onChange={(tags) => update({ tags })} />
      </div>

      <div className='Doc_Form_Field'>
        <span className='Doc_Form_Label'>{t('form.links')}</span>
        <Doc_Links_Editor links={draft.links} docId={docId} onChange={(links) => update({ links })} />
        <span className='Doc_Form_Hint'>{t('form.linksHint')}</span>
      </div>

      <div className='Doc_Form_Field'>
        <span className='Doc_Form_Label'>{t('form.content')}</span>
        <Doc_Editor
          value={draft.content}
          editable
          placeholder={t('form.contentPlaceholder')}
          onChange={(content) => update({ content })}
        />
      </div>

      <div className='Doc_Form_Footer'>
        {onDelete && (
          <div className='Doc_Form_Delete'>
            {confirmingDelete ? (
              <>
                <span>{t('actions.confirmDelete')}</span>
                <button type='button' className='danger' onClick={onDelete} disabled={saving}>
                  {t('actions.confirmDeleteYes')}
                </button>
                <button type='button' onClick={() => setConfirmingDelete(false)}>
                  {t('actions.confirmDeleteNo')}
                </button>
              </>
            ) : (
              <button type='button' className='danger_ghost' onClick={() => setConfirmingDelete(true)} disabled={saving}>
                {t('actions.delete')}
              </button>
            )}
          </div>
        )}

        <div className='Doc_Form_Actions'>
          <button type='button' className='Cancel_Button' onClick={onCancel} disabled={saving}>
            {t('actions.cancel')}
          </button>
          <button type='button' className='Save_Button' onClick={save} disabled={saving}>
            {saving ? t('actions.saving') : t('actions.save')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Doc_Form;
