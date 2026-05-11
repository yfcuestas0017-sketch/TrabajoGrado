import { useState } from 'react';
import { Bell, Menu, Palette, Search } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import ThemePanel from '../ui/ThemePanel';

export default function Header({ title, subtitle }) {
  const [themePanelOpen, setThemePanelOpen] = useState(false);
  const { toggleMobileSidebar } = useTheme();

  return (
    <>
      <header className="header">
        <div className="header-top">
          <div className="header-title-block">
            <h1 className="header-title">{title}</h1>
            {subtitle && <p className="header-subtitle">{subtitle}</p>}
          </div>

          <button
            type="button"
            className="header-btn header-btn--menu"
            onClick={toggleMobileSidebar}
            aria-label="Abrir menu"
            title="Abrir navegacion"
          >
            <Menu size={18} />
          </button>
        </div>

        <div className="header-actions">
          <div className="header-search">
            <Search size={15} className="header-search-icon" />
            <input
              type="text"
              placeholder="Buscar proyectos..."
              className="header-search-input"
            />
          </div>

          <button type="button" className="header-btn" aria-label="Notificaciones">
            <Bell size={18} />
          </button>

          <button
            type="button"
            className="header-btn header-btn--accent"
            onClick={() => setThemePanelOpen(true)}
            aria-label="Personalizar tema"
            title="Personalizar apariencia"
          >
            <Palette size={18} />
          </button>
        </div>
      </header>

      <ThemePanel isOpen={themePanelOpen} onClose={() => setThemePanelOpen(false)} />

      <style>{`
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 20px 32px;
          background: var(--bg-header);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--border-color);
          position: sticky;
          top: 0;
          z-index: 30;
        }

        .header-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          min-width: 0;
        }

        .header-title-block {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .header-title {
          font-family: var(--font-display);
          font-size: 1.4rem;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.02em;
        }

        .header-subtitle {
          font-size: 0.8rem;
          color: var(--text-muted);
          margin-top: 1px;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .header-search {
          position: relative;
          display: flex;
          align-items: center;
          flex: 1;
        }

        .header-search-icon {
          position: absolute;
          left: 12px;
          color: var(--text-muted);
          pointer-events: none;
        }

        .header-search-input {
          border: 1px solid var(--border-color);
          background: var(--bg-secondary);
          border-radius: var(--border-radius-md);
          padding: 8px 14px 8px 36px;
          font-size: 0.85rem;
          font-family: var(--font-body);
          color: var(--text-primary);
          width: 220px;
          transition: all var(--transition-fast);
          outline: none;
        }

        .header-search-input:focus {
          border-color: var(--accent-primary);
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-primary) 15%, transparent);
          width: 260px;
        }

        .header-search-input::placeholder {
          color: var(--text-muted);
        }

        .header-btn {
          width: 38px;
          height: 38px;
          border: 1px solid var(--border-color);
          background: var(--bg-secondary);
          border-radius: var(--border-radius-sm);
          color: var(--text-secondary);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all var(--transition-fast);
          flex-shrink: 0;
        }

        .header-btn:hover {
          border-color: var(--accent-primary);
          color: var(--accent-primary);
        }

        .header-btn--menu {
          display: none;
        }

        .header-btn--accent {
          background: var(--accent-primary);
          border-color: var(--accent-primary);
          color: #000;
        }

        .header-btn--accent:hover {
          background: var(--accent-primary-hover);
          border-color: var(--accent-primary-hover);
          color: #000;
        }

        @media (max-width: 1024px) {
          .header { padding: 18px 24px; gap: 14px; }
        }

        @media (max-width: 768px) {
          .header { flex-direction: row; align-items: center; justify-content: space-between; padding: 16px 20px; gap: 12px; }
          .header-top { flex: 1; min-width: 0; }
          .header-actions { gap: 8px; flex-direction: row-reverse; }
          .header-btn--menu { display: flex; }
          .header-search { max-width: 280px; }
          .header-title { font-size: 1.2rem; }
          .header-subtitle { font-size: 0.75rem; }
        }

        @media (max-width: 640px) {
          .header { padding: 14px 16px; }
          .header-search { max-width: 200px; }
          .header-search-input, .header-search-input:focus { width: 200px; font-size: 0.8rem; padding: 6px 10px 6px 32px; }
          .header-search-icon { left: 10px; }
          .header-btn { width: 36px; height: 36px; }
          .header-title { font-size: 1.1rem; }
        }

        @media (max-width: 480px) {
          .header { padding: 12px 12px; gap: 8px; }
          .header-search { display: none; }
          .header-actions { gap: 6px; }
          .header-btn { width: 34px; height: 34px; border-radius: 6px; }
          .header-title { font-size: 1rem; }
          .header-subtitle { font-size: 0.7rem; }
        }

        @media (max-width: 380px) {
          .header { padding: 10px 8px; }
          .header-title { font-size: 0.95rem; }
          .header-btn { width: 32px; height: 32px; }
        }
      `}</style>
    </>
  );
}
