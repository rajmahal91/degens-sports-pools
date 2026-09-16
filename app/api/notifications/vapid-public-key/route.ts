import { NextResponse } from 'next/server';
import { publicVapidKey } from '@/lib/notifications/web-push';

export const runtime='nodejs';

export async function GET(){
  const key=publicVapidKey();
  if(!key)return NextResponse.json({configured:false},{status:503});
  return NextResponse.json({configured:true,publicKey:key},{headers:{'Cache-Control':'public,max-age=3600'}});
}
