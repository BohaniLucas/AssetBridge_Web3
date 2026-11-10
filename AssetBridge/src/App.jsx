import { useState, useEffect } from 'react';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage';
import DashboardPage from './pages/DashboardPage';
import StokvelPotsPage from './pages/StokvelPotsPage';
import RemittancePage from './pages/RemittancePage';
import TradingPage from './pages/TradingPage';
import ReservesPage from './pages/ReservesPage';
import AdminLoginPage from './pages/AdminLoginPage';
import AdminPortalPage from './pages/AdminPortalPage';
import ErrorBoundary from './components/ErrorBoundary';
import { authService } from './services/authService';

function App() {
  const [currentView, setCurrentView] = useState(() => {
    const hash = window.location.hash.toLowerCase();
    if (hash.includes('/admin/login')) return 'admin_login';
    if (hash.includes('/admin')) return 'admin_dashboard';
    if (hash.includes('/login')) return 'login';
    if (hash.includes('/signup') || hash.includes('/register')) return 'signup';
    if (hash.includes('/wallet') || hash.includes('/dashboard')) return 'wallet';
    return 'landing';
  });

  const [currentUser, setCurrentUser] = useState(null);
  const [currentAdmin, setCurrentAdmin] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [securityNotice, setSecurityNotice] = useState('');
  const [adminNotice, setAdminNotice] = useState('');

  // Initial session restoration with strict isolation & admin routing priority
  useEffect(() => {
    Promise.all([
      authService.getCurrentUser(),
      authService.getCurrentAdmin(),
    ]).then(([user, admin]) => {
      const hash = window.location.hash.toLowerCase();

      // Check if admin session exists
      if (admin && admin.role === 'ADMIN') {
        setCurrentAdmin(admin);
        // If an admin is logged in and not on public landing/login, route directly to Admin Portal!
        if (!hash.includes('/admin/login') && !hash.includes('/login') && !hash.includes('/signup') && hash !== '#/' && hash !== '') {
          setCurrentView('admin_dashboard');
          window.location.hash = '#/admin/dashboard';
        }
      } else if (user) {
        if (user.role === 'ADMIN') {
          // If stored user session has ADMIN role, promote to currentAdmin and redirect to Admin Portal!
          setCurrentAdmin(user);
          authService.saveAdminSession(user);
          if (!hash.includes('/admin/login') && !hash.includes('/login') && !hash.includes('/signup') && hash !== '#/' && hash !== '') {
            setCurrentView('admin_dashboard');
            window.location.hash = '#/admin/dashboard';
          }
        } else {
          setCurrentUser(user);
        }
      }

      setAuthChecked(true);

      // Handle initial direct URL routing
      if (hash.includes('/admin/dashboard') || hash.includes('/admin')) {
        const activeAdmin = admin || (user?.role === 'ADMIN' ? user : null);
        if (activeAdmin && activeAdmin.role === 'ADMIN') {
          setCurrentView('admin_dashboard');
        } else {
          setCurrentView('admin_login');
        }
      }
    });

    // Listen to hash changes (browser back/forward & direct URL navigation)
    const handleHashChange = () => {
      const hash = window.location.hash.toLowerCase();
      if (hash.includes('/admin/login')) {
        setCurrentView('admin_login');
      } else if (hash.includes('/admin/dashboard') || hash.includes('/admin')) {
        authService.getCurrentAdmin().then((admin) => {
          if (admin && admin.role === 'ADMIN') {
            setCurrentAdmin(admin);
            setCurrentView('admin_dashboard');
          } else {
            setAdminNotice('Access Denied: Administrator authentication required to enter the Admin Portal.');
            setCurrentView('admin_login');
          }
        });
      } else if (hash.includes('/login')) {
        setCurrentView('login');
      } else if (hash.includes('/signup')) {
        setCurrentView('signup');
      } else if (hash.includes('/wallet') || hash.includes('/dashboard')) {
        authService.getCurrentUser().then((user) => {
          if (user) {
            if (user.role === 'ADMIN') {
              setCurrentAdmin(user);
              setCurrentView('admin_dashboard');
              window.location.hash = '#/admin/dashboard';
            } else {
              setCurrentUser(user);
              setCurrentView('wallet');
            }
          } else {
            setSecurityNotice('Authentication required: please log in to access your wallet.');
            setCurrentView('login');
          }
        });
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Secure navigation guard: strictly enforces application separation
  const handleNavigate = (targetView) => {
    const view = targetView === 'dashboard' ? 'wallet' : targetView;

    // 1. Admin Portal Navigation Routing
    if (view === 'admin_dashboard' || view.startsWith('admin_')) {
      if (view === 'admin_login') {
        window.location.hash = '#/admin/login';
        setCurrentView('admin_login');
        return;
      }

      // Must have authoritative admin role
      if (!currentAdmin || currentAdmin.role !== 'ADMIN') {
        setAdminNotice('Access Denied: Administrator authentication required to enter the Admin Portal.');
        window.location.hash = '#/admin/login';
        setCurrentView('admin_login');
        return;
      }

      setAdminNotice('');
      window.location.hash = '#/admin/dashboard';
      setCurrentView('admin_dashboard');
      return;
    }

    // 2. If an administrator tries to open normal user views:
    if (currentAdmin && currentAdmin.role === 'ADMIN') {
      const protectedUserViews = ['wallet', 'remittance', 'stokvel', 'trading', 'reserves', 'split'];
      if (protectedUserViews.includes(view)) {
        // Keep administrator in the Administration Portal
        window.location.hash = '#/admin/dashboard';
        setCurrentView('admin_dashboard');
        return;
      }
    }

    // 3. Normal User Protected Views
    const protectedUserViews = ['wallet', 'remittance', 'stokvel', 'trading', 'reserves', 'split'];
    if (protectedUserViews.includes(view)) {
      if (!currentUser) {
        setSecurityNotice('Authentication required: please log in to access your secure wallet.');
        window.location.hash = '#/login';
        setCurrentView('login');
        return;
      }
      setSecurityNotice('');
      window.location.hash = `#/dashboard/${view}`;
      setCurrentView(view);
      return;
    }

    // 4. Public views (landing, login, signup)
    setSecurityNotice('');
    if (view === 'login') window.location.hash = '#/login';
    else if (view === 'signup') window.location.hash = '#/signup';
    else if (view === 'landing') window.location.hash = '#/';
    setCurrentView(view);
  };

  /**
   * User Login Success Handler
   * If the authenticated account is an ADMINISTRATOR, redirect directly to ADMIN DASHBOARD!
   * If normal user, redirect to USER DASHBOARD ('wallet').
   */
  const handleUserLoginSuccess = (user) => {
    if (user && user.role === 'ADMIN') {
      // Administrator logged in -> Redirect directly to Administration Portal!
      setCurrentAdmin(user);
      authService.saveAdminSession(user);
      setAdminNotice('');
      window.location.hash = '#/admin/dashboard';
      setCurrentView('admin_dashboard');
      return;
    }

    // Normal consumer user
    setCurrentUser(user);
    setSecurityNotice('');
    window.location.hash = '#/wallet';
    setCurrentView('wallet');
  };

  /**
   * Administrator Login Success Handler
   * ALWAYS redirects administrators directly to the Admin Dashboard ('admin_dashboard').
   * NEVER redirects to the user wallet dashboard.
   */
  const handleAdminLoginSuccess = (admin) => {
    setCurrentAdmin(admin);
    authService.saveAdminSession(admin);
    setAdminNotice('');
    window.location.hash = '#/admin/dashboard';
    setCurrentView('admin_dashboard');
  };

  const handleSignUpSuccess = (user) => {
    setCurrentUser(user);
    setSecurityNotice('');
    window.location.hash = '#/wallet';
    setCurrentView('wallet');
  };

  const handleUserLogout = async () => {
    await authService.signOutUser();
    setCurrentUser(null);
    setSecurityNotice('');
    window.location.hash = '#/';
    setCurrentView('landing');
  };

  const handleAdminLogout = () => {
    authService.signOutAdmin();
    setCurrentAdmin(null);
    setAdminNotice('');
    window.location.hash = '#/admin/login';
    setCurrentView('admin_login');
  };

  // -------------------------------------------------------------
  // RENDERING SEPARATION
  // -------------------------------------------------------------

  // 1. If active session is an ADMINISTRATOR:
  // Strictly isolate them to the Administration Portal! They NEVER see the user dashboard.
  if (currentAdmin && currentAdmin.role === 'ADMIN') {
    if (currentView === 'admin_login') {
      return (
        <AdminLoginPage
          onNavigate={handleNavigate}
          onAdminLoginSuccess={handleAdminLoginSuccess}
        />
      );
    }
    if (currentView === 'landing') {
      return <LandingPage onNavigate={handleNavigate} />;
    }
    return (
      <AdminPortalPage
        adminUser={currentAdmin}
        onAdminLogout={handleAdminLogout}
        onNavigate={handleNavigate}
      />
    );
  }

  // 2. Administrator Login Screen
  if (currentView === 'admin_login') {
    return (
      <AdminLoginPage
        onNavigate={handleNavigate}
        onAdminLoginSuccess={handleAdminLoginSuccess}
      />
    );
  }

  // 3. Admin Dashboard Route Protection (Unauthenticated or normal user trying to access)
  if (currentView === 'admin_dashboard') {
    return (
      <AdminLoginPage
        onNavigate={handleNavigate}
        onAdminLoginSuccess={handleAdminLoginSuccess}
      />
    );
  }

  // 4. Public Marketing Landing Page
  if (currentView === 'landing') {
    return <LandingPage onNavigate={handleNavigate} />;
  }

  // 5. Normal User Login Screen
  if (currentView === 'login') {
    return (
      <LoginPage
        onNavigate={handleNavigate}
        onLoginSuccess={handleUserLoginSuccess}
        securityNotice={securityNotice}
      />
    );
  }

  // 6. Normal User Registration Screen
  if (currentView === 'signup') {
    return (
      <SignUpPage
        onNavigate={handleNavigate}
        onSignUpSuccess={handleSignUpSuccess}
      />
    );
  }

  // 7. Normal User Session Enforcement: If not logged in, enforce redirect to user login
  if (!currentUser && authChecked) {
    return (
      <LoginPage
        onNavigate={handleNavigate}
        onLoginSuccess={handleUserLoginSuccess}
        securityNotice="Session expired or unauthorized. Please authenticate to view your wallet."
      />
    );
  }

  // 8. Normal User Application & Dashboard (Consumer Experience)
  return (
    <DashboardPage
      currentView={currentView}
      onNavigate={handleNavigate}
      onLogout={handleUserLogout}
      user={currentUser}
    >
      <ErrorBoundary onNavigateHome={() => handleNavigate('wallet')}>
        {currentView === 'remittance' && <RemittancePage user={currentUser} />}
        {currentView === 'stokvel' && <StokvelPotsPage user={currentUser} />}
        {currentView === 'trading' && <TradingPage user={currentUser} />}
        {currentView === 'reserves' && <ReservesPage />}
      </ErrorBoundary>
    </DashboardPage>
  );
}

export default App;
