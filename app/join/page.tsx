'use client';

import { useState, type FormEvent } from 'react';

export default function JoinLeaguePage(){
  const [inviteCode,setInviteCode]=useState('');const [entryName,setEntryName]=useState('');
  const [saving,setSaving]=useState(false);const [message,setMessage]=useState('');const [joined,setJoined]=useState(false);
  async function join(event?:FormEvent<HTMLFormElement>){
    event?.preventDefault();
    setSaving(true);setMessage('');
    try{const response=await fetch('/api/leagues/join',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({inviteCode,entryName})});const result=await response.json();if(!response.ok)throw new Error(result.error||'Could not join league.');setJoined(true);setMessage(`You joined ${result.pool.name}.`);}
    catch(reason){setMessage(reason instanceof Error?reason.message:'Could not join league.');}finally{setSaving(false);}
  }
  return <main className="shell"><section className="stack"><div className="sectionHeader"><div><span className="eyebrow">MEMBER INVITATION</span><h1>Join a league</h1></div><a className="authLink" href="/">Back</a></div><form className="wideCard leagueForm" onSubmit={join}><label className="fieldLabel">Invite code<input className="textInput" value={inviteCode} onChange={e=>setInviteCode(e.target.value.toUpperCase())} placeholder="Enter invite code" required/></label><label className="fieldLabel">Your entry name<input className="textInput" value={entryName} onChange={e=>setEntryName(e.target.value)} placeholder="Example: Rouge91" required/></label>{message&&<div className={joined?'notice':'warning'}>{message}</div>}{joined?<a className="primary" href="/">Open My Leagues</a>:<button className="primary" type="submit" disabled={saving}>{saving?'Joining…':'Join League'}</button>}</form></section></main>;
}
