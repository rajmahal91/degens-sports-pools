'use client';

import { useState, type FormEvent } from 'react';

export default function NewLeaguePage(){
  const [form,setForm]=useState({organizationName:'',name:'',sport:'NFL',poolType:'SURVIVOR',season:'2026',entryFee:'0',maxEntries:'1',maxParticipants:'1000',deadlineMode:'GAME_KICKOFF',strictMissedPicks:true});
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const [created,setCreated]=useState<{name:string;inviteCode:string}|null>(null);
  const update=(key:string,value:string|boolean)=>setForm(current=>({...current,[key]:value}));
  async function createLeague(event?:FormEvent<HTMLFormElement>){
    event?.preventDefault();
    if(!form.name.trim()){setError('Enter a league name.');return;}
    setSaving(true);setError('');
    try{
      const response=await fetch('/api/leagues/create',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(form)});
      const result=await response.json();
      if(!response.ok) throw new Error(result.error||'Could not create league.');
      setCreated({name:result.pool.name,inviteCode:result.inviteCode});
    }catch(reason){setError(reason instanceof Error?reason.message:'Could not create league.');}
    finally{setSaving(false);}
  }
  return <main className="shell"><section className="stack">
    <div className="sectionHeader"><div><span className="eyebrow">COMMISSIONER SETUP</span><h1>Create a league</h1></div><a className="authLink" href="/">Back</a></div>
    {created?<div className="wideCard leagueForm"><span>League created</span><h2>{created.name}</h2><p>Share this invite code with members:</p><div className="paymentTotal"><span>Invite code</span><strong>{created.inviteCode}</strong></div><a className="primary" href="/">Open Dashboard</a></div>:<form className="wideCard leagueForm" onSubmit={createLeague}>
      <label className="fieldLabel">Organization name<input className="textInput" value={form.organizationName} onChange={e=>update('organizationName',e.target.value)} placeholder="Example: Raj’s Sports Pools"/></label>
      <label className="fieldLabel">League name<input className="textInput" value={form.name} onChange={e=>update('name',e.target.value)} placeholder="Example: NFL Survivor 2026" required/></label>
      <label className="fieldLabel">Sport<select className="textInput" value={form.sport} onChange={e=>update('sport',e.target.value)}><option>NFL</option><option>NHL</option><option>NBA</option></select></label>
      <label className="fieldLabel">Pool format<select className="textInput" value={form.poolType} onChange={e=>update('poolType',e.target.value)}><option value="SURVIVOR">Survivor</option><option value="PICKEM">Pick’em</option><option value="BRACKET">Bracket</option><option value="PLAYOFF_FANTASY">Playoff Fantasy</option></select></label>
      <label className="fieldLabel">Season<input className="textInput" type="number" min="2020" max="2100" value={form.season} onChange={e=>update('season',e.target.value)} required/></label>
      <label className="fieldLabel">Entry fee (CAD)<input className="textInput" type="number" min="0" step="1" value={form.entryFee} onChange={e=>update('entryFee',e.target.value)} required/></label>
      <label className="fieldLabel">Maximum entries per member<input className="textInput" type="number" min="1" max="100" value={form.maxEntries} onChange={e=>update('maxEntries',e.target.value)} required/></label>
      <label className="fieldLabel">Maximum participants<input className="textInput" type="number" min="1" max="1000" value={form.maxParticipants} onChange={e=>update('maxParticipants',e.target.value)} required/></label>
      <label className="fieldLabel">Pick deadline<select className="textInput" value={form.deadlineMode} onChange={e=>update('deadlineMode',e.target.value)}><option value="GAME_KICKOFF">Each game’s kickoff</option><option value="SUNDAY_10AM_PT">Sunday at 10:00 AM PT</option></select></label>
      <label className="method"><input type="checkbox" checked={form.strictMissedPicks} onChange={e=>update('strictMissedPicks',e.target.checked)}/><b>Eliminate Survivor entries that miss the deadline</b></label>
      {error&&<div className="warning">{error}</div>}<button className="primary" type="submit" disabled={saving}>{saving?'Creating…':'Create League'}</button>
    </form>}
  </section></main>;
}
