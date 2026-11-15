import { useTranslation } from 'react-i18next';

interface Nutrition_Photo_Field_Props {
  preview: string | null;
  fileName: string | null;
  onPhoto: (photo: File | null) => void;
}

const Nutrition_Photo_Field = ({ preview, fileName, onPhoto }: Nutrition_Photo_Field_Props) => {
  const { t } = useTranslation('health');

  return (
    <div className='Health_Form_Field Nutrition_Photo_Field'>
      <label htmlFor='meal-photo'>{t('nutrition.photo')}</label>
      <div className='Nutrition_Photo_Row'>
        {preview && <img className='Nutrition_Photo_Preview' src={preview} alt={t('nutrition.photoAlt')} />}
        <label className='Nutrition_Photo_Pick' htmlFor='meal-photo'>
          {fileName ?? (preview ? t('nutrition.photoChange') : t('nutrition.photoPick'))}
        </label>
        <input
          id='meal-photo'
          type='file'
          accept='image/jpeg,image/png,image/webp,image/gif'
          onChange={(e) => {
            onPhoto(e.target.files?.[0] ?? null);
            e.target.value = '';
          }}
        />
        {fileName && (
          <button type='button' className='Nutrition_Photo_Clear' aria-label={t('nutrition.photoRemove')} title={t('nutrition.photoRemove')} onClick={() => onPhoto(null)}>
            ×
          </button>
        )}
      </div>
    </div>
  );
};

export default Nutrition_Photo_Field;
