'use client';
import { FormEvent, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [message,setMessage]=useState('');
  async function submit(e:FormEvent){e.preventDefault();setMessage('');try{const supabase=createClient();const {error}=await supabase.auth.signInWithPassword({email,password});if(error)throw error;window.location.href='/';}catch(err){setMessage(err instanceof Error?err.message:'Login failed');}}
  return <main className="authShell"><form className="authCard" onSubmit={submit}><div className="brand">DEGENS</div><span className="eyebrow">SPORTS POOLS</span><h1>Sign in</h1><label>Email<input className="textInput" type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label><label>Password<input className="textInput" type="password" value={password} onChange={e=>setPassword(e.target.value)} required/></label>{message&&<div className="notice">{message}</div>}<button className="primary" type="submit">Sign In</button><a href="/auth/sign-up">Create an account</a></form></main>;
}
