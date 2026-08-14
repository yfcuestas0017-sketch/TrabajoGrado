import { createContext, useContext, useEffect, useState } from 'react';

export const THEMES = [
  { id: 'default', label: 'Ambar', accent: '#b31f3f', sidebar: '#0f1117' },
  { id: 'ocean', label: 'Oceano', accent: '#38bdf8', sidebar: '#0a1628' },
  { id: 'forest', label: 'Bosque', accent: '#4ade80', sidebar: '#0d1f17' },
  { id: 'crimson', label: 'Carmesi', accent: '#f87171', sidebar: '#180b0b' },
  { id: 'violet', label: 'Violeta', accent: '#a78bfa', sidebar: '#0e0b1a' },
];

export const FONT_SIZES = [
  { id: 'sm', label: 'Pequeno', base: '14px' },
  { id: 'md', label: 'Normal', base: '16px' },
  { id: 'lg', label: 'Grande', base: '18px' },
];

const ThemeContext = createContext(null);
// Breakpoints estandarizados: mobile 768px (tablet), desktop 769px+
const MOBILE_BREAKPOINT = 768;

export function ThemeProvider({ children }) {
  const [theme, setThemeId] = useState(() => localStorage.getItem('gradohub_theme') || 'default');
  const [fontSize, setFontSizeId] = useState(() => localStorage.getItem('gradohub_fontsize') || 'md');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme === 'default' ? '' : theme);
    localStorage.setItem('gradohub_theme', theme);
  }, [theme]);

  useEffect(() => {
    const size = FONT_SIZES.find((item) => item.id === fontSize)?.base || '16px';
    document.documentElement.style.fontSize = size;
    localStorage.setItem('gradohub_fontsize', fontSize);
  }, [fontSize]);

  useEffect(() => {
    const mediaQuery = window.matchMedia(`(min-width: ${MOBILE_BREAKPOINT + 1}px)`);
    const handleViewportChange = (event) => {
      if (event.matches) {
        setMobileSidebarOpen(false);
      }
    };

    handleViewportChange(mediaQuery);

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleViewportChange);
      return () => mediaQuery.removeEventListener('change', handleViewportChange);
    }

    mediaQuery.addListener(handleViewportChange);
    return () => mediaQuery.removeListener(handleViewportChange);
  }, []);

  useEffect(() => {
    if (!mobileSidebarOpen || window.innerWidth > MOBILE_BREAKPOINT) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileSidebarOpen]);

  const setTheme = (id) => setThemeId(id);
  const setFontSize = (id) => setFontSizeId(id);
  const toggleSidebar = () => setSidebarCollapsed((prev) => !prev);
  const openMobileSidebar = () => setMobileSidebarOpen(true);
  const closeMobileSidebar = () => setMobileSidebarOpen(false);
  const toggleMobileSidebar = () => setMobileSidebarOpen((prev) => !prev);

  const currentTheme = THEMES.find((item) => item.id === theme) || THEMES[0];
  const currentFontSize = FONT_SIZES.find((item) => item.id === fontSize) || FONT_SIZES[1];

  return (
    <ThemeContext.Provider
      value={{
        theme,
        currentTheme,
        setTheme,
        fontSize,
        currentFontSize,
        setFontSize,
        sidebarCollapsed,
        toggleSidebar,
        mobileSidebarOpen,
        openMobileSidebar,
        closeMobileSidebar,
        toggleMobileSidebar,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
