'use client';

import { useState, type FormEvent } from 'react';
import { useEffect } from 'react';

export default function JoinLeaguePage(){
  const [inviteCode,setInviteCode]=useState('');const [entryName,setEntryName]=useState('');
  const [saving,setSaving]=useState(false);const [message,setMessage]=useState('');const [joined,setJoined]=useState(false);
  const [needsSignIn,setNeedsSignIn]=useState(false);
  useEffect(()=>{const code=new URLSearchParams(window.location.search).get('code');if(code)setInviteCode(code.toUpperCase());},[]);
  async function join(event?:FormEvent<HTMLFormElement>){
    event?.preventDefault();
    setSaving(true);setMessage('');
    try{const response=await fetch('/api/leagues/join',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({inviteCode,entryName})});const result=await response.json();if(!response.ok){if(response.status===401)setNeedsSignIn(true);throw new Error(response.status===401?'Sign in or create an account to join this league.':result.error||'Could not join league.');}setJoined(true);setMessage(`You joined ${result.pool.name}.`);}
    catch(reason){setMessage(reason instanceof Error?reason.message:'Could not join league.');}finally{setSaving(false);}
  }
  const next=`/join?code=${encodeURIComponent(inviteCode)}`;
  return <main className="shell"><section className="stack"><div className="sectionHeader"><div><span className="eyebrow">MEMBER INVITATION</span><h1>Join a league</h1></div><a className="authLink" href="/">Back</a></div><div className="onboardingSteps"><span className="stepActive">1. Invite</span><span>2. Account</span><span>3. Play</span></div><form className="wideCard leagueForm" onSubmit={join}><label className="fieldLabel">Invite code<input className="textInput" value={inviteCode} onChange={e=>setInviteCode(e.target.value.toUpperCase())} placeholder="Enter invite code" required/></label><label className="fieldLabel">Your entry name<input className="textInput" value={entryName} onChange={e=>setEntryName(e.target.value)} placeholder="Example: Rouge91" required/></label>{message&&<div className={joined?'notice':'warning'}>{message}</div>}{needsSignIn&&!joined&&<div className="joinAuthActions"><a className="primary" href={`/auth/login?next=${encodeURIComponent(next)}`}>Sign In to Join</a><a className="secondary" href={`/auth/sign-up?next=${encodeURIComponent(next)}`}>Create Account</a></div>}{joined?<a className="primary" href="/">Open My Leagues</a>:!needsSignIn&&<button className="primary" type="submit" disabled={saving}>{saving?'Joining…':'Join League'}</button>}</form></section></main>;
}
