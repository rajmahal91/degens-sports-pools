'use client';
import { FormEvent, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function SignUpPage() {
  const [name,setName]=useState(''); const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [message,setMessage]=useState('');
  async function submit(e:FormEvent){e.preventDefault();setMessage('');try{const supabase=createClient();const emailRedirectTo=`${window.location.origin}/auth/callback`;const {error}=await supabase.auth.signUp({email,password,options:{data:{display_name:name},emailRedirectTo}});if(error)throw error;setMessage('Account created. Check your email to confirm it, then sign in.');}catch(err){setMessage(err instanceof Error?err.message:'Sign-up failed');}}
  return <main className="authShell"><form className="authCard" onSubmit={submit}><div className="brand">DEGENS</div><span className="eyebrow">SPORTS POOLS</span><h1>Create account</h1><label>Display name<input className="textInput" value={name} onChange={e=>setName(e.target.value)} required/></label><label>Email<input className="textInput" type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label><label>Password<input className="textInput" type="password" minLength={8} value={password} onChange={e=>setPassword(e.target.value)} required/></label>{message&&<div className="notice">{message}</div>}<button className="primary" type="submit">Create Account</button><a href="/auth/login">Already have an account?</a></form></main>;
}
