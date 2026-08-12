export const ROLE_RULES={ADMIN:['*'],MANAGER:['READ','RECEIVE','MOVE','PRODUCT','ORDER','DEVICE'],RECEIVER:['READ','RECEIVE','MOVE','PRODUCT'],PICKER:['READ','MOVE','PICK'],PACKER:['READ','PACK'],VIEWER:['READ']};
export function can(user,perm){const rules=ROLE_RULES[user?.role]||[];return rules.includes('*')||rules.includes(perm)}
