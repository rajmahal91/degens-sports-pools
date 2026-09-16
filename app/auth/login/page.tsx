'use client';

import { FormEvent, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [next, setNext] = useState('/');
  const [sessionExpired, setSessionExpired] = useState(false);
  const [signInRequired, setSignInRequired] = useState(false);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get('next') || '/';
    setNext(requested.startsWith('/') && !requested.startsWith('//') ? requested : '/');
    setSessionExpired(params.get('reason') === 'session');
    setSignInRequired(params.get('reason') === 'required');
    setConfirmation(params.get('confirmation'));
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage('');

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!data.session) throw new Error('Sign-in did not create a session. Please try again.');

      const { data: verified, error: verifyError } = await supabase.auth.getUser();
      if (verifyError || !verified.user) {
        throw verifyError || new Error('Could not verify your session.');
      }

      window.location.replace(next);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Login failed');
    }
  }

  return (
    <main className="authShell">
      <form className="authCard" onSubmit={submit}>
        <div className="brand">SPORTS SYNDICATE</div>
        <span className="eyebrow">FANTASY</span>
        <h1>Sign in</h1>

        {sessionExpired && (
          <div className="notice">Your session expired in this app. Sign in again to continue.</div>
        )}
        {signInRequired && !sessionExpired && (
          <div className="notice">Sign in to continue to that page.</div>
        )}
        {confirmation === 'verified' && (
          <div className="notice">Your email has been confirmed. Please sign in to continue.</div>
        )}
        {confirmation === 'failed' && (
          <div className="notice">
            This confirmation link is invalid or expired. Try signing in, or request a new confirmation email.
          </div>
        )}

        <label>
          Email
          <input
            className="textInput"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label>
          Password
          <input
            className="textInput"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>

        {message && <div className="notice">{message}</div>}
        <button className="primary" type="submit">Sign In</button>
        <a href="/auth/sign-up">Create an account</a>
      </form>
    </main>
  );
}
