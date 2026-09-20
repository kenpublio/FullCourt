import React, { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';
import { useAuth } from '../hooks/useAuth';
import platformSettingsService from '../services/platformSettingsService';

const MainLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user } = useAuth();
  const isPlatformAdmin = ['platform_admin', 'admin'].includes(user?.role);
  const [adminTheme, setAdminTheme] = useState(() => localStorage.getItem('admin_console_theme') || 'dark');
  const [platformSettings,setPlatformSettings]=useState(null);

  useEffect(() => {
    if (isPlatformAdmin) localStorage.setItem('admin_console_theme', adminTheme);
  }, [adminTheme, isPlatformAdmin]);

  useEffect(()=>{
    let appearance='system';
    try{appearance=JSON.parse(localStorage.getItem(`fullcourt_settings_${user?.id}`))?.appearance||'system';}catch{appearance='system';}
    const dark=appearance==='dark'||(appearance==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);
    const resolvedTheme=dark?'dark':'light';
    document.documentElement.dataset.fullcourtTheme=resolvedTheme;
    document.documentElement.dataset.bsTheme=resolvedTheme;
  },[user?.id]);
  useEffect(()=>{const load=()=>platformSettingsService.get().then(setPlatformSettings).catch(()=>{});load();const update=event=>setPlatformSettings(event.detail);window.addEventListener('fullcourt-platform-settings',update);return()=>window.removeEventListener('fullcourt-platform-settings',update);},[]);

  return (
    <div className={`app-container${isPlatformAdmin ? ` admin-console admin-console-${adminTheme}` : ''}`}>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      {sidebarOpen && (
        <button
          className="sidebar-overlay"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <div className="main-content">
        <Navbar onMenuClick={() => setSidebarOpen(true)} adminTheme={isPlatformAdmin ? adminTheme : null} onThemeToggle={() => setAdminTheme(theme => theme === 'dark' ? 'light' : 'dark')} />
        {platformSettings?.maintenance_enabled&&<div className="maintenance-banner" role="status"><i className="bi bi-tools"/><div><b>Scheduled maintenance</b><span>{platformSettings.maintenance_message}</span></div>{isPlatformAdmin&&<small>Administrator access remains available</small>}</div>}
        <main className="app-page flex-grow-1">
          <Outlet />
        </main>
        <Footer />
      </div>
    </div>
  );
};

export default MainLayout;
