import { Outlet } from 'react-router-dom';
import PublicHeader from './PublicHeader';
import PublicFooter from './PublicFooter';

export default function PublicLayout() {
  return (
    <div className="public-shell">
      <PublicHeader />
      <div className="public-body">
        <Outlet />
      </div>
      <PublicFooter />
    </div>
  );
}
