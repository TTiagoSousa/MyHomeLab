import { useTranslation } from 'react-i18next';
import type { ProgressPhotoUpload } from '../../../../Hooks/Health/useBody';
import type { ProgressPhoto } from '../../../../Hooks/Health/healthLogTypes';
import Body_Photos_Card from './Body_Photos_Card';
import Body_Photos_Compare from './Body_Photos_Compare';
import Body_Photos_Gallery from './Body_Photos_Gallery';
import { photoDays } from './bodyFormat';

interface Body_Photos_Section_Props {
  photos: ProgressPhoto[];
  loading: boolean;
  saving: boolean;
  onUpload: (upload: ProgressPhotoUpload) => Promise<string | null>;
  onRemove: (id: string) => void;
}

const Body_Photos_Section = ({ photos, loading, saving, onUpload, onRemove }: Body_Photos_Section_Props) => {
  const { t } = useTranslation('health');
  const days = photoDays(photos);

  return (
    <>
      <Body_Photos_Card saving={saving} onUpload={onUpload} />

      {!loading && photos.length === 0 && (
        <div className='Health_empty'>
          <span className='Health_empty_title'>{t('body.photos.emptyTitle')}</span>
          <span>{t('body.photos.emptyText')}</span>
        </div>
      )}

      {days.length > 1 && <Body_Photos_Compare photos={photos} days={days} />}

      {photos.length > 0 && <Body_Photos_Gallery photos={photos} onRemove={onRemove} />}
    </>
  );
};

export default Body_Photos_Section;
