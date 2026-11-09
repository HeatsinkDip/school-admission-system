import { useCallback, useEffect, useState } from 'react';
import { AdminPortal } from './AdminPortal';
import { ParentPortal, formatRemainingSeconds, isValidStudentId } from './ParentPortal';
import { LandingPage } from './LandingPage';
import { ParentLoginPage } from './ParentLoginPage';
import { STUDENT_ID_STORAGE_KEY } from './config';
import './ParentPortal.css';
import './LandingPage.css';
import './K8sModals.css';

export { isValidStudentId, formatRemainingSeconds };

export function App() {
  // --- URL Routing: /admin -> AdminPortal, / -> ParentPortal ---
  const [pathname, setPathname] = useState<string>(() =>
    typeof window !== 'undefined' ? window.location.pathname : '/',
  );
  const [viewMode, setViewMode] = useState<'portal' | 'landing' | 'login'>(() => {
    if (typeof window !== 'undefined' && localStorage.getItem(STUDENT_ID_STORAGE_KEY)) {
      return 'portal';
    }
    return 'landing';
  });

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigateTo = useCallback((nextPath: string) => {
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', nextPath);
      setPathname(nextPath);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const isAdminRoute = pathname === '/admin' || pathname.startsWith('/admin/');
  const isLoginRoute = pathname === '/login' || pathname.startsWith('/login');

  if (isAdminRoute) {
    return <AdminPortal onNavigateToParent={() => navigateTo('/')} />;
  }

  if (isLoginRoute) {
    return (
      <ParentLoginPage
        onLoginSuccess={() => {
          navigateTo('/');
          setViewMode('portal');
        }}
        onOpenLanding={() => {
          navigateTo('/');
          setViewMode('landing');
        }}
      />
    );
  }

  if (viewMode === 'landing') {
    return (
      <div data-testid="parent-portal-view">
        <LandingPage
          onOpenParentPortal={() => setViewMode('portal')}
          savedStudentId={typeof window !== 'undefined' ? localStorage.getItem(STUDENT_ID_STORAGE_KEY) : null}
        />
      </div>
    );
  }

  return (
    <ParentPortal
      onNavigateToAdmin={() => navigateTo('/admin')}
      onOpenLanding={() => setViewMode('landing')}
    />
  );
}

export default App;
