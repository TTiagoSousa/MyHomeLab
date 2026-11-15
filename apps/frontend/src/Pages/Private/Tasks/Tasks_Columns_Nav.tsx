import type { WheelEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { BoardState } from '../../../Hooks/Board/boardTypes';
import * as Icon from '../../../Imports/icons';

interface Tasks_Columns_Nav_Props {
  groups: BoardState[][];
  count: (stateId: string) => number;
  hidden: (stateId: string) => boolean;
  collapsed: string[];
  hideEmpty: boolean;
  onJump: (state: BoardState) => void;
  onStep: (direction: 1 | -1) => void;
  onHideEmpty: (hide: boolean) => void;
  onWheel: (event: WheelEvent) => void;
}

const Tasks_Columns_Nav = ({ groups, count, hidden, collapsed, hideEmpty, onJump, onStep, onHideEmpty, onWheel }: Tasks_Columns_Nav_Props) => {
  const { t } = useTranslation('tasks');

  return (
    <div className='Tasks_Columns_Nav' onWheel={onWheel}>
      <button type='button' className='Tasks_Nav_Step' onClick={() => onStep(-1)} aria-label={t('columns.previous')} title={t('columns.previous')}>
        <Icon.Chevron />
      </button>

      <div className='Tasks_Nav_Chips'>
        {groups.map((states, index) => (
          <div key={states[0]?.id ?? index} className='Tasks_Nav_Group'>
            {groups.length > 1 && <span className='Tasks_Nav_Phase'>{index + 1}</span>}
            {states.map((state) => (
              <button
                key={state.id}
                type='button'
                className={`Tasks_Nav_Chip${hidden(state.id) ? ' hidden' : ''}${collapsed.includes(state.id) ? ' collapsed' : ''}`}
                onClick={() => onJump(state)}
                disabled={hidden(state.id)}
                title={t('columns.jump', { name: state.name })}
              >
                <span className='Tasks_State_Dot' style={{ background: state.color }} />
                <span>{state.name}</span>
                <span className='Tasks_Column_Count'>{count(state.id)}</span>
              </button>
            ))}
          </div>
        ))}
      </div>

      <button type='button' className='Tasks_Nav_Step next' onClick={() => onStep(1)} aria-label={t('columns.next')} title={t('columns.next')}>
        <Icon.Chevron />
      </button>

      <label className='Tasks_Nav_Toggle'>
        <input type='checkbox' checked={hideEmpty} onChange={(e) => onHideEmpty(e.target.checked)} />
        <span>{t('columns.hideEmpty')}</span>
      </label>
    </div>
  );
};

export default Tasks_Columns_Nav;
