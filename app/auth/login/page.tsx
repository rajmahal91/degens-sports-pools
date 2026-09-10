'use client';
import { FormEvent, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [message,setMessage]=useState('');
  const params=typeof window==='undefined'?null:new URLSearchParams(window.location.search),requested=params?.get('next')||'/',next=requested.startsWith('/')&&!requested.startsWith('//')?requested:'/';
  const sessionExpired=params?.get('reason')==='session';
  async function submit(e:FormEvent){e.preventDefault();setMessage('');try{const supabase=createClient();const {data,error}=await supabase.auth.signInWithPassword({email,password});if(error)throw error;if(!data.session)throw new Error('Sign-in did not create a session. Please try again.');const {data:verified,error:verifyError}=await supabase.auth.getUser();if(verifyError||!verified.user)throw verifyError||new Error('Could not verify your session.');window.location.replace(next);}catch(err){setMessage(err instanceof Error?err.message:'Login failed');}}
  return <main className="authShell"><form className="authCard" onSubmit={submit}><div className="brand">DEGENS</div><span className="eyebrow">SPORTS POOLS</span><h1>Sign in</h1>{sessionExpired&&<div className="notice">Your session expired in this app. Sign in here once, and you’ll return directly to the Prize Centre.</div>}<label>Email<input className="textInput" type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label><label>Password<input className="textInput" type="password" value={password} onChange={e=>setPassword(e.target.value)} required/></label>{message&&<div className="notice">{message}</div>}<button className="primary" type="submit">Sign In</button><a href="/auth/sign-up">Create an account</a></form></main>;
}
