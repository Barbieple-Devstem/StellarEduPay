import Head from 'next/head';
import { useState } from 'react';
import { useRouter } from 'next/router';
import { useAdminAuthContext } from '../hooks/AdminAuthContext';
import { getErrorMessage } from '../utils/errorMessages';
import api from '../services/api';
import { useTranslation } from 'react-i18next';

// Only honour same-origin, absolute internal paths as a post-login destination.
// Anything else (external URLs, protocol-relative "//evil.com", missing) falls
// back to the dashboard — prevents open-redirect via the returnTo query param.
function safeReturnTo(returnTo) {
  if (typeof returnTo !== 'string') return '/dashboard';
  if (!returnTo.startsWith('/') || returnTo.startsWith('//')) return '/dashboard';
  return returnTo;
}

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAdminAuthContext();
  const { t } = useTranslation();
  const [identifier, setIdentifier] = useState(''); // username or email
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [requiresMfa, setRequiresMfa] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // Determine if identifier is email or username
      const isEmail = identifier.includes('@');
      const payload = isEmail
        ? { email: identifier, password, ...(mfaCode && { mfaCode }) }
        : { username: identifier, password, ...(mfaCode && { mfaCode }) };

      const res = await api.post('/auth/login', payload);
      
      // Check if MFA is required
      if (res.data?.requiresMfa) {
        setRequiresMfa(true);
        setLoading(false);
        return;
      }

      // Only call login() when authentication is complete
      if (res.status === 200 && !res.data?.requiresMfa) {
        login();
        if (res.data?.mfaSetupRequired) {
          router.push('/mfa-setup');
        } else {
          router.push(safeReturnTo(router.query.returnTo));
        }
      }
    } catch (err) {
      if (err.response) {
        const { code, error } = err.response.data || {};
        
        // Handle specific error codes
        if (code === 'ACCOUNT_LOCKED') {
          setError(t('auth.accountLocked') || 'Too many failed login attempts. Account temporarily locked.');
        } else if (code === 'INVALID_MFA_CODE') {
          setError(t('auth.invalidMfaCode') || 'Invalid MFA code. Please try again.');
        } else if (code === 'AUTH_MISCONFIGURED') {
          setError(t('auth.serverError') || 'Server configuration error. Please contact support.');
        } else {
          setError(getErrorMessage(code, error));
        }
      } else {
        setError(t('auth.networkError'));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Head><title>{t("auth.title")} — {t("app.name")}</title></Head>
      <style>{`
        .login-page {
          min-height: calc(100vh - 60px);
          background:
            radial-gradient(700px 400px at 50% -10%, rgba(5,150,105,0.16), transparent 60%),
            radial-gradient(600px 350px at 100% 100%, rgba(6,182,212,0.12), transparent 55%),
            #f6f7fb;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem 1rem;
        }
        .login-card {
          width: 100%;
          max-width: 410px;
          background: #fff;
          border-radius: 20px;
          border: 1px solid #e7e9f3;
          box-shadow: 0 24px 60px -20px rgba(49,46,129,0.35), 0 8px 20px -12px rgba(16,24,64,0.1);
          padding: 2.75rem 2.25rem;
          text-align: center;
        }
        .login-icon {
          width: 56px; height: 56px;
          background: linear-gradient(135deg, #059669 0%, #0d9488 100%);
          border-radius: 16px;
          display: flex; align-items: center; justify-content: center;
          font-size: 1.4rem;
          margin: 0 auto 1.5rem;
          box-shadow: 0 12px 28px -8px rgba(5,150,105,0.6);
        }
        .login-card h1 {
          font-size: 1.5rem !important;
          font-weight: 800 !important;
          color: #0f172a !important;
          letter-spacing: -0.03em;
          margin-bottom: 0.375rem !important;
        }
        .login-sub {
          font-size: 0.875rem;
          color: #64748b;
          margin-bottom: 2rem;
        }
        .login-field { margin-bottom: 1rem; text-align: left; }
        form { text-align: left; }
        .login-label {
          display: block;
          font-size: 0.8rem;
          font-weight: 600;
          color: #374151;
          margin-bottom: 0.375rem;
          letter-spacing: 0.01em;
        }
        .login-input {
          width: 100%;
          padding: 0.65rem 0.875rem;
          border: 1.5px solid #e2e8f0;
          border-radius: 8px;
          font-size: 0.95rem;
          color: #0f172a;
          background: #f8fafc;
          transition: border-color 0.15s, box-shadow 0.15s;
          outline: none;
          font-family: inherit;
        }
        .login-input:focus {
          border-color: #059669;
          box-shadow: 0 0 0 4px rgba(5,150,105,0.18);
          background: #fff;
        }
        .login-error {
          display: flex; align-items: center; gap: 0.5rem;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 8px;
          color: #dc2626;
          font-size: 0.85rem;
          padding: 0.65rem 0.875rem;
          margin-bottom: 1rem;
        }
        .login-btn {
          width: 100%;
          background: linear-gradient(135deg, #059669 0%, #0d9488 100%);
          color: #fff;
          border: none;
          border-radius: 10px;
          font: 700 0.95rem/1 inherit;
          padding: 0.85rem;
          cursor: pointer;
          transition: filter 0.15s, transform 0.1s, box-shadow 0.15s;
          margin-top: 0.5rem;
          letter-spacing: -0.01em;
          box-shadow: 0 10px 24px -8px rgba(5,150,105,0.6);
        }
        .login-btn:hover:not(:disabled) { filter: brightness(1.08); transform: translateY(-1px); }
        .login-btn:active:not(:disabled) { transform: scale(0.99); }
        .login-btn:disabled { opacity: 0.55; cursor: not-allowed; }
        .login-btn-inner { display: flex; align-items: center; justify-content: center; gap: 0.5rem; }
        .login-spinner {
          width: 1em; height: 1em;
          border: 2px solid rgba(255,255,255,0.4);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          flex-shrink: 0;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .login-input:disabled { opacity: 0.6; cursor: not-allowed; }
        .login-footer {
          text-align: center;
          margin-top: 1.5rem;
          font-size: 0.78rem;
          color: #94a3b8;
        }
        .mfa-info {
          font-size: 0.85rem;
          color: #0369a1;
          background: #e0f2fe;
          border: 1px solid #bae6fd;
          border-radius: 8px;
          padding: 0.65rem 0.875rem;
          margin-bottom: 1rem;
        }
        /* dark mode */
        html.dark .login-page { background: #0f172a; }
        html.dark .login-card { background: #1e293b; box-shadow: 0 4px 24px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.06); }
        html.dark .login-card h1 { color: #f1f5f9 !important; }
        html.dark .login-sub { color: #64748b; }
        html.dark .login-label { color: #94a3b8; }
        html.dark .login-page {
          background:
            radial-gradient(700px 400px at 50% -10%, rgba(5,150,105,0.2), transparent 60%),
            radial-gradient(600px 350px at 100% 100%, rgba(6,182,212,0.14), transparent 55%),
            #0a0e1f;
        }
        html.dark .login-input { background: #0a0e1f; border-color: #25304d; color: #f1f5f9; }
        html.dark .login-input:focus { border-color: #34d399; background: #0a0e1f; box-shadow: 0 0 0 4px rgba(52,211,153,0.22); }
        html.dark .mfa-info { color: #7dd3fc; background: #0c4a6e; border-color: #075985; }
      `}</style>

      <div className="login-page">
        <div className="login-card">
          <div className="login-icon">🔐</div>
          <h1>{t("auth.title")}</h1>
          <p className="login-sub">{requiresMfa ? t("auth.mfaSubtitle") || "Enter your MFA code" : t("auth.subtitle")}</p>

          <form onSubmit={handleSubmit}>
            {!requiresMfa ? (
              <>
                <div className="login-field">
                  <label className="login-label" htmlFor="identifier">{t("auth.emailOrUsername") || "Email or Username"}</label>
                  <input
                    id="identifier"
                    className="login-input"
                    type="text"
                    value={identifier}
                    onChange={e => setIdentifier(e.target.value)}
                    required
                    autoComplete="username"
                    autoFocus
                    placeholder={t("auth.identifierPlaceholder") || "admin@school.com or admin"}
                    disabled={loading}
                  />
                </div>

                <div className="login-field">
                  <label className="login-label" htmlFor="password">{t("auth.password")}</label>
                  <input
                    id="password"
                    className="login-input"
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    placeholder={t("auth.passwordPlaceholder")}
                    disabled={loading}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="mfa-info">
                  {t("auth.mfaRequired") || "Multi-factor authentication is enabled. Please enter your 6-digit code or backup code."}
                </div>
                <div className="login-field">
                  <label className="login-label" htmlFor="mfaCode">{t("auth.mfaCode") || "MFA Code"}</label>
                  <input
                    id="mfaCode"
                    className="login-input"
                    type="text"
                    value={mfaCode}
                    onChange={e => setMfaCode(e.target.value)}
                    required
                    autoComplete="one-time-code"
                    autoFocus
                    placeholder={t("auth.mfaPlaceholder") || "000000"}
                    disabled={loading}
                    maxLength={12}
                  />
                </div>
              </>
            )}

            {error && (
              <div className="login-error" role="alert">
                <span>⚠</span> {error}
              </div>
            )}

            <button className="login-btn" type="submit" disabled={loading} aria-busy={loading}>
              <span className="login-btn-inner">
                {loading && <span className="login-spinner" aria-hidden="true" />}
                {loading ? t("auth.signingIn") : t("auth.signIn")}
              </span>
            </button>

            {requiresMfa && (
              <button
                type="button"
                className="login-btn"
                style={{ marginTop: '0.5rem', background: '#6b7280' }}
                onClick={() => {
                  setRequiresMfa(false);
                  setMfaCode('');
                  setError('');
                }}
                disabled={loading}
              >
                {t("auth.back") || "Back"}
              </button>
            )}
          </form>

          <p className="login-footer">{t("auth.footer")}</p>
        </div>
      </div>
    </>
  );
}
