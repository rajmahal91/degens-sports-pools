"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const usernamePattern = /^[a-z0-9][a-z0-9._-]{2,23}$/;

export default function SignUpPage() {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    const normalizedUsername = username.trim().toLowerCase();
    if (!usernamePattern.test(normalizedUsername)) {
      setMessage("Username must be 3–24 letters, numbers, dots, dashes, or underscores.");
      return;
    }

    setSubmitting(true);
    try {
      const check = await fetch("/api/auth/username-available", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: normalizedUsername }),
      });
      const availability = await check.json();
      if (!check.ok) throw new Error(availability.error || "Could not check username.");
      if (!availability.available) throw new Error("That username is already taken.");

      const supabase = createClient();
      const emailRedirectTo = `${window.location.origin}/auth/callback`;
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: name.trim(), username: normalizedUsername },
          emailRedirectTo,
        },
      });
      if (error) throw error;
      setMessage("Account created. Check your email to confirm it, then sign in.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sign-up failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="authShell">
      <form className="authCard" onSubmit={submit}>
        <div className="brand">DEGENS</div>
        <span className="eyebrow">SPORTS POOLS</span>
        <h1>Create account</h1>
        <label>
          Display name
          <input className="textInput" value={name} maxLength={40} onChange={(event) => setName(event.target.value)} required />
          <small className="fieldHint">The name other league members will see.</small>
        </label>
        <label>
          Username
          <div className="usernameInput">
            <span>@</span>
            <input className="textInput" value={username} minLength={3} maxLength={24} autoCapitalize="none" autoCorrect="off" spellCheck={false} onChange={(event) => setUsername(event.target.value.toLowerCase().replace(/\s/g, ""))} required />
          </div>
          <small className="fieldHint">Your unique account name. You can change it later.</small>
        </label>
        <label>
          Email
          <input className="textInput" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label>
          Password
          <input className="textInput" type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required />
        </label>
        {message && <div className="notice">{message}</div>}
        <button className="primary" type="submit" disabled={submitting}>{submitting ? "Creating Account…" : "Create Account"}</button>
        <a href="/auth/login">Already have an account?</a>
      </form>
    </main>
  );
}
