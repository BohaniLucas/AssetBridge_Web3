import { useState, useEffect } from 'react';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage';
import DashboardPage from './pages/DashboardPage';
import StokvelPotsPage from './pages/StokvelPotsPage';
import RemittancePage from './pages/RemittancePage';
import TradingPage from './pages/TradingPage';
import ReservesPage from './pages/ReservesPage';
import { authService } from './services/authService';

function App() {
  const [currentView, setCurrentView] = useState('landing');
  const [currentUser, setCurrentUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [securityNotice, setSecurityNotice] = useState('');

  useEffect(() => {
    // Check initial session
    authService.getCurrentUser().then((user) => {
      if (user) {
        setCurrentUser(user);
      }
      setAuthChecked(true);
    });

    const { data: authListener } = authService.onAuthStateChange((event, session) => {
      if (session?.user) {
        setCurrentUser(session.user);
      } else {
        setCurrentUser(null);
      }
    });

    return () => {
      if (authListener?.subscription?.unsubscribe) {
        authListener.subscription.unsubscribe();
      }
    };
  }, []);

  // Secure navigation guard: protected routes require authentication
  const handleNavigate = (targetView) => {
    const view = targetView === 'dashboard' ? 'wallet' : targetView;
    const protectedViews = ['wallet', 'remittance', 'stokvel', 'trading', 'reserves'];
    if (protectedViews.includes(view) && !currentUser) {
      setSecurityNotice('Authentication required: please log in to access your secure wallet.');
      setCurrentView('login');
      return;
    }
    setSecurityNotice('');
    setCurrentView(view);
  };

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    setSecurityNotice('');
    setCurrentView('wallet');
  };

  const handleSignUpSuccess = (user) => {
    setCurrentUser(user);
    setSecurityNotice('');
    setCurrentView('wallet');
  };

  const handleLogout = async () => {
    await authService.signOut();
    setCurrentUser(null);
    setSecurityNotice('');
    setCurrentView('landing');
  };

  // Standalone full-bleed views
  if (currentView === 'landing') {
    return <LandingPage onNavigate={handleNavigate} />;
  }

  if (currentView === 'login') {
    return (
      <LoginPage
        onNavigate={handleNavigate}
        onLoginSuccess={handleLoginSuccess}
        securityNotice={securityNotice}
      />
    );
  }

  if (currentView === 'signup') {
    return (
      <SignUpPage
        onNavigate={handleNavigate}
        onSignUpSuccess={handleSignUpSuccess}
      />
    );
  }

  // If a user somehow reaches here without session, enforce redirect
  if (!currentUser && authChecked) {
    return (
      <LoginPage
        onNavigate={handleNavigate}
        onLoginSuccess={handleLoginSuccess}
        securityNotice="Session expired or unauthorized. Please authenticate."
      />
    );
  }

  return (
    <DashboardPage
      currentView={currentView}
      onNavigate={handleNavigate}
      onLogout={handleLogout}
      user={currentUser}
    >
      {currentView === 'remittance' && <RemittancePage />}
      {currentView === 'stokvel' && <StokvelPotsPage />}
      {currentView === 'trading' && <TradingPage />}
      {currentView === 'reserves' && <ReservesPage />}
    </DashboardPage>
  );
}

export default App;
