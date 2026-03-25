import { LocationProvider, Router, Route, useLocation, useRoute } from 'preact-iso';
import { useState, useEffect } from 'preact/hooks';
import { LoginForm } from './components/LoginForm';
import { DemoPage } from './pages/DemoPage';
import { CompanyList } from './pages/CompanyList';
import { CreateCompany } from './pages/CreateCompany';
import { EditCompany } from './pages/EditCompany';
import { CompanyCalculator } from './pages/CompanyCalculator';
import { NotFound } from './pages/NotFound';
import { api } from './api';

// Global auth state (simple module-level signals to avoid prop drilling)
let _loggedIn = false;
let _companyName = '';
let _companyId = '';
let _role: 'super-admin' | 'company-admin' | null = null;
let _listeners: (() => void)[] = [];

function useAuth() {
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    const cb = () => forceUpdate((n) => n + 1);
    _listeners.push(cb);
    return () => { _listeners = _listeners.filter((l) => l !== cb); };
  }, []);
  return {
    loggedIn: _loggedIn,
    companyName: _companyName,
    companyId: _companyId,
    role: _role,
    setAuth: (loggedIn: boolean, name: string, id: string = '', role: 'super-admin' | 'company-admin' | null = null) => {
      _loggedIn = loggedIn;
      _companyName = name;
      _companyId = id;
      _role = role;
      _listeners.forEach((l) => l());
    },
  };
}

function AdminPage({ children }: { children: any }) {
  const { loggedIn, companyName, companyId, role, setAuth } = useAuth();
  const [checking, setChecking] = useState(!_loggedIn);

  useEffect(() => {
    if (_loggedIn) { setChecking(false); return; }
    api.checkSession().then((data) => {
      if (data) setAuth(true, data.name, data.companyId, data.role);
      setChecking(false);
    }).catch(() => setChecking(false));
  }, []);

  const handleLogout = async () => {
    try { await api.logout(); } catch { /* ignore */ }
    setAuth(false, '', '', null);
  };

  if (checking) {
    return (
      <div class="login-page">
        <div class="login-card" style={{ textAlign: 'center', padding: '48px' }}>
          <p class="page-subtitle">Loading...</p>
        </div>
      </div>
    );
  }

  if (!loggedIn) {
    return (
      <LoginForm onLogin={(_id: string, name: string) => setAuth(true, name)} />
    );
  }

  return (
    <div class="admin-shell">
      <AdminSidebar companyName={companyName} companyId={companyId} role={role} onLogout={handleLogout} />
      <main class="main-content" tabIndex={0}>
        {children}
      </main>
    </div>
  );
}

function AdminCompanyList() {
  const { role, companyId } = useAuth();
  // Redirect company-admin away from the company list to their own company edit page
  if (_loggedIn && role === 'company-admin' && companyId) {
    window.location.replace(`/admin/companies/${companyId}`);
    return null;
  }
  return <AdminPage><CompanyList /></AdminPage>;
}

function AdminCreateCompany() {
  return <AdminPage><CreateCompany /></AdminPage>;
}

function AdminEditCompany({ companyId }: { companyId: string }) {
  return <AdminPage><EditCompany companyId={companyId} /></AdminPage>;
}

function AdminSidebar({ companyName, companyId, role, onLogout }: { companyName: string; companyId: string; role: 'super-admin' | 'company-admin' | null; onLogout: () => void }) {
  const { url } = useLocation();

  const navItems = [
    ...(role === 'super-admin' ? [{ href: '/admin/companies', label: 'Companies', icon: 'companies' }] : []),
    { href: '/', label: 'View Demo', icon: 'demo' },
  ];

  return (
    <nav class="sidebar" aria-label="Admin navigation">
      <div class="sidebar-brand">
        <h1>{companyName} <span class="brand-accent">/</span></h1>
        <p>Admin Dashboard</p>
      </div>

      <div class="sidebar-nav">
        {navItems.map((item) => (
          <a
            key={item.href}
            href={item.href}
            class={`nav-item ${url.startsWith(item.href) && item.href !== '/' ? 'nav-item--active' : ''}`}
          >
            <NavIcon type={item.icon} />
            {item.label}
          </a>
        ))}
        {role === 'company-admin' && companyId && (
          <a
            href={`/admin/companies/${companyId}`}
            class={`nav-item ${url.includes(companyId) ? 'nav-item--active' : ''}`}
          >
            <NavIcon type="companies" />
            My Company
          </a>
        )}
      </div>

      <div class="sidebar-footer">
        <button class="logout-btn" onClick={onLogout} aria-label="Log out">
          <NavIcon type="logout" />
          <span>Log Out</span>
        </button>
      </div>
    </nav>
  );
}

function NavIcon({ type }: { type: string }) {
  const svgProps = { class: 'nav-icon', viewBox: '0 0 20 20', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5', 'stroke-linecap': 'round' as const, 'stroke-linejoin': 'round' as const, 'aria-hidden': true as const };

  if (type === 'companies') {
    return (
      <svg {...svgProps}>
        <path d="M3 7l7-4 7 4v9a1 1 0 01-1 1H4a1 1 0 01-1-1V7z" />
        <path d="M9 17V11h2v6" />
      </svg>
    );
  }
  if (type === 'demo') {
    return (
      <svg {...svgProps}>
        <path d="M15 3l2 2-8 8H7v-2l8-8zM3 17h14" />
      </svg>
    );
  }
  return (
    <svg {...svgProps}>
      <path d="M7 17H4a1 1 0 01-1-1V4a1 1 0 011-1h3M14 13l3-3-3-3M17 10H7" />
    </svg>
  );
}

export function App() {
  return (
    <LocationProvider>
      <Router>
        <Route path="/" component={DemoPage} />
        <Route path="/admin" component={AdminCompanyList} />
        <Route path="/admin/companies" component={AdminCompanyList} />
        <Route path="/admin/companies/new" component={AdminCreateCompany} />
        <Route path="/admin/companies/:companyId" component={AdminEditCompany} />
        <Route path="/:slug" component={SlugRoute} />
        <Route default component={NotFound} />
      </Router>
    </LocationProvider>
  );
}

function SlugRoute({ slug }: { slug: string }) {
  if (slug === 'admin') return <AdminCompanyList />;
  return <CompanyCalculator slug={slug} />;
}
