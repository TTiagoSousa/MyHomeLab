import Header_Index from '../../../Containers/Header/Header_Index/Header_Index';
import Global_Input from '../../../Components/Inputs/Global_Input/Global_Input';
import Simple_Button from '../../../Components/Buttons/Simple_Button/Simple_Button';
import './Index.scss';
import { useSignin } from '../../../Hooks/Auth/useSignin';
import * as Icons from '../../../Imports/icons';
import { useTranslation } from 'react-i18next';

const Index = () => {
  const { t } = useTranslation('auth');

  const {
    signInEmail,
    setSignInEmail,
    signInpassword,
    setSignInpassword,
    signin,
    loading,
  } = useSignin();

  return (
    <>
      <Header_Index />
      <div className="Index">
        <div className="Content">
          <div className='Info'>
            <div className='Icon'>
              <Icons.HomeLab color="var(--simple-button-letter-color)"/>
            </div>
            <div className='Title'>
              <span>My Home Lab</span>
            </div>
            <div className='Description'>
              <span>{t('login.description')}</span>
            </div>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); signin(); }}>
            <div className="Input_field">
              <label htmlFor='email'>{t('login.username')}</label>
              <Global_Input
                id='email'
                placeholder='admin@home.lab'
                type='text'
                value={signInEmail}
                onChange={(e) => setSignInEmail(e.target.value)}
              />
            </div>
            <div className="Input_field">
              <label htmlFor='password'>{t('login.password')}</label>
              <Global_Input
                id='password'
                placeholder='••••••••'
                type='password'
                value={signInpassword}
                onChange={(e) => setSignInpassword(e.target.value)}
              />
            </div>
            <div className="Button_field">
              <Simple_Button
                text={t('login.submit')}
                type='submit'
                disabled={loading}
              />
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default Index;
