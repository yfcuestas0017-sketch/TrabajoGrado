import Header from './Header';
import Sidebar from './Sidebar';

export default function DashboardLayout({ children, title, subtitle }) {
  return (
    <div className="layout">
      <Sidebar />

      <div className="layout-main">
        <Header title={title} subtitle={subtitle} />
        <main className="layout-content">{children}</main>
      </div>

      <style>{`
        .layout {
          display: flex;
          height: 100dvh;        /* altura fija = viewport, sin scroll de window */
          overflow: hidden;
        }

        .layout-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          min-width: 0;
        }

        .layout-content {
          flex: 1;
          overflow-y: auto;
          padding: 32px;
          animation: fadeIn 0.3s ease;
        }

        @media (max-width: 1024px) {
          .layout-content {
            padding: 28px 24px;
          }
        }

        @media (max-width: 768px) {
          .layout-content {
            padding: 20px 16px 24px;
          }
        }

        @media (max-width: 640px) {
          .layout-content {
            padding: 16px 12px 20px;
          }
        }

        @media (max-width: 480px) {
          .layout-content {
            padding: 12px 8px 16px;
          }
        }
      `}</style>
    </div>
  );
}
