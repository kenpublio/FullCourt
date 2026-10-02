import React, { Suspense, useEffect, useState } from 'react';
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
  const [appearance, setAppearance] = useState('light');
  const [platformSettings,setPlatformSettings]=useState(null);

  useEffect(() => {
    if (isPlatformAdmin) localStorage.setItem('admin_console_theme', adminTheme);
  }, [adminTheme, isPlatformAdmin]);

  useEffect(()=>{
    let savedAppearance='system';
    try {
      const saved=JSON.parse(localStorage.getItem(`fullcourt_settings_${user?.id}`)||'null');
      savedAppearance=saved?.appearance||localStorage.getItem('fullcourt_public_theme')||'system';
    } catch { savedAppearance=localStorage.getItem('fullcourt_public_theme')||'system'; }
    if (!['light','dark','system'].includes(savedAppearance)) savedAppearance='system';
    setAppearance(savedAppearance);
    const applyTheme=value=>{
      const dark=value==='dark'||(value==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);
      const resolvedTheme=dark?'dark':'light';
      document.documentElement.dataset.fullcourtTheme=resolvedTheme;
      document.documentElement.dataset.bsTheme=resolvedTheme;
    };
    applyTheme(savedAppearance);
    const syncAppearance=event=>{
      if (!event.detail?.appearance) return;
      setAppearance(event.detail.appearance);
      applyTheme(event.detail.appearance);
    };
    window.addEventListener('fullcourt-theme-change',syncAppearance);
    return()=>window.removeEventListener('fullcourt-theme-change',syncAppearance);
  },[user?.id]);

  const toggleAppearance=()=>{
    const next=document.documentElement.dataset.fullcourtTheme==='dark'?'light':'dark';
    let saved={};
    try { saved=JSON.parse(localStorage.getItem(`fullcourt_settings_${user?.id}`)||'{}')||{}; } catch { saved={}; }
    saved.appearance=next;
    localStorage.setItem(`fullcourt_settings_${user?.id}`,JSON.stringify(saved));
    localStorage.setItem('fullcourt_public_theme',next);
    setAppearance(next);
    document.documentElement.dataset.fullcourtTheme=next;
    document.documentElement.dataset.bsTheme=next;
  };
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
        <Navbar onMenuClick={() => setSidebarOpen(true)} adminTheme={isPlatformAdmin ? adminTheme : null} appearance={appearance} onAppearanceToggle={toggleAppearance} onThemeToggle={() => setAdminTheme(theme => theme === 'dark' ? 'light' : 'dark')} />
        {platformSettings?.maintenance_enabled&&<div className="maintenance-banner" role="status"><i className="bi bi-tools"/><div><b>Scheduled maintenance</b><span>{platformSettings.maintenance_message}</span></div>{isPlatformAdmin&&<small>Administrator access remains available</small>}</div>}
        <main className="app-page flex-grow-1">
          <Suspense fallback={<div className="route-loading-state" role="status" aria-live="polite"><span className="spinner-border spinner-border-sm" aria-hidden="true"/><span>Opening this section…</span></div>}>
            <Outlet />
          </Suspense>
        </main>
        <Footer />
      </div>
    </div>
  );
};

export default MainLayout;
