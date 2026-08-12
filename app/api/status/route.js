import {NextResponse} from 'next/server';import {sql} from '../../../lib/db';import {getCurrentUser} from '../../../lib/auth';
export async function GET(){const c=await sql`select count(*)::int n from users`;const user=await getCurrentUser();return NextResponse.json({setupRequired:c[0].n===0,user});}
