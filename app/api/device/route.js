import {NextResponse} from 'next/server';
export async function POST(){return NextResponse.json({error:'Используйте REGISTER_DEVICE через /api/ops'},{status:410})}
