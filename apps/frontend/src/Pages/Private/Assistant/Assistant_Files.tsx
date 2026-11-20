import { useTranslation } from 'react-i18next';
import { fileExtension, fileSize, openChatFile, type Chat_File } from '../../../Hooks/Assistant/chatFiles';
import { useAlert } from '../../../Contexts/Alert_Context';
import * as Icon from '../../../Imports/icons';

interface Pending_Props {
  files: File[];
  onRemove: (index: number) => void;
}

export const Assistant_Pending_Files = ({ files, onRemove }: Pending_Props) => {
  const { t } = useTranslation('assistant');
  if (!files.length) return null;
  return (
    <div className='Assistant_Files pending'>
      {files.map((file, index) => (
        <span className='Assistant_File' key={`${file.name}-${index}`}>
          <span className='Assistant_File_ext'>{fileExtension(file.name)}</span>
          <span className='Assistant_File_name'>{file.name}</span>
          <span className='Assistant_File_size'>{fileSize(file.size)}</span>
          <button type='button' className='Assistant_File_remove' onClick={() => onRemove(index)} aria-label={t('files.remove', { name: file.name })}>
            <Icon.Close />
          </button>
        </span>
      ))}
    </div>
  );
};

export const Assistant_Message_Files = ({ files }: { files: Chat_File[] }) => {
  const { t } = useTranslation('assistant');
  const { setAlert } = useAlert();

  const open = async (file: Chat_File) => {
    try {
      await openChatFile(file);
    } catch {
      setAlert({ open: true, message: t('files.openFailed'), type: 'error' });
    }
  };

  return (
    <div className='Assistant_Files'>
      {files.map((file, index) => (
        <button
          type='button'
          className='Assistant_File'
          key={file.id || `${file.name}-${index}`}
          disabled={!file.id}
          onClick={() => void open(file)}
          aria-label={t('files.open', { name: file.name })}
        >
          <span className='Assistant_File_ext'>{fileExtension(file.name)}</span>
          <span className='Assistant_File_name'>{file.name}</span>
          <span className='Assistant_File_size'>{fileSize(file.size)}</span>
        </button>
      ))}
    </div>
  );
};
