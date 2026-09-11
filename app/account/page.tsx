"use client";

import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AccountPage() {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState("Loading your account…");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/account")
      .then(async (response) => {
        if (response.status === 401) {
          window.location.replace("/auth/login?next=/account");
          return null;
        }
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Could not load your account.");
        return body;
      })
      .then((body) => {
        if (!body) return;
        setEmail(body.email || "");
        setDisplayName(body.profile?.display_name || "");
        setUsername(body.profile?.username || "");
        setMessage("");
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "Could not load your account."));
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, username }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not save your account.");
      setUsername(body.profile.username);
      setDisplayName(body.profile.display_name);
      setMessage("Account updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save your account.");
    } finally {
      setSaving(false);
    }
  }

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.replace("/auth/login");
  }

  return (
    <main className="authShell">
      <form className="authCard accountCard" onSubmit={save}>
        <a className="backLink" href="/">← Back to Degens</a>
        <span className="eyebrow">SIGNED IN ACCOUNT</span>
        <div className="accountSummary">
          <div className="accountAvatar">{(username || displayName || email || "?").charAt(0).toUpperCase()}</div>
          <div><strong>{username ? `@${username}` : displayName || "Your account"}</strong><span>{email}</span></div>
        </div>
        <label>
          Display name
          <input className="textInput" value={displayName} maxLength={40} onChange={(event) => setDisplayName(event.target.value)} required />
          <small className="fieldHint">Shown to people in your leagues.</small>
        </label>
        <label>
          Username
          <div className="usernameInput">
            <span>@</span>
            <input className="textInput" value={username} minLength={3} maxLength={24} autoCapitalize="none" autoCorrect="off" spellCheck={false} onChange={(event) => setUsername(event.target.value.toLowerCase().replace(/\s/g, ""))} required />
          </div>
          <small className="fieldHint">3–24 letters, numbers, dots, dashes, or underscores.</small>
        </label>
        {message && <div className="notice">{message}</div>}
        <button className="primary" type="submit" disabled={saving}>{saving ? "Saving…" : "Save Account"}</button>
        <button className="dangerButton" type="button" onClick={signOut}>Sign Out</button>
      </form>
    </main>
  );
}
