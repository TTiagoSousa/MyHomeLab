import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../Shared/Health_Dashboard.scss';
import './Profile.scss';
import { useHealthProfile } from '../../../../Hooks/Health/useHealthProfile';
import { useHealthConditions } from '../../../../Hooks/Health/useHealthConditions';
import type { ConditionKind, HealthCondition } from '../../../../Hooks/Health/healthTypes';
import Condition_Modal from '../../../../Components/Modals/Condition_Modal/Condition_Modal';
import Health_Dashboard_Header from '../Shared/Health_Dashboard_Header';
import Health_Stat from '../Shared/Health_Stat';
import { formatDay } from '../Shared/healthFormat';
import Profile_Form_Card from './Profile_Form_Card';
import Profile_Conditions_Card from './Profile_Conditions_Card';

type Editing = { kind: ConditionKind; condition: HealthCondition | null } | null;

const CONDITION_KINDS: ConditionKind[] = ['ALLERGY', 'CONDITION'];

const Profile = () => {
  const { t } = useTranslation('health');
  const { profile, saving, saveProfile } = useHealthProfile();
  const conditions = useHealthConditions();
  const [editing, setEditing] = useState<Editing>(null);

  return (
    <div className='Health_Dashboard'>
      <Health_Dashboard_Header title={t('personal.title')} />

      {profile && (
        <section className='Health_card'>
          <div className='Health_Stats columns-4'>
            <Health_Stat
              highlight
              label={t('personal.age')}
              value={profile.age != null ? t('personal.years', { count: profile.age }) : '—'}
              sub={profile.birthDate ? formatDay(profile.birthDate, false) : t('personal.missingBirthDate')}
            />
            <Health_Stat label={t('personal.sex')} value={profile.sex ? t(`personal.sexes.${profile.sex}`) : '—'} />
            <Health_Stat label={t('personal.bloodType')} value={profile.bloodType ?? '—'} />
            <Health_Stat
              label={t('profile.bmi')}
              value={profile.bmi != null ? String(profile.bmi) : '—'}
              sub={profile.heightCm != null ? `${profile.heightCm} cm` : t('profile.bmiMissing')}
            />
          </div>
        </section>
      )}

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

      {profile && <Profile_Form_Card key={JSON.stringify(profile)} profile={profile} saving={saving} onSave={saveProfile} />}

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

export default Profile;
