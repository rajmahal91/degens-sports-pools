"use client";
import { useState, type FormEvent } from "react";

export default function BetaPage() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");

  async function activateCommissioner(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/beta/commissioner", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const result = await response.json();
    if (response.ok) {
      setMessage("Commissioner access activated. Returning to your dashboard…");
      window.setTimeout(() => window.location.replace("/"), 700);
    } else {
      setMessage(result.error || "Could not activate commissioner access.");
      setBusy(false);
    }
  }

  return (
    <main className="authShell">
      <section className="authCard">
        <div className="brand">DEGENS</div>
        <span className="eyebrow">COMMISSIONER SETUP</span>
        <h1>Activate commissioner access</h1>
        <p>
          Enter the commissioner code provided by the platform owner. Player
          accounts cannot host live draws or create and manage leagues.
        </p>
        <form onSubmit={activateCommissioner} className="stack">
          <label className="fieldLabel">
            Commissioner code
            <input
              className="textInput"
              type="password"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              autoComplete="off"
              required
            />
          </label>
          <button className="primary" disabled={busy || !code.trim()}>
            {busy ? "Activating…" : "Activate Commissioner"}
          </button>
        </form>
        {message && <div className="notice">{message}</div>}
        <a href="/">Return to dashboard</a>
      </section>
    </main>
  );
}
