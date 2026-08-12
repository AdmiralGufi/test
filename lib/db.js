import { neon } from '@neondatabase/serverless';

let client;

export function sql(strings,...values){
  if(!client){
    const databaseUrl=process.env.DATABASE_URL;
    if(!databaseUrl)throw new Error('DATABASE_URL is not configured');
    client=neon(databaseUrl);
  }
  return client(strings,...values);
}
