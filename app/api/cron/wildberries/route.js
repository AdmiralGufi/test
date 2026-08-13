import {NextResponse} from 'next/server';
import {sql} from '../../../../lib/db';
import {syncWildberriesIntegration} from '../../../../lib/wildberries';
import {logError,logInfo,requestContext} from '../../../../lib/observability';

export const runtime='nodejs';
export const maxDuration=60;

export async function GET(request){
  const context=requestContext(request,'/api/cron/wildberries');
  const secret=process.env.CRON_SECRET;
  if(!secret){
    logError('wb_cron_secret_missing',new Error('CRON_SECRET is not configured'),context);
    return NextResponse.json({error:'CRON_NOT_CONFIGURED'},{status:503});
  }
  const authorized=request.headers.get('authorization')===`Bearer ${secret}`;
  if(!authorized)return NextResponse.json({error:'UNAUTHORIZED'},{status:401});
  const integrations=await sql`update wb_integrations set last_sync_at=now()
    where id in (
      select id from wb_integrations
      where active=true and (last_sync_at is null or last_sync_at<now()-interval '45 seconds')
      order by last_sync_at nulls first limit 50 for update skip locked
    ) returning *`;
  let imported=0,failed=0;
  for(const integration of integrations){
    try{imported+=(await syncWildberriesIntegration(integration)).imported}
    catch(error){failed+=1;logError('wb_cron_integration_failed',error,{...context,integrationId:integration.id})}
  }
  logInfo('wb_cron_completed',{...context,integrations:integrations.length,imported,failed});
  return NextResponse.json({ok:true,integrations:integrations.length,imported,failed});
}
