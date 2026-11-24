import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../Shared/Health_Dashboard.scss';
import '../Profile/Profile.scss';
import { useHealthConditions } from '../../../../Hooks/Health/useHealthConditions';
import type { ConditionKind, HealthCondition } from '../../../../Hooks/Health/healthTypes';
import Condition_Modal from '../../../../Components/Modals/Condition_Modal/Condition_Modal';
import Health_Dashboard_Header from '../Shared/Health_Dashboard_Header';
import Profile_Conditions_Card from '../Profile/Profile_Conditions_Card';

type Editing = { kind: ConditionKind; condition: HealthCondition | null } | null;

const CONDITION_KINDS: ConditionKind[] = ['CONDITION', 'ALLERGY'];

const Conditions = () => {
  const { t } = useTranslation('health');
  const conditions = useHealthConditions();
  const [editing, setEditing] = useState<Editing>(null);

  return (
    <div className='Health_Dashboard'>
      <Health_Dashboard_Header title={t('conditions.pageTitle')} />

      {CONDITION_KINDS.map((kind) => (
        <Profile_Conditions_Card
          key={kind}
          kind={kind}
          conditions={conditions.conditions.filter((condition) => condition.kind === kind)}
          loading={conditions.loading}
          onAdd={() => setEditing({ kind, condition: null })}
          onEdit={(condition) => setEditing({ kind, condition })}
          onRemove={(id) => void conditions.removeCondition(id)}
        />
      ))}

      {editing && (
        <Condition_Modal
          kind={editing.kind}
          existing={editing.condition}
          saving={conditions.saving}
          onSave={(payload) => conditions.saveCondition(payload, editing.condition?.id)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
};

export default Conditions;
