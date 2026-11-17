import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { useDoc } from '../../../Hooks/Docs/useDoc';
import type { DocSection, DocSummary, DocVersion } from '../../../Hooks/Docs/docTypes';
import { Doc_Breadcrumb, Doc_Subdocs } from './Doc_Tree_Context';
import Doc_Form from './Doc_Form';
import Doc_Version_Modal from './Doc_Version_Modal';
import Doc_Versions from './Doc_Versions';
import Doc_View from './Doc_View';
import { draftFromDoc, draftToPayload, type DocDraft } from './docDraft';
import './Doc_Versions.scss';

interface Doc_Detail_Props {
  docId: string;
  docState: ReturnType<typeof useDoc>;
  sections: DocSection[];
  docs: DocSummary[];
  onChanged: () => void;
  onDeleted: () => void;
  onOpen: (id: string) => void;
  onNewChild: (parentId: string) => void;
}

const Doc_Detail = ({ docId, docState, sections, docs, onChanged, onDeleted, onOpen, onNewChild }: Doc_Detail_Props) => {
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
        sections={sections}
        docs={docs}
        saving={saving}
        onSave={save}
        onCancel={() => setEditing(false)}
        onDelete={remove}
      />
    );
  }

  return (
    <>
      <Doc_Breadcrumb doc={doc} sections={sections} docs={docs} onOpen={onOpen} />
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
      {doc.kind !== 'LOG' && <Doc_Subdocs doc={doc} docs={docs} onOpen={onOpen} onNewChild={() => onNewChild(doc.id)} />}
      {versionOpen && (
        <Doc_Version_Modal version={version} restoring={saving} onRestore={restore} onClose={() => setVersionOpen(false)} />
      )}
    </>
  );
};

export default Doc_Detail;
