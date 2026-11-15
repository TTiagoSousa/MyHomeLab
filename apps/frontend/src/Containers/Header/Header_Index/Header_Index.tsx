import Theme_Toggle from '../../../Components/Toggles/Theme_Toggle/Theme_Toggle';
import './Header_Index.scss';

const Header_Index = () => {
  return (
    <div className="Header_Index">
      <div className="Left_Side"></div>
      <div className="Right_Side">
        <div className="Button">
          <Theme_Toggle />
        </div>
      </div>
    </div>
  );
};

export default Header_Index;
