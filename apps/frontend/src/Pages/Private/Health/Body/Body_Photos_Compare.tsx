import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Global_Dropdown from '../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import type { PhotoPose, ProgressPhoto } from '../../../../Hooks/Health/healthLogTypes';
import Body_Photo_Image from './Body_Photo_Image';
import { PHOTO_POSES, daysBetween, formatFullDay } from './bodyFormat';

interface Body_Photos_Compare_Props {
  photos: ProgressPhoto[];
  days: string[];
}

const Body_Photos_Compare = ({ photos, days }: Body_Photos_Compare_Props) => {
  const { t } = useTranslation('health');
  const [before, setBefore] = useState(days[days.length - 1]);
  const [after, setAfter] = useState(days[0]);
  const [pose, setPose] = useState<PhotoPose>('FRONT');

  const beforeDay = days.includes(before) ? before : days[days.length - 1];
  const afterDay = days.includes(after) ? after : days[0];
  const options = days.map((day) => ({ value: day, label: formatFullDay(day) }));
  const sides = [
    { key: 'before', day: beforeDay, onChange: setBefore, label: t('body.photos.before') },
    { key: 'after', day: afterDay, onChange: setAfter, label: t('body.photos.after') },
  ];

  return (
    <section className='Health_card'>
      <div className='Health_card_head'>
        <div>
          <span className='Health_card_title'>{t('body.photos.compareTitle')}</span>
          <p className='Health_card_description'>
            {t('body.photos.compareDescription', { count: daysBetween(beforeDay, afterDay) })}
          </p>
        </div>
      </div>

      <div className='Diary_Kinds'>
        {PHOTO_POSES.map((option) => (
          <button key={option} type='button' className={option === pose ? 'active' : ''} onClick={() => setPose(option)}>
            {t(`body.poses.${option}`)}
          </button>
        ))}
      </div>

      <div className='Body_Compare'>
        {sides.map((side) => {
          const photo = photos.find((item) => item.day === side.day && item.pose === pose);
          return (
            <div key={side.key} className='Body_Compare_Side'>
              <div className='Health_Form_Field'>
                <label htmlFor={`compare-${side.key}`}>{side.label}</label>
                <Global_Dropdown
                  id={`compare-${side.key}`}
                  value={side.day}
                  onChange={side.onChange}
                  maxVisibleOptions={8}
                  options={options}
                />
              </div>
              {photo ? (
                <figure className='Body_Photo'>
                  <Body_Photo_Image photo={photo} alt={`${t(`body.poses.${pose}`)} · ${formatFullDay(side.day)}`} />
                </figure>
              ) : (
                <div className='Body_Photo_Missing'>{t('body.photos.missingPose', { pose: t(`body.poses.${pose}`) })}</div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default Body_Photos_Compare;
