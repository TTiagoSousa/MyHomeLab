import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ProgressPhoto } from '../../../../Hooks/Health/healthLogTypes';
import Body_Photo_Image from './Body_Photo_Image';
import { formatFullDay, photoDays, sortPhotos } from './bodyFormat';

interface Body_Photos_Gallery_Props {
  photos: ProgressPhoto[];
  onRemove: (id: string) => void;
}

const Body_Photos_Gallery = ({ photos, onRemove }: Body_Photos_Gallery_Props) => {
  const { t } = useTranslation('health');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const sorted = sortPhotos(photos);

  const handleRemove = (id: string) => {
    if (confirmId !== id) {
      setConfirmId(id);
      return;
    }
    setConfirmId(null);
    onRemove(id);
  };

  return (
    <section className='Health_card'>
      <div className='Health_card_head'>
        <div>
          <span className='Health_card_title'>{t('body.photos.gallery', { count: photos.length })}</span>
          <p className='Health_card_description'>{t('body.photos.galleryDescription')}</p>
        </div>
      </div>

      <div className='Body_Gallery'>
        {photoDays(photos).map((day) => (
          <div key={day} className='Body_Gallery_Day'>
            <span className='Diary_Day_Label'>{formatFullDay(day)}</span>
            <div className='Body_Gallery_Grid'>
              {sorted
                .filter((photo) => photo.day === day)
                .map((photo) => (
                  <figure key={photo.id} className='Body_Photo'>
                    <Body_Photo_Image photo={photo} alt={`${t(`body.poses.${photo.pose}`)} · ${formatFullDay(day)}`} />
                    <figcaption>
                      <span className='Body_Photo_Pose'>{t(`body.poses.${photo.pose}`)}</span>
                      {photo.notes && <span className='Body_Photo_Notes'>{photo.notes}</span>}
                      <button
                        type='button'
                        className={`Health_see_all danger${confirmId === photo.id ? ' confirm' : ''}`}
                        onClick={() => handleRemove(photo.id)}
                        onBlur={() => setConfirmId(null)}
                      >
                        {confirmId === photo.id ? t('body.confirmRemove') : t('body.remove')}
                      </button>
                    </figcaption>
                  </figure>
                ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default Body_Photos_Gallery;
