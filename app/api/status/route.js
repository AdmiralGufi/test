import {NextResponse} from 'next/server';
import {sql} from '../../../lib/db';
import {logError,logInfo,requestContext} from '../../../lib/observability';

export const dynamic='force-dynamic';

export async function GET(request){
  const started=Date.now();
  const context=requestContext(request,'/api/status');
  try{
    await sql`select 1 as healthy`;
    const payload={
      ok:true,
      service:'fulfillment-wms',
      database:'connected',
      version:process.env.VERCEL_GIT_COMMIT_SHA?.slice(0,12)||'local',
      timestamp:new Date().toISOString()
    };
    logInfo('health_check_ok',{...context,durationMs:Date.now()-started});
    return NextResponse.json(payload,{headers:{'cache-control':'no-store'}});
  }catch(error){
    logError('health_check_failed',error,{...context,durationMs:Date.now()-started});
    return NextResponse.json({ok:false,service:'fulfillment-wms',database:'unavailable'},{status:503,headers:{'cache-control':'no-store'}});
  }
}
