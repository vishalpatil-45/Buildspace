import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { authApi } from '@/api/client';
import { useAuthStore } from '@/store/authStore';

export default function RegisterPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.register({ name, email, password });
      setAuth(res.data.user, res.data.accessToken);
      toast.success('Account created! Welcome to Nexus Code.');
      navigate('/');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-md">
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-5 font-code text-primary text-[11px] leading-5 select-none">
        {Array.from({ length: 40 }).map((_, i) => (
          <div key={i} className="whitespace-nowrap">
            {`${String(i + 1).padStart(3, ' ')} │ `}
            {i % 4 === 0 ? `import { useYjs, useRunWs } from '@collabide/hooks';` : ''}
            {i % 4 === 1 ? `const { run, sendInput } = useRunWs({ projectId });` : ''}
            {i % 4 === 2 ? `// Multiple users, one shared document` : ''}
            {i % 4 === 3 ? '' : ''}
          </div>
        ))}
      </div>

      <div className="w-full max-w-sm relative z-10">
        <div className="flex items-center justify-center gap-sm mb-lg">
          <span className="material-symbols-outlined text-primary text-[36px]" style={{ fontVariationSettings: "'FILL' 1" }}>terminal</span>
          <span className="font-headline text-[28px] font-black text-on-surface tracking-tight">Nexus Code</span>
        </div>

        <div className="bg-surface-container border border-outline-variant p-lg">
          <div className="mb-lg">
            <h1 className="text-headline-lg text-on-surface">Create account</h1>
            <p className="text-on-surface-variant text-[13px] mt-xs">
              Start collaborating in seconds
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-md">
            <div>
              <label className="label-caps text-on-surface-variant mb-xs block">Name</label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-field w-full"
                placeholder="Your full name"
              />
            </div>

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
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field w-full"
                placeholder="Min. 8 characters"
              />
            </div>

            <button
              id="register-submit"
              type="submit"
              disabled={loading}
              className="btn-primary w-full h-8 justify-center mt-sm"
            >
              {loading ? (
                <><span className="material-symbols-outlined text-[14px] animate-spin">refresh</span>Creating account…</>
              ) : (
                <><span className="material-symbols-outlined text-[14px]">person_add</span>Create Account</>
              )}
            </button>
          </form>

          <div className="mt-md pt-md border-t border-outline-variant text-center">
            <span className="text-on-surface-variant text-[13px]">
              Already have an account?{' '}
              <Link to="/login" className="text-primary hover:underline font-semibold transition-colors">
                Sign in
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
