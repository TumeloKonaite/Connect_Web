import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'

export function LoginPage({ onSuccess }: { onSuccess: () => void }) {
  const { login, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('')
    if (!email.trim() || !password) { setError('Enter your email address and password.'); return }
    try { await login(email.trim(), password); onSuccess() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Login failed. Please try again.') }
  }
  return <section className="login-wrap"><form className="login-card" onSubmit={submit}>
    <p className="eyebrow">FACTORY MONITORING <span className="eyebrow-line" /></p><h1>Welcome back</h1>
    <p className="intro login-intro">Sign in to access your production data.</p>
    <label className="login-field" htmlFor="email">Email address<input id="email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
    <label className="login-field" htmlFor="password">Password<input id="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
    {error && <p className="login-error" role="alert">{error}</p>}
    <button className="primary-button" disabled={loading}>{loading ? <><span className="button-spinner" /> Signing in…</> : 'Sign in'}</button>
  </form></section>
}
