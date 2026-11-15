import { Sidebar_Home } from '../../../Containers/Navigation/Home_Navigation/Sidebar_Home/Sidebar_Home';
import { useNavs } from '../../../Contexts/Navs_Context';
import Private_Routes from '../../../Routes/Private_Routes';
import Error_Boundary from '../../../Components/Error_Boundary/Error_Boundary';
import { useLocation } from 'react-router-dom';
import './Main.scss';

const Main = () => {
  const { typeOfNavigation } = useNavs();
  const { pathname } = useLocation();
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
      <Sidebar_Home />

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