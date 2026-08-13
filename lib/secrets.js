import {createCipheriv,createDecipheriv,createHash,randomBytes} from 'node:crypto';

function encryptionKey(){
  const source=process.env.INTEGRATION_ENCRYPTION_KEY||process.env.DATABASE_URL;
  if(!source)throw new Error('INTEGRATION_ENCRYPTION_KEY is not configured');
  return createHash('sha256').update(`fulfillment-wms-integrations:${source}`).digest();
}

export function encryptSecret(value){
  const iv=randomBytes(12);
  const cipher=createCipheriv('aes-256-gcm',encryptionKey(),iv);
  const encrypted=Buffer.concat([cipher.update(String(value),'utf8'),cipher.final()]);
  return [iv,cipher.getAuthTag(),encrypted].map(part=>part.toString('base64url')).join('.');
}

export function decryptSecret(value){
  const[iv,tag,encrypted]=String(value).split('.').map(part=>Buffer.from(part,'base64url'));
  if(!iv||!tag||!encrypted)throw new Error('INVALID_ENCRYPTED_SECRET');
  const decipher=createDecipheriv('aes-256-gcm',encryptionKey(),iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted),decipher.final()]).toString('utf8');
}
