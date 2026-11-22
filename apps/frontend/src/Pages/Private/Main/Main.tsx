import { Sidebar_Home } from '../../../Containers/Navigation/Home_Navigation/Sidebar_Home/Sidebar_Home';
import { useNavs } from '../../../Contexts/Navs_Context';
import Private_Routes from '../../../Routes/Private_Routes';
import Error_Boundary from '../../../Components/Error_Boundary/Error_Boundary';
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import * as Icon from '../../../Imports/icons';
import './Main.scss';

const Main = () => {
  const { t } = useTranslation('nav');
  const { typeOfNavigation } = useNavs();
  const { pathname } = useLocation();
  const [menuOpenOn, setMenuOpenOn] = useState<string | null>(null);
  const menuOpen = menuOpenOn === pathname;
  const keepsPageBetweenDocs = pathname.startsWith('/MyHomeLab/Docs');
  const boundaryKey = keepsPageBetweenDocs ? '/MyHomeLab/Docs' : pathname;

  function getNavClass(): string {
    switch (typeOfNavigation) {
      case "Sidebar_Home":
        return "Container_Sidebar_Home";
      case "Top_Nav_Navigation":
        return "Container_With_TopNav";
      case "Mobile_Menu":
        return "Container_With_MobileMenu";
      default:
        return "";
    }
  }

  return (
    <>
      <Sidebar_Home open={menuOpen} />
      {menuOpen && <div className="Sidebar_Backdrop" onClick={() => setMenuOpenOn(null)} />}

      <header className="Mobile_Bar">
        <button
          type="button"
          className="Mobile_Bar_Toggle"
          aria-label={t(menuOpen ? 'sidebar.closeMenu' : 'sidebar.openMenu')}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpenOn(menuOpen ? null : pathname)}
        >
          {menuOpen ? <Icon.Close /> : <Icon.Menu />}
        </button>
        <span className="Mobile_Bar_Brand">MyHomeLab</span>
      </header>

      <div className="MyHomeLab">
        <div className={getNavClass()}>
          <Error_Boundary key={boundaryKey}>
            <Private_Routes />
          </Error_Boundary>
        </div>
      </div>
    </>
  );
};

export default Main;