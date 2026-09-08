'use client';
import { useState } from 'react';

export default function BetaPage(){
  const [message,setMessage]=useState('');
  const [code,setCode]=useState('');
  const [busy,setBusy]=useState(false);
  async function setup(){setBusy(true);setMessage('');const r=await fetch('/api/beta/setup',{method:'POST'});const j=await r.json();setMessage(r.ok?j.message:(j.error||'Setup failed'));setBusy(false);}
  async function commissioner(){setBusy(true);setMessage('');const r=await fetch('/api/beta/commissioner',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code})});const j=await r.json();setMessage(r.ok?'Commissioner access enabled for this account.':(j.error||'Could not enable commissioner access'));setBusy(false);}
  return <main className="authShell"><section className="authCard"><div className="brand">DEGENS</div><span className="eyebrow">BETA LAUNCHPAD</span><h1>Set up your test account</h1><p>Create one sample entry in Survivor, Pick’em and NFL Playoff Fantasy. The free Pick’em entry is activated immediately; paid contests begin unpaid so you can test the payment workflow.</p><button className="primary" disabled={busy} onClick={setup}>Create My Beta Entries</button><hr/><h2>Commissioner testing</h2><p>Enter the private beta commissioner code configured on the server. This promotes only your signed-in account.</p><input className="textInput" type="password" placeholder="Commissioner code" value={code} onChange={e=>setCode(e.target.value)}/><button className="secondary" disabled={busy||!code} onClick={commissioner}>Enable Commissioner Access</button>{message&&<div className="notice">{message}</div>}<a href="/">Return to dashboard</a></section></main>;
}
