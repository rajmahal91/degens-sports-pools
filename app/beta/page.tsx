'use client';
import { useState } from 'react';

export default function BetaPage(){
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  async function setup(){setBusy(true);setMessage('');const r=await fetch('/api/beta/setup',{method:'POST'});const j=await r.json();setMessage(r.ok?j.message:(j.error||'Setup failed'));setBusy(false);}
  return <main className="authShell"><section className="authCard"><div className="brand">DEGENS</div><span className="eyebrow">BETA LAUNCHPAD</span><h1>Set up your test account</h1><p>Create one sample entry in Survivor, Pick’em and NFL Playoff Fantasy. The free Pick’em entry is activated immediately; paid contests begin unpaid so you can test the payment workflow.</p><button className="primary" disabled={busy} onClick={setup}>{busy?'Creating entries…':'Create My Beta Entries'}</button><hr/><h2>Commissioner access</h2><p>Your commissioner role is managed securely and is already active for this account.</p>{message&&<div className="notice">{message}</div>}<a href="/">Return to dashboard</a></section></main>;
}
