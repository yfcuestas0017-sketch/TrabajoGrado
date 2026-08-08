import Header from './Header';
import Sidebar from './Sidebar';
import './DashboardLayout.css';

export default function DashboardLayout({ children, title, subtitle }) {
  return (
    <div className="layout">
      <Sidebar />

      <div className="layout-main">
        <Header title={title} subtitle={subtitle} />
        <main className="layout-content">{children}</main>
      </div>

    </div>
  );
}
