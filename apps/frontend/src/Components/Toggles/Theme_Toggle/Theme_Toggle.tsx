import { useTheme } from '../../../Contexts/ThemeContext';
import * as Icon from '../../../Imports/icons';
import './Theme_Toggle.scss';

const Theme_Toggle = () => {
  const { mode, handleDarkMode, handleLightMode } = useTheme();

  const toggle = () => {
    if (mode === 'dark') handleLightMode();
    else handleDarkMode();
  };

  return (
    <div className="Theme_Toggle">
      <button onClick={toggle}>
        {mode === 'dark' ? <Icon.Sun color="var(--navbar-vertical-default-link-color)" /> : <Icon.Moon color="var(--navbar-vertical-default-link-color)" />}
      </button>
    </div>
  );
};

export default Theme_Toggle;
