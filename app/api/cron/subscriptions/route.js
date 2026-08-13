import {NextResponse} from 'next/server';
import {transaction} from '../../../../lib/db';
import {logError,logInfo,requestContext} from '../../../../lib/observability';

export const runtime='nodejs';
const respond=(body,status=200)=>NextResponse.json(body,{status,headers:{'cache-control':'private, no-store, max-age=0'}});

export async function GET(request){
  const context=requestContext(request,'/api/cron/subscriptions');
  const secret=process.env.CRON_SECRET;
  if(!secret){
    logError('subscription_cron_secret_missing',new Error('CRON_SECRET is not configured'),context);
    return respond({error:'CRON_NOT_CONFIGURED'},503);
  }
  if(request.headers.get('authorization')!==`Bearer ${secret}`)return respond({error:'UNAUTHORIZED'},401);
  const [expired]=await transaction(tx=>[
    tx`update organizations set status='SUSPENDED',billing_status='PAST_DUE',updated_at=now()
      where status='TRIAL' and archived_at is null and trial_ends_at<=now()
      returning id`,
    tx`delete from sessions where organization_id in (
      select id from organizations where status='SUSPENDED' and billing_status='PAST_DUE'
    )`
  ],{isolationLevel:'Serializable'});
  logInfo('subscription_lifecycle_completed',{...context,expired:expired.length});
  return respond({ok:true,expired:expired.length});
}
