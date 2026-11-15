import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { useDoc } from '../../../Hooks/Docs/useDoc';
import type { DocVersion } from '../../../Hooks/Docs/docTypes';
import Doc_Form from './Doc_Form';
import Doc_Version_Modal from './Doc_Version_Modal';
import Doc_Versions from './Doc_Versions';
import Doc_View from './Doc_View';
import { draftFromDoc, draftToPayload, type DocDraft } from './docDraft';
import './Doc_Versions.scss';

interface Doc_Detail_Props {
  docId: string;
  docState: ReturnType<typeof useDoc>;
  onChanged: () => void;
  onDeleted: () => void;
}

const Doc_Detail = ({ docId, docState, onChanged, onDeleted }: Doc_Detail_Props) => {
  const { t } = useTranslation('docs');
  const { doc: loadedDoc, loading, saving, error, saveDoc, deleteDoc, fetchVersion, restoreVersion, checking, checkConflicts } = docState;
  const doc = loadedDoc?.id === docId ? loadedDoc : null;
  const [editing, setEditing] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [versionOpen, setVersionOpen] = useState(false);
  const [version, setVersion] = useState<DocVersion | null>(null);

  if (!doc) {
    return <p className='Docs_detail_note'>{loading || !error ? t('detail.loading') : error}</p>;
  }

  const save = async (draft: DocDraft) => {
    if (await saveDoc(draftToPayload(draft))) {
      setEditing(false);
      onChanged();
    }
  };

  const remove = async () => {
    if (await deleteDoc()) onDeleted();
  };

  const openVersion = async (versionId: string) => {
    setVersion(null);
    setVersionOpen(true);
    const loaded = await fetchVersion(versionId);
    if (loaded) setVersion(loaded);
    else setVersionOpen(false);
  };

  const restore = async () => {
    if (!version) return;
    if (await restoreVersion(version.id)) {
      setVersionOpen(false);
      onChanged();
    }
  };

  if (editing) {
    return (
      <Doc_Form
        heading={t('form.editTitle')}
        initial={draftFromDoc(doc)}
        docId={doc.id}
        notice={doc.owner === 'AGENT' ? t('detail.agentDoc') : undefined}
        saving={saving}
        onSave={save}
        onCancel={() => setEditing(false)}
        onDelete={remove}
      />
    );
  }

  return (
    <>
      <Doc_View
        doc={doc}
        onEdit={() => setEditing(true)}
        versionsOpen={versionsOpen}
        onToggleVersions={() => setVersionsOpen(!versionsOpen)}
        checking={checking}
        onCheckConflicts={() => void checkConflicts()}
      >
        {versionsOpen && <Doc_Versions versions={doc.versions ?? []} onView={openVersion} />}
      </Doc_View>
      {versionOpen && (
        <Doc_Version_Modal version={version} restoring={saving} onRestore={restore} onClose={() => setVersionOpen(false)} />
      )}
    </>
  );
};

export default Doc_Detail;
