"use client";
import { useState } from "react";

export default function BetaPage() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function activateCommissioner() {
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/beta/commissioner", {
      method: "POST",
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
        <span className="eyebrow">RUN YOUR OWN LEAGUE</span>
        <h1>Become a commissioner</h1>
        <p>
          Any signed-in member can enable Commissioner Mode. You&apos;ll be able
          to create and manage your own leagues, invite players, run standings,
          create prize draws, and host live events.
        </p>
        <div className="notice">
          Your player access stays active, so you can still join and play in
          leagues run by other commissioners.
        </div>
        <button
          className="primary"
          type="button"
          disabled={busy}
          onClick={activateCommissioner}
        >
          {busy ? "Enabling…" : "Enable Commissioner Mode"}
        </button>
        {message && <div className="notice">{message}</div>}
        <a href="/">Return to dashboard</a>
      </section>
    </main>
  );
}
