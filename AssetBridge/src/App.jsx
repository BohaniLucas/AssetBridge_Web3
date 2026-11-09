import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
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
    const protectedViews = ['dashboard', 'remittance', 'stokvel', 'trading', 'reserves'];
    if (protectedViews.includes(targetView) && !currentUser) {
      setSecurityNotice('Authentication required: please log in to access your secure wallet.');
      setCurrentView('login');
      return;
    }
    setSecurityNotice('');
    setCurrentView(targetView);
  };

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    setSecurityNotice('');
    setCurrentView('dashboard');
  };

  const handleSignUpSuccess = (user) => {
    setCurrentUser(user);
    setSecurityNotice('');
    setCurrentView('dashboard');
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

  // Titles for views
  const viewTitles = {
    dashboard: 'Overview',
    remittance: 'Send Home (Remittance)',
    stokvel: 'Stokvel & Chama Pots',
    trading: 'Live Markets & Trading',
    reserves: 'Reserve & Attestation Panel',
  };

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

  // Authenticated Dashboard Layout matching Image 1
  return (
    <div className="min-h-screen bg-[#E5E9F0] p-2 sm:p-4 lg:p-6 flex items-stretch justify-center">
      <div className="w-full max-w-[1540px] bg-[#141518] rounded-[2.5rem] p-2 sm:p-3 shadow-2xl flex flex-col md:flex-row overflow-hidden border border-black/40">
        
        {/* Left Dark Sidebar */}
        <Sidebar
          currentView={currentView}
          onNavigate={handleNavigate}
          onLogout={handleLogout}
        />

        {/* Main Content White Board */}
        <main className="flex-1 bg-[#F6F7FA] rounded-[2rem] p-4 sm:p-6 lg:p-8 overflow-y-auto flex flex-col">
          <Navbar
            title={viewTitles[currentView] || 'Overview'}
            user={currentUser}
            onLogout={handleLogout}
          />

          <div className="flex-1">
            {currentView === 'dashboard' && <DashboardPage onNavigate={handleNavigate} />}
            {currentView === 'remittance' && <RemittancePage />}
            {currentView === 'stokvel' && <StokvelPotsPage />}
            {currentView === 'trading' && <TradingPage />}
            {currentView === 'reserves' && <ReservesPage />}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
