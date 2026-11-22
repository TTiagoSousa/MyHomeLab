import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { menuGroups, menuItems } from '../Menu_Itins';
import { useTheme } from '../../../../Contexts/ThemeContext';
import { useAuth } from '../../../../Contexts/Auth_Context';
import { useServers } from '../../../../Hooks/Servers/useServers';
import { useNotificationCount } from '../../../../Hooks/Notifications/useNotificationCount';
import * as Icon from '../../../../Imports/icons';
import './Sidebar_Home.scss';

interface Sidebar_Home_Props {
  open?: boolean;
}

export const Sidebar_Home: React.FC<Sidebar_Home_Props> = ({ open = false }) => {
  const { t } = useTranslation('nav');
  const location = useLocation();
  const { mode, handleDarkMode, handleLightMode } = useTheme();
  const { role, logout } = useAuth();
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set());
  const { servers } = useServers();
  const { count: notificationCount } = useNotificationCount();
  const visibleMenuItems = menuItems.filter(
    (item) => (!item.adminOnly || role === 'ADMIN') && (!item.serversOnly || servers.length > 0),
  );

  const toggleTheme = () => {
    if (mode === 'dark') handleLightMode();
    else handleDarkMode();
  };

  const getActiveItem = () => {
    const currentPath = location.pathname;

    for (const item of menuItems) {
      if (item.subItems) {
        const subItem = item.subItems.find(sub => sub.path && currentPath.startsWith(sub.path));
        if (subItem) return subItem.id;
      }
    }

    const mainItem = menuItems
      .filter(item => item.path && currentPath.startsWith(item.path))
      .sort((a, b) => b.path!.length - a.path!.length)[0];
    if (mainItem) return mainItem.id;

    return 'today';
  };

  const activeItem = getActiveItem();

  const toggleMenu = (menuId: string) => {
    const newExpanded = new Set(expandedMenus);
    if (newExpanded.has(menuId)) {
      newExpanded.delete(menuId);
    } else {
      newExpanded.add(menuId);
    }
    setExpandedMenus(newExpanded);
  };

  return (
    <div className={`Sidebar_Home${open ? ' open' : ''}`}>

      <div className="Sidebar_Brand">
        <div className="Icon_Box">
          <Icon.HomeLab color="var(--accent)" />
        </div>
        <span>MyHomeLab</span>
      </div>

      <nav className="Menu_Container">
        {menuGroups.map((group) => {
          const groupItems = visibleMenuItems.filter((item) => item.group === group);
          if (!groupItems.length) return null;
          return (
            <div className="Menu_Group" key={group}>
              <span className="Menu_Group_Title">{t(`groups.${group}`)}</span>
              {groupItems.map((item) => (
                <div className='Menu_Item_Container' key={item.id}>
                  {item.subItems ? (
                    <div
                      className={`Menu_Item has-submenu`}
                      onClick={() => toggleMenu(item.id)}
                    >
                      <span className="menu-icon"><item.icon /></span>
                      <span className="menu-label">{t(item.labelKey)}</span>
                      <span className={`menu-arrow ${expandedMenus.has(item.id) ? 'expanded' : ''}`}>
                        ▼
                      </span>
                    </div>
                  ) : (
                    <Link
                      to={item.path || '#'}
                      className={`Menu_Item ${activeItem === item.id ? 'active' : ''}`}
                      title={t(item.hintKey)}
                    >
                      <span className="Menu_Icon"><item.icon /></span>
                      <span className="Menu_Lable">{t(item.labelKey)}</span>
                      {item.id === 'notifications' && notificationCount > 0 && (
                        <span className="Menu_Badge">{notificationCount}</span>
                      )}
                    </Link>
                  )}

                  {item.subItems && expandedMenus.has(item.id) && (
                    <div className="submenu-container">
                      {item.subItems.map((subItem) => (
                        <Link
                          key={subItem.id}
                          to={subItem.path || '#'}
                          className={`submenu-item ${activeItem === subItem.id ? 'active' : ''}`}
                        >
                          • {t(subItem.labelKey)}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </nav>

      <div className="Sidebar_Bottom">
        <div className="Sidebar_Divider"></div>

        <div
          className="Sidebar_Bottom_Item Theme_Toggle_Item"
          role="button"
          tabIndex={0}
          onClick={toggleTheme}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleTheme()}
        >
          <div className="Icon_Box">
            {mode === 'dark' ? <Icon.Sun /> : <Icon.Moon />}
          </div>
          <span>{t('sidebar.theme')}</span>
        </div>

        <div className="Sidebar_Bottom_Item Profile_Item">
          <div className="Profile_Info">
            <div className="Icon_Box">
              <Icon.Profile />
            </div>
            <span>{t('sidebar.profile')}</span>
          </div>
          <button className="Logout_Button" onClick={logout} title={t('sidebar.logout')}>
            <Icon.Logout />
          </button>
        </div>
      </div>
    </div>
  );
};