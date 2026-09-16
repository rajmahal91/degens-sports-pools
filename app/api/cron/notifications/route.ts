import { NextResponse } from 'next/server';
import { sendPickReminders } from '@/lib/notifications/reminders';

export const runtime='nodejs';
export const maxDuration=60;

export async function GET(request:Request){
  const secret=process.env.CRON_SECRET;
  if(!secret||request.headers.get('authorization')!==`Bearer ${secret}`)return NextResponse.json({error:'Unauthorized'},{status:401});
  try{return NextResponse.json({ranAt:new Date().toISOString(),...(await sendPickReminders())});}
  catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Notification reminder job failed'},{status:500});}
}
