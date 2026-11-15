import { useTranslation } from 'react-i18next';
import type { ConditionKind, HealthCondition } from '../../../../Hooks/Health/healthTypes';
import Profile_Condition_Row from './Profile_Condition_Row';

interface Profile_Conditions_Card_Props {
  kind: ConditionKind;
  conditions: HealthCondition[];
  loading: boolean;
  onAdd: () => void;
  onEdit: (condition: HealthCondition) => void;
  onRemove: (id: string) => void;
}

const Profile_Conditions_Card = ({ kind, conditions, loading, onAdd, onEdit, onRemove }: Profile_Conditions_Card_Props) => {
  const { t } = useTranslation('health');
  const isAllergy = kind === 'ALLERGY';

  return (
    <section className='Health_card'>
      <div className='Health_card_head'>
        <div>
          <span className='Health_card_title'>{t(isAllergy ? 'conditions.allergiesTitle' : 'conditions.conditionsTitle')}</span>
          <p className='Health_card_description'>
            {t(isAllergy ? 'conditions.allergiesDescription' : 'conditions.conditionsDescription')}
          </p>
        </div>
        <button type='button' className='Health_see_all' onClick={onAdd}>
          {t(isAllergy ? 'conditions.addAllergy' : 'conditions.addCondition')}
        </button>
      </div>

      {!loading && !conditions.length && (
        <span className='Health_chart_empty'>{t(isAllergy ? 'conditions.emptyAllergies' : 'conditions.emptyConditions')}</span>
      )}

      {conditions.length > 0 && (
        <div className='Profile_Conditions'>
          {conditions.map((condition) => (
            <Profile_Condition_Row
              key={condition.id}
              condition={condition}
              onEdit={() => onEdit(condition)}
              onRemove={() => onRemove(condition.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
};

export default Profile_Conditions_Card;
