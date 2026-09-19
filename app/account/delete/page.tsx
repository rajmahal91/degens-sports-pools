'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function DeleteAccountPage(){
  const [confirmation,setConfirmation]=useState('');const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
  async function deleteAccount(){
    setBusy(true);setMessage('');
    try{
      const response=await fetch('/api/account/delete',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({confirmation})});
      const body=await response.json();if(!response.ok)throw new Error(body.error||'Could not delete the account.');
      await createClient().auth.signOut({scope:'local'});window.location.replace('/auth/login?deleted=1');
    }catch(error){setMessage(error instanceof Error?error.message:'Could not delete the account.');setBusy(false);}
  }
  return <main className="authShell"><section className="authCard accountCard"><a className="backLink" href="/account">← Back to Account</a><span className="eyebrow">PERMANENT ACTION</span><h1>Delete your account</h1><p>This permanently removes your sign-in, profile, entries, picks, memberships, notification subscriptions, and associated account data. Records that must be retained for security, legal, payment-verification, or prize-draw integrity are anonymized.</p><div className="warning">If you own a league, you must delete or transfer it first so other members do not lose access unexpectedly.</div><label>Type <strong>DELETE</strong> to confirm<input className="textInput" value={confirmation} autoCapitalize="characters" autoCorrect="off" onChange={event=>setConfirmation(event.target.value)}/></label>{message&&<div className="warning">{message}</div>}<button className="dangerButton" type="button" disabled={busy||confirmation!=='DELETE'} onClick={deleteAccount}>{busy?'Deleting…':'Permanently Delete Account'}</button></section></main>;
}
