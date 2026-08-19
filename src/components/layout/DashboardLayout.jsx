import Header from './Header';
import Sidebar from './Sidebar';
import './DashboardLayout.css';
import Chatbook from '../chatbook/Chatbook';

export default function DashboardLayout({ children, title, subtitle }) {
  return (
    <div className="layout">
      <Sidebar />

      <div className="layout-main">
        <Header title={title} subtitle={subtitle} />
        <main className="layout-content">{children}</main>
      </div>

      <Chatbook />

    </div>
  );
}
