import { useState } from 'preact/hooks';
import { api } from '../api';

interface LoginFormProps {
  onLogin: (companyId: string, name: string, role: 'super-admin' | 'company-admin') => void;
}

export function LoginForm({ onLogin }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await api.login(email, password);
      onLogin(result.companyId, result.name, result.role);
    } catch {
      setError('Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="login-page">
      <div class="login-card">
        <h1 class="login-title">Welcome back</h1>
        <p class="login-subtitle">Sign in to manage your roofing calculator</p>

        <form class="login-form" onSubmit={handleSubmit}>
          <div class="field">
            <label class="field-label" htmlFor="login-email">Email</label>
            <input
              id="login-email"
              class="input"
              type="email"
              value={email}
              onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
              required
              placeholder="you@company.com"
              autocomplete="email"
            />
          </div>

          <div class="field">
            <label class="field-label" htmlFor="login-password">Password</label>
            <input
              id="login-password"
              class="input"
              type="password"
              value={password}
              onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
              required
              placeholder="Enter your password"
              autocomplete="current-password"
            />
          </div>

          {error && <div class="login-error" role="alert">{error}</div>}

          <button class="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Signing in\u2026' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
