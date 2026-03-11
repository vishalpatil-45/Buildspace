import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { authApi } from '@/api/client';
import { useAuthStore } from '@/store/authStore';

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await authApi.login({ email, password });
      setAuth(res.data.user, res.data.accessToken);
      toast.success(`Welcome back, ${res.data.user.name}!`);
      navigate('/');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-md">
      {/* Code background pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-5 font-code text-primary text-[11px] leading-5 select-none">
        {Array.from({ length: 40 }).map((_, i) => (
          <div key={i} className="whitespace-nowrap">
            {`${String(i + 1).padStart(3, ' ')} │ `}
            {i % 5 === 0 ? `const ${['editor', 'session', 'doc', 'provider', 'socket'][Math.floor(i / 5) % 5]} = new ${['Y.Doc', 'WebSocket', 'Editor', 'Provider', 'Session'][Math.floor(i / 5) % 5]}();` : ''}
            {i % 5 === 1 ? `await ${['connect', 'sync', 'init', 'setup', 'run'][Math.floor(i / 5) % 5]}({ projectId, fileId });` : ''}
            {i % 5 === 2 ? `// Real-time collaboration enabled` : ''}
            {i % 5 === 3 ? `export { useYjs, useRunWs, useAutosave };` : ''}
            {i % 5 === 4 ? '' : ''}
          </div>
        ))}
      </div>

      <div className="w-full max-w-sm relative z-10">
        {/* Logo */}
        <div className="flex items-center justify-center gap-sm mb-lg">
          <span className="material-symbols-outlined text-primary text-[36px]" style={{ fontVariationSettings: "'FILL' 1" }}>terminal</span>
          <span className="font-headline text-[28px] font-black text-on-surface tracking-tight">Nexus Code</span>
        </div>

        <div className="bg-surface-container border border-outline-variant p-lg">
          {/* Header */}
          <div className="mb-lg">
            <h1 className="text-headline-lg text-on-surface">Sign in</h1>
            <p className="text-on-surface-variant text-[13px] mt-xs">
              Continue to your collaborative workspace
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-md">
            <div>
              <label className="label-caps text-on-surface-variant mb-xs block">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field w-full"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="label-caps text-on-surface-variant mb-xs block">Password</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field w-full"
                placeholder="Enter password"
              />
            </div>

            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="btn-primary w-full h-8 justify-center mt-sm"
            >
              {loading ? (
                <><span className="material-symbols-outlined text-[14px] animate-spin">refresh</span>Signing in…</>
              ) : (
                <><span className="material-symbols-outlined text-[14px]">login</span>Sign In</>
              )}
            </button>
          </form>

          <div className="mt-md pt-md border-t border-outline-variant text-center">
            <span className="text-on-surface-variant text-[13px]">
              Don't have an account?{' '}
              <Link to="/register" className="text-primary hover:underline font-semibold transition-colors">
                Register
              </Link>
            </span>
          </div>
        </div>

        <p className="text-center font-code text-[11px] text-outline mt-md">
          // Real-time collaborative IDE
        </p>
      </div>
    </div>
  );
}
