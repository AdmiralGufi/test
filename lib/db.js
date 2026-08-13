import { neon } from '@neondatabase/serverless';

let client;

function getClient(){
  if(!client){
    const databaseUrl=process.env.DATABASE_URL;
    if(!databaseUrl)throw new Error('DATABASE_URL is not configured');
    client=neon(databaseUrl);
  }
  return client;
}

export function sql(strings,...values){
  return getClient()(strings,...values);
}

export function transaction(build,options={}){
  return getClient().transaction(tx=>build(tx),options);
}
