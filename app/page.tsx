'use client';

import { useEffect, useMemo, useState } from 'react';
import { demoPayments, entries as seedEntries, leaderboard, pools as seedPools, week1Games as seedWeek1Games } from '@/lib/mock';
import type { Entry, FantasySlot, PaymentMethod, PaymentRecord, PickemSelection, Pool, SurvivorPick, UserRole } from '@/lib/types';

const fantasySlots: FantasySlot[] = [
  { position: 'QB', label: 'QB' }, { position: 'RB', label: 'RB1' }, { position: 'RB', label: 'RB2' },
  { position: 'WR', label: 'WR1' }, { position: 'WR', label: 'WR2' }, { position: 'TE', label: 'TE' },
];
const demoPlayers: Record<string, string[]> = {
  QB: ['Josh Allen', 'Patrick Mahomes', 'Lamar Jackson', 'Jalen Hurts'],
  RB: ['Saquon Barkley', 'Jahmyr Gibbs', 'James Cook', 'Derrick Henry'],
  WR: ['Ja’Marr Chase', 'A.J. Brown', 'Puka Nacua', 'Nico Collins'],
  TE: ['George Kittle', 'Travis Kelce', 'Sam LaPorta', 'Trey McBride'],
};
const money = (cents:number) => new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD'}).format(cents/100);
const when = (iso:string) => new Date(iso).toLocaleString('en-CA',{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});

export default function Home(){
  const [tab,setTab]=useState<'home'|'pools'|'picks'|'leaderboard'|'admin'>('home');
  const [role,setRole]=useState<UserRole>('PLAYER');
  const [pools,setPools]=useState<Pool[]>(seedPools);
  const [games,setGames]=useState(seedWeek1Games);
  const [roundIds,setRoundIds]=useState<Record<string,string>>({});
  const [connected,setConnected]=useState(false);
  const [entries,setEntries]=useState<Entry[]>(seedEntries);
  const [payments,setPayments]=useState<PaymentRecord[]>(demoPayments);
  const [survivorPicks,setSurvivorPicks]=useState<SurvivorPick[]>([]);
  const [pickem,setPickem]=useState<PickemSelection[]>([]);
  const [activeEntry,setActiveEntry]=useState('entry-r91');
  const [pickMode,setPickMode]=useState<'survivor'|'pickem'|'fantasy'>('survivor');
  const [fantasy,setFantasy]=useState(fantasySlots);
  const [usedPlayers]=useState(['Josh Allen','James Cook']);
  const [showFantasyPicker,setShowFantasyPicker]=useState<number|null>(null);
  const [paymentPool,setPaymentPool]=useState<Pool|null>(null);
  const [paymentEntry,setPaymentEntry]=useState<Entry|null>(null);
  const [paymentMethod,setPaymentMethod]=useState<PaymentMethod>('ETRANSFER');
  const [reference,setReference]=useState('');
  const [notice,setNotice]=useState<string|null>(null);

  useEffect(()=>{
    if(!process.env.NEXT_PUBLIC_SUPABASE_URL) return;
    fetch('/api/bootstrap').then(async r=>{
      if(!r.ok) return;
      const b=await r.json();
      const mappedPools:Pool[]=(b.pools||[]).map((p:any)=>({id:p.id,name:p.name,sport:p.sport,type:p.contest_type||p.pool_type,status:p.status||(p.is_active?'OPEN':'CLOSED'),season:String(p.season||''),entryFeeCents:p.entry_fee_cents,registrationClosesAt:p.registration_closes_at||undefined}));
      const mappedEntries:Entry[]=(b.entries||[]).map((e:any)=>({id:e.id,poolId:e.pool_id,userId:e.user_id,entryName:e.entry_name,status:e.status||e.entry_status,paymentStatus:e.payment_status}));
      const poolNames=new Map(mappedPools.map(p=>[p.id,p.name]));
      const entryNames=new Map(mappedEntries.map(e=>[e.id,e.entryName]));
      const mappedPayments:PaymentRecord[]=(b.payments||[]).map((p:any)=>{const poolId=p.pool_id||mappedEntries.find(e=>e.id===p.entry_id)?.poolId||'';return {id:p.id,poolId,poolName:poolNames.get(poolId)||'Pool',entryId:p.entry_id||undefined,entryName:entryNames.get(p.entry_id)||undefined,amountCents:p.amount_cents,method:p.method,status:p.status,reference:p.payer_reference||p.reference||undefined,createdAt:p.created_at||p.submitted_at}});
      const mappedGames=(b.games||[]).filter((g:any)=>g.week===1).map((g:any)=>({id:g.id,week:g.week,away:g.away_team_code||g.away_team,awayCode:g.away_team_code||g.away_team,home:g.home_team_code||g.home_team,homeCode:g.home_team_code||g.home_team,kickoff:g.starts_at||g.kickoff_at,status:g.status,awayScore:g.away_score??undefined,homeScore:g.home_score??undefined}));
      const rounds:Record<string,string>={}; (b.rounds||[]).forEach((r:any)=>{if((r.sequence||r.round_order)===1) rounds[r.pool_id]=r.id});
      if(mappedPools.length)setPools(mappedPools); if(mappedEntries.length)setEntries(mappedEntries); setPayments(mappedPayments); if(mappedGames.length)setGames(mappedGames); setRoundIds(rounds); setConnected(true);
    }).catch(()=>setNotice('Your account is signed in, but the pool data could not be loaded. Please refresh the page.'));
  },[]);

  const survivorPoolIds=new Set(pools.filter(p=>p.type==='SURVIVOR'&&p.sport==='NFL').map(p=>p.id));
  const pickemPoolIds=new Set(pools.filter(p=>p.type==='PICKEM'&&p.sport==='NFL').map(p=>p.id));
  const mySurvivorEntries=entries.filter(e=>survivorPoolIds.has(e.poolId));
  const activeSurvivor=entries.find(e=>e.id===activeEntry) || mySurvivorEntries[0];
  const selectedSurvivor=survivorPicks.find(p=>p.entryId===activeSurvivor?.id && p.week===1);
  const fantasyFilled=fantasy.filter(s=>s.player).length;
  const pendingPayments=payments.filter(p=>p.status==='PENDING');
  const paidTotal=payments.filter(p=>p.status==='PAID').reduce((s,p)=>s+p.amountCents,0);
  const outstanding=entries.filter(e=>e.paymentStatus==='UNPAID' && pools.find(p=>p.id===e.poolId)?.entryFeeCents).length;
  const pickemEntry=entries.find(e=>pickemPoolIds.has(e.poolId));
  const pickemCount=pickem.filter(p=>p.entryId===pickemEntry?.id).length;

  function poolStatus(pool:Pool){
    const mine=entries.filter(e=>e.poolId===pool.id);
    if(pool.entryFeeCents===0) return 'PAID';
    if(mine.some(e=>e.paymentStatus==='PAID')) return 'PAID';
    if(mine.some(e=>e.paymentStatus==='PENDING')) return 'PENDING';
    return 'UNPAID';
  }
  async function selectSurvivor(teamCode:string,teamName:string){
    if(!activeSurvivor || activeSurvivor.paymentStatus!=='PAID') return;
    if(connected){
      const roundId=roundIds[activeSurvivor.poolId]; if(!roundId){setNotice('Round is not configured yet.');return;}
      const r=await fetch('/api/picks/survivor',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({entryId:activeSurvivor.id,roundId,teamCode})});
      if(!r.ok){const j=await r.json();setNotice(j.error||'Could not save pick');return;}
    }
    setSurvivorPicks(prev=>[...prev.filter(p=>!(p.entryId===activeSurvivor.id&&p.week===1)),{entryId:activeSurvivor.id,week:1,teamCode,teamName,locked:false,result:'PENDING'}]);
  }
  async function togglePickem(gameId:string,teamCode:string){
    if(!pickemEntry) return;
    if(connected){const r=await fetch('/api/picks/pickem',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({entryId:pickemEntry.id,gameId,teamCode})});if(!r.ok){const j=await r.json();setNotice(j.error||'Could not save Pick’em choice');return;}}
    setPickem(prev=>[...prev.filter(p=>!(p.entryId===pickemEntry.id&&p.gameId===gameId)),{entryId:pickemEntry.id,gameId,teamCode}]);
  }
  function openPayment(pool:Pool,entry?:Entry){
    setPaymentPool(pool); setPaymentEntry(entry||entries.find(e=>e.poolId===pool.id)||null); setPaymentMethod('ETRANSFER'); setReference(''); setNotice(null);
  }
  async function submitPayment(){
    if(!paymentPool||!paymentEntry)return;
    if(paymentMethod==='CARD'){setNotice('Card checkout remains disabled until a processor explicitly approves this pool model.');return;}
    if(paymentMethod==='ETRANSFER'&&reference.trim().length<3){setNotice('Enter the e-transfer confirmation/reference.');return;}
    let persistedPaymentId:string|undefined;
    if(connected){const r=await fetch('/api/payments/submit',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({poolId:paymentPool.id,entryId:paymentEntry.id,method:paymentMethod,reference:reference.trim()})});const j=await r.json();if(!r.ok){setNotice(j.error||'Payment submission failed');return;}persistedPaymentId=j.payment?.id;}
    const rec:PaymentRecord={id:persistedPaymentId||crypto.randomUUID(),poolId:paymentPool.id,poolName:paymentPool.name,entryId:paymentEntry.id,entryName:paymentEntry.entryName,amountCents:paymentPool.entryFeeCents,method:paymentMethod,status:'PENDING',reference:reference.trim()||undefined,createdAt:new Date().toISOString()};
    setPayments(prev=>[rec,...prev]);
    setEntries(prev=>prev.map(e=>e.id===paymentEntry.id?{...e,paymentStatus:'PENDING'}:e));
    setNotice('Payment submitted. Commissioner verification is now pending.');
  }
  async function verifyPayment(id:string){
    const p=payments.find(x=>x.id===id); if(!p)return;
    if(connected){const r=await fetch('/api/admin/payments/verify',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({paymentId:id})});if(!r.ok){const j=await r.json();setNotice(j.error||'Verification failed');return;}}
    setPayments(prev=>prev.map(x=>x.id===id?{...x,status:'PAID'}:x));
    if(p.entryId)setEntries(prev=>prev.map(e=>e.id===p.entryId?{...e,paymentStatus:'PAID'}:e));
  }
  function addSurvivorEntry(){
    const n=mySurvivorEntries.length+1;
    setEntries(prev=>[...prev,{id:crypto.randomUUID(),poolId:'nfl-survivor',userId:'raj',entryName:`Rouge91 #${n}`,status:'ACTIVE',paymentStatus:'UNPAID'}]);
  }
  function pickFantasy(i:number,player:string){setFantasy(prev=>prev.map((s,idx)=>idx===i?{...s,player}:s));setShowFantasyPicker(null)}

  return <main className="shell">
    <header className="topbar"><div><div className="brand">DEGENS</div><div className="subbrand">SPORTS POOLS {connected?'· CONNECTED':'· DEMO'}</div></div><div className="topActions"><a className="authLink" href="/fantasy">Playoff Fantasy</a><a className="authLink" href="/brackets">Brackets</a><a className="authLink" href="/prizes">Prizes</a><a className="authLink" href="/live">Live Draw</a><a className="authLink" href="/beta">Beta Setup</a>{process.env.NEXT_PUBLIC_SUPABASE_URL&&<a className="authLink" href="/auth/login">Account</a>}<button className="roleToggle" onClick={()=>setRole(role==='PLAYER'?'COMMISSIONER':'PLAYER')}>{role==='PLAYER'?'Player View':'Commissioner'}</button></div></header>

    {tab==='home'&&<section className="stack">
      <div className="hero"><span className="eyebrow">{role==='COMMISSIONER'?'COMMISSIONER DASHBOARD':'WELCOME BACK'}</span><h1>{role==='COMMISSIONER'?'Run every pool from one place.':'Your pools, picks and prizes in one place.'}</h1><p>{role==='COMMISSIONER'?'Payments, entries, picks, deadlines and prize draws.':'Survivor, Pick’em, playoff fantasy, brackets and live draws.'}</p></div>
      {role==='PLAYER'?<>
        <div className="statsGrid"><div><b>{mySurvivorEntries.length}</b><span>Survivor entries</span></div><div><b>{pickemCount}/{games.length}</b><span>Pick’em made</span></div><div><b>{outstanding}</b><span>Fees due</span></div></div>
        <div className="alert"><strong>Week 1 is open</strong><span>Make Survivor and Pick’em selections. Thursday games lock at kickoff.</span></div>
      </>:<div className="statsGrid"><div><b>{entries.length}</b><span>Demo entries</span></div><div><b>{pendingPayments.length}</b><span>Payments pending</span></div><div><b>{money(paidTotal)}</b><span>Verified</span></div></div>}
      <h2>{role==='PLAYER'?'My Pools':'Pool Overview'}</h2>
      <div className="cards">{pools.map(pool=><article className="poolCard" key={pool.id}><div className="poolIcon">{pool.sport==='NFL'?'🏈':pool.sport==='NHL'?'🏒':'🏀'}</div><div className="grow"><strong>{pool.name}</strong><span>{pool.season} · {pool.type.replaceAll('_',' ')}</span><span>{pool.entryFeeCents?`${money(pool.entryFeeCents)} entry`:'Free entry'}</span></div><span className={`pill ${poolStatus(pool).toLowerCase()}`}>{poolStatus(pool)}</span></article>)}</div>
    </section>}

    {tab==='pools'&&<section className="stack"><div className="sectionHeader"><div><span className="eyebrow">ENTRIES & PAYMENTS</span><h1>My Entries</h1></div><button className="mini" onClick={addSurvivorEntry}>+ Entry</button></div>
      {entries.map(e=>{const pool=pools.find(p=>p.id===e.poolId)!;return <div className="poolPayCard" key={e.id}><div className="poolPayTop"><div><strong>{e.entryName}</strong><span>{pool.name}</span></div><span className={`pill ${e.paymentStatus.toLowerCase()}`}>{e.paymentStatus}</span></div><div className="feeRow"><span>Entry fee</span><b>{pool.entryFeeCents?money(pool.entryFeeCents):'FREE'}</b></div>{pool.entryFeeCents>0&&e.paymentStatus==='UNPAID'&&<button className="primary" onClick={()=>openPayment(pool,e)}>Pay Entry Fee</button>}{e.paymentStatus==='PENDING'&&<div className="pendingNote">Payment submitted — awaiting commissioner verification.</div>}</div>})}
    </section>}

    {tab==='picks'&&<section className="stack">
      <div className="segmented"><button className={pickMode==='survivor'?'selected':''} onClick={()=>setPickMode('survivor')}>Survivor</button><button className={pickMode==='pickem'?'selected':''} onClick={()=>setPickMode('pickem')}>Pick’em</button><button className={pickMode==='fantasy'?'selected':''} onClick={()=>setPickMode('fantasy')}>Playoff Fantasy</button></div>
      {pickMode==='survivor'&&<><div className="sectionHeader"><div><span className="eyebrow">NFL SURVIVOR · WEEK 1</span><h1>Choose one team</h1></div></div><div className="entryTabs">{mySurvivorEntries.map(e=><button className={activeEntry===e.id?'entryActive':''} key={e.id} onClick={()=>setActiveEntry(e.id)}>{e.entryName}<small>{e.paymentStatus}</small></button>)}</div>{activeSurvivor?.paymentStatus!=='PAID'&&<div className="warning">This entry must be paid before a pick can be submitted.</div>}{games.map(g=><div className="gameCard" key={g.id}><div className="gameTime">{when(g.kickoff)}</div><div className="matchup"><button disabled={activeSurvivor?.paymentStatus!=='PAID'} className={selectedSurvivor?.teamCode===g.awayCode?'teamPick selectedTeam':'teamPick'} onClick={()=>selectSurvivor(g.awayCode,g.away)}><b>{g.awayCode}</b><span>{g.away}</span></button><span className="at">@</span><button disabled={activeSurvivor?.paymentStatus!=='PAID'} className={selectedSurvivor?.teamCode===g.homeCode?'teamPick selectedTeam':'teamPick'} onClick={()=>selectSurvivor(g.homeCode,g.home)}><b>{g.homeCode}</b><span>{g.home}</span></button></div></div>)}{selectedSurvivor&&<div className="stickySubmit"><span>Selected: <b>{selectedSurvivor.teamName}</b></span><button className="primary">Submit Week 1 Pick</button></div>}</>}
      {pickMode==='pickem'&&<><div className="sectionHeader"><div><span className="eyebrow">NFL PICK’EM · WEEK 1</span><h1>{pickemCount}/{games.length} selections</h1></div></div>{games.map(g=>{const sel=pickem.find(p=>p.gameId===g.id&&p.entryId===pickemEntry?.id);return <div className="pickemGame" key={g.id}><div><strong>{g.awayCode} @ {g.homeCode}</strong><span>{when(g.kickoff)}</span></div><div className="pickButtons"><button className={sel?.teamCode===g.awayCode?'chosen':''} onClick={()=>togglePickem(g.id,g.awayCode)}>{g.awayCode}</button><button className={sel?.teamCode===g.homeCode?'chosen':''} onClick={()=>togglePickem(g.id,g.homeCode)}>{g.homeCode}</button></div></div>})}<button className="primary" disabled={pickemCount!==games.length}>Submit All Picks</button></>}
      {pickMode==='fantasy'&&<><div className="sectionHeader"><div><span className="eyebrow">NFL PLAYOFF FANTASY</span><h1>Wild Card Lineup</h1></div><div className="scoreBadge">{fantasyFilled}/6</div></div><div className="ruleBox"><strong>QB · RB · RB · WR · WR · TE</strong><span>Each player can be used only once by this entry across the entire postseason. Total fantasy points accumulate through the Super Bowl.</span></div><div className="used"><span>Already used</span>{usedPlayers.map(p=><b key={p}>{p}</b>)}</div><div className="lineup">{fantasy.map((slot,i)=><button className="slot" key={slot.label} onClick={()=>setShowFantasyPicker(i)}><span className="slotPos">{slot.label}</span><span className="slotPlayer">{slot.player||'Select player'}</span><span>›</span></button>)}</div><button className="primary" disabled={fantasyFilled<6}>Submit Wild Card Lineup</button></>}
    </section>}

    {tab==='leaderboard'&&<section className="stack"><div><span className="eyebrow">LIVE STANDINGS</span><h1>Leaderboards</h1></div><div className="segmented"><button className="selected">Survivor</button><button>Pick’em</button><button>Fantasy</button></div>{leaderboard.map(row=><div className="leaderRow" key={row.name}><b>#{row.rank}</b><div><strong>{row.name}</strong><span>{row.alive?'Alive':'Eliminated'}</span></div><span className="alive">●</span></div>)}</section>}

    {tab==='admin'&&<section className="stack"><div><span className="eyebrow">COMMISSIONER</span><h1>Control Centre</h1></div>{role!=='COMMISSIONER'?<div className="warning">Switch to Commissioner view using the button at the top.</div>:<><div className="statsGrid"><div><b>{entries.length}</b><span>Entries</span></div><div><b>{pendingPayments.length}</b><span>Pending</span></div><div><b>{money(paidTotal)}</b><span>Collected</span></div></div><h2>Payment Verification</h2>{pendingPayments.length===0?<div className="wideCard"><span>No payments awaiting verification.</span></div>:pendingPayments.map(p=><div className="adminPayment" key={p.id}><div><strong>{p.entryName}</strong><span>{p.poolName} · {p.method}</span><small>Ref: {p.reference||'—'}</small></div><div><b>{money(p.amountCents)}</b><button className="verify" onClick={()=>verifyPayment(p.id)}>Verify Paid</button></div></div>)}<h2>Commissioner Actions</h2><div className="actionGrid"><button>Send Pick Reminder</button><button>Lock Week</button><a href="/prizes">Prize Centre</a><a href="/live">Go Live</a></div></>}</section>}

    {showFantasyPicker!==null&&<div className="sheet"><div className="sheetInner"><div className="grabber"/><div className="sectionHeader"><h2>Select {fantasy[showFantasyPicker].label}</h2><button className="close" onClick={()=>setShowFantasyPicker(null)}>×</button></div>{demoPlayers[fantasy[showFantasyPicker].position].map(player=>{const used=usedPlayers.includes(player)||fantasy.some((s,idx)=>idx!==showFantasyPicker&&s.player===player);return <button className="playerRow" key={player} disabled={used} onClick={()=>pickFantasy(showFantasyPicker,player)}><span>{player}</span><small>{used?'USED / UNAVAILABLE':'AVAILABLE'}</small></button>})}</div></div>}

    {paymentPool&&paymentEntry&&<div className="sheet"><div className="sheetInner paymentSheet"><div className="grabber"/><div className="sectionHeader"><div><span className="eyebrow">ENTRY PAYMENT</span><h2>{paymentEntry.entryName}</h2></div><button className="close" onClick={()=>setPaymentPool(null)}>×</button></div><div className="paymentTotal"><span>{paymentPool.name}</span><strong>{money(paymentPool.entryFeeCents)}</strong></div><label className="fieldLabel">Payment method</label><div className="methodGrid">{(['ETRANSFER','CARD','CASH'] as PaymentMethod[]).map(m=><button key={m} className={paymentMethod===m?'method activeMethod':'method'} onClick={()=>{setPaymentMethod(m);setNotice(null)}}><b>{m==='ETRANSFER'?'Interac e-Transfer':m==='CARD'?'Credit / Debit Card':'Cash'}</b></button>)}</div>{paymentMethod==='ETRANSFER'&&<div className="methodPanel"><strong>Send your e-transfer, then enter the confirmation</strong><input className="textInput" value={reference} onChange={e=>setReference(e.target.value)} placeholder="Confirmation number"/></div>}{paymentMethod==='CARD'&&<div className="methodPanel"><strong>Hosted checkout adapter</strong><p>Enabled only after an approved processor is configured.</p></div>}{notice&&<div className="notice">{notice}</div>}<button className="primary" onClick={submitPayment}>{paymentMethod==='CARD'?'Continue to Checkout':'Submit Payment'}</button></div></div>}

    <nav className="bottomNav">{([['home','⌂','Home'],['pools','▦','Entries'],['picks','✓','Picks'],['leaderboard','≡','Standings'],['admin','⚙','Admin']] as const).map(([key,icon,label])=><button key={key} className={tab===key?'active':''} onClick={()=>setTab(key)}><span>{icon}</span><small>{label}</small></button>)}</nav>
  </main>
}
