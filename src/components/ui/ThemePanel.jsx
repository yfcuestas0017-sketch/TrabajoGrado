import { Check, X } from 'lucide-react';
import { FONT_SIZES, THEMES, useTheme } from '../../context/ThemeContext';
import './ThemePanel.css';

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

    </>
  );
}
