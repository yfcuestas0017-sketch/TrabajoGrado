import { Check, X } from 'lucide-react';
import { FONT_SIZES, THEMES, useTheme } from '../../context/ThemeContext';

export default function ThemePanel({ isOpen, onClose }) {
  const { theme, setTheme, fontSize, setFontSize } = useTheme();

  if (!isOpen) return null;

  return (
    <>
      <div className="panel-backdrop" onClick={onClose} />

      <div className="theme-panel">
        <div className="theme-panel-header">
          <div>
            <h2 className="theme-panel-title">Apariencia</h2>
            <p className="theme-panel-subtitle">Personaliza el look de la plataforma</p>
          </div>

          <button type="button" className="theme-panel-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="theme-panel-body">
          <section className="panel-section">
            <h3 className="panel-section-title">Tema de color</h3>
            <p className="panel-section-desc">
              Cambia el color de acento, sidebar y botones globalmente
            </p>

            <div className="theme-grid">
              {THEMES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`theme-swatch${theme === item.id ? ' theme-swatch--active' : ''}`}
                  onClick={() => setTheme(item.id)}
                  title={item.label}
                >
                  <div
                    className="theme-swatch-sidebar"
                    style={{ background: item.sidebar }}
                  />
                  <div
                    className="theme-swatch-accent"
                    style={{ background: item.accent }}
                  />
                  <span className="theme-swatch-label">{item.label}</span>

                  {theme === item.id && (
                    <div className="theme-swatch-check">
                      <Check size={10} />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </section>

          <section className="panel-section">
            <h3 className="panel-section-title">Tamano de texto</h3>

            <div className="size-options">
              {FONT_SIZES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`size-option${fontSize === item.id ? ' size-option--active' : ''}`}
                  onClick={() => setFontSize(item.id)}
                >
                  <span className="size-option-preview" style={{ fontSize: item.base }}>Aa</span>
                  <span className="size-option-label">{item.label}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="panel-section">
            <h3 className="panel-section-title">Vista previa</h3>

            <div className="panel-preview">
              <div className="preview-sidebar" />
              <div className="preview-content">
                <div className="preview-btn" />
                <div className="preview-line preview-line--wide" />
                <div className="preview-line" />
              </div>
            </div>
          </section>
        </div>
      </div>

      <style>{`
        .panel-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.3);
          backdrop-filter: blur(2px);
          z-index: 100;
        }

        .theme-panel {
          position: fixed;
          right: 0;
          top: 0;
          bottom: 0;
          width: min(100vw, 320px);
          background: var(--bg-secondary);
          border-left: 1px solid var(--border-color);
          z-index: 101;
          display: flex;
          flex-direction: column;
          box-shadow: var(--shadow-lg);
          animation: slideFromRight 0.25s ease;
        }

        @keyframes slideFromRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }

          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        .theme-panel-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          padding: 24px;
          border-bottom: 1px solid var(--border-color);
        }

        .theme-panel-title {
          font-family: var(--font-display);
          font-size: 1.2rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        .theme-panel-subtitle {
          font-size: 0.78rem;
          color: var(--text-muted);
          margin-top: 3px;
        }

        .theme-panel-close {
          width: 32px;
          height: 32px;
          background: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius-sm);
          color: var(--text-secondary);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all var(--transition-fast);
          flex-shrink: 0;
        }

        .theme-panel-close:hover {
          color: var(--text-primary);
        }

        .theme-panel-body {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 28px;
        }

        .panel-section-title {
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 4px;
          letter-spacing: -0.01em;
        }

        .panel-section-desc {
          font-size: 0.75rem;
          color: var(--text-muted);
          margin-bottom: 14px;
        }

        .theme-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 8px;
        }

        .theme-swatch {
          position: relative;
          border: 2px solid var(--border-color);
          border-radius: var(--border-radius-sm);
          overflow: hidden;
          cursor: pointer;
          aspect-ratio: 1;
          display: flex;
          flex-direction: column;
          transition: all var(--transition-fast);
          background: none;
          padding: 0;
        }

        .theme-swatch:hover {
          border-color: var(--text-muted);
          transform: scale(1.05);
        }

        .theme-swatch--active {
          border-color: var(--accent-primary) !important;
          box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent-primary) 30%, transparent);
        }

        .theme-swatch-sidebar {
          flex: 1;
        }

        .theme-swatch-accent {
          height: 8px;
        }

        .theme-swatch-label {
          display: none;
        }

        .theme-swatch-check {
          position: absolute;
          top: 4px;
          right: 4px;
          width: 16px;
          height: 16px;
          background: var(--accent-primary);
          color: #000;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .size-options {
          display: flex;
          gap: 10px;
        }

        .size-option {
          flex: 1;
          border: 2px solid var(--border-color);
          border-radius: var(--border-radius-sm);
          background: var(--bg-primary);
          padding: 12px 8px;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          transition: all var(--transition-fast);
        }

        .size-option:hover {
          border-color: var(--text-muted);
        }

        .size-option--active {
          border-color: var(--accent-primary);
          background: color-mix(in srgb, var(--accent-primary) 8%, var(--bg-primary));
        }

        .size-option-preview {
          font-weight: 700;
          color: var(--text-primary);
          line-height: 1;
        }

        .size-option-label {
          font-size: 0.7rem;
          color: var(--text-muted);
        }

        .panel-preview {
          display: flex;
          border-radius: var(--border-radius-md);
          overflow: hidden;
          border: 1px solid var(--border-color);
          height: 80px;
        }

        .preview-sidebar {
          width: 36px;
          background: var(--sidebar-bg);
          flex-shrink: 0;
        }

        .preview-content {
          flex: 1;
          background: var(--bg-primary);
          padding: 10px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .preview-btn {
          width: 50px;
          height: 14px;
          border-radius: 4px;
          background: var(--accent-primary);
        }

        .preview-line {
          height: 8px;
          border-radius: 4px;
          background: var(--border-color);
          width: 55%;
        }

        .preview-line--wide {
          width: 80%;
        }

        @media (max-width: 480px) {
          .theme-panel-header,
          .theme-panel-body {
            padding: 20px 16px;
          }

          .theme-grid {
            grid-template-columns: repeat(4, 1fr);
          }

          .size-options {
            flex-direction: column;
          }
        }
      `}</style>
    </>
  );
}
