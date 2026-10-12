'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Lock, User, AlertCircle, Loader2, Layers } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';

function LoginFormContent() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, login, loading: authLoading } = useAuth();

  useEffect(() => {
    // If account was disabled
    if (searchParams.get('error') === 'disabled') {
      setErrorMessage('Your account has been disabled. Please contact an administrator.');
    }
  }, [searchParams]);

  useEffect(() => {
    // If already authenticated as admin, redirect to /admin
    if (!authLoading && user) {
      router.push('/admin');
    }
  }, [user, authLoading, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password || loading) return;

    setLoading(true);
    setErrorMessage('');

    try {
      await login(username.trim(), password);
      router.push('/admin');
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Invalid username or password.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = username.trim().length > 0 && password.length > 0;

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F8FAFC',
        backgroundImage: 'radial-gradient(at 50% 40%, rgba(99, 102, 241, 0.05) 0px, transparent 60%)',
        padding: '24px 16px'
      }}
    >
      <div
        id="login-card"
        style={{
          width: '100%',
          maxWidth: 420,
          background: '#FFFFFF',
          borderRadius: 16,
          border: '1px solid #E2E8F0',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)',
          padding: '36px 32px',
          boxSizing: 'border-box'
        }}
      >
        {/* Header: App Logo + Title */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #4F46E5 0%, #059669 100%)',
              boxShadow: '0 8px 16px rgba(79, 70, 229, 0.25)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16
            }}
          >
            <Layers size={28} color="#FFFFFF" />
          </div>

          <h1
            id="login-title"
            style={{
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: '-0.3px',
              color: '#0F172A',
              marginBottom: 6
            }}
          >
            Admin Sign-In
          </h1>

          <p
            id="login-subtitle"
            style={{
              fontSize: 13,
              color: '#64748B',
              lineHeight: 1.5,
              margin: 0
            }}
          >
            Sign in with administrator credentials to manage the platform.
          </p>
        </div>

        {/* Inline Error Message */}
        {errorMessage && (
          <div
            id="login-error-alert"
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: '12px 14px',
              backgroundColor: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: 10,
              color: '#B91C1C',
              fontSize: 13,
              lineHeight: 1.4,
              marginBottom: 20
            }}
          >
            <AlertCircle size={17} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit}>
          {/* Username / Client ID Field */}
          <div style={{ marginBottom: 18 }}>
            <label
              htmlFor="username-input"
              style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 600,
                color: '#334155',
                marginBottom: 6
              }}
            >
              Administrator Username
            </label>
            <div style={{ position: 'relative' }}>
              <div
                style={{
                  position: 'absolute',
                  left: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#94A3B8',
                  pointerEvents: 'none',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <User size={16} />
              </div>
              <input
                id="username-input"
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (errorMessage) setErrorMessage('');
                }}
                placeholder="e.g. admin"
                autoComplete="username"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '10px 14px 10px 38px',
                  borderRadius: 10,
                  border: '1px solid #CBD5E1',
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box',
                  color: '#0F172A',
                  transition: 'border-color 0.15s ease, box-shadow 0.15s ease'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#4F46E5';
                  e.target.style.boxShadow = '0 0 0 3px rgba(79, 70, 229, 0.15)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#CBD5E1';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>
          </div>

          {/* Password Field */}
          <div style={{ marginBottom: 24 }}>
            <label
              htmlFor="password-input"
              style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 600,
                color: '#334155',
                marginBottom: 6
              }}
            >
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <div
                style={{
                  position: 'absolute',
                  left: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#94A3B8',
                  pointerEvents: 'none',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <Lock size={16} />
              </div>
              <input
                id="password-input"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errorMessage) setErrorMessage('');
                }}
                placeholder="••••••••••••"
                autoComplete="current-password"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '10px 42px 10px 38px',
                  borderRadius: 10,
                  border: '1px solid #CBD5E1',
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box',
                  color: '#0F172A',
                  transition: 'border-color 0.15s ease, box-shadow 0.15s ease'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#4F46E5';
                  e.target.style.boxShadow = '0 0 0 3px rgba(79, 70, 229, 0.15)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#CBD5E1';
                  e.target.style.boxShadow = 'none';
                }}
              />
              <button
                type="button"
                id="toggle-password-btn"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                style={{
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#94A3B8',
                  padding: 2,
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'color 0.15s ease'
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Sign In Submit Button */}
          <button
            id="btn-sign-in"
            type="submit"
            disabled={!isFormValid || loading}
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: 10,
              border: 'none',
              background: isFormValid && !loading
                ? 'linear-gradient(135deg, #4F46E5 0%, #4338CA 100%)'
                : '#E2E8F0',
              color: isFormValid && !loading ? '#FFFFFF' : '#94A3B8',
              fontSize: 14,
              fontWeight: 700,
              cursor: isFormValid && !loading ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: isFormValid && !loading
                ? '0 4px 12px rgba(79, 70, 229, 0.25)'
                : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="spin-fast" />
                <span>Signing in...</span>
              </>
            ) : (
              <span>Sign in</span>
            )}
          </button>
        </form>

        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <span style={{ fontSize: 12, color: '#94A3B8' }}>
            Administrator access only. Merchants access the app directly via Shopify Admin.
          </span>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#F8FAFC'
          }}
        >
          <div style={{ width: 420, height: 480, background: '#FFFFFF', borderRadius: 16 }} />
        </div>
      }
    >
      <LoginFormContent />
    </Suspense>
  );
}
