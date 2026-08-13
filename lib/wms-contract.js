export const WMS_ACTIONS = Object.freeze([
  'CREATE_BOX',
  'CREATE_PRODUCT',
  'CREATE_SELLER',
  'MOVE_BOX',
  'ADD_BOX_ITEM',
  'CREATE_ORDER',
  'PICK_ITEM',
  'ORDER_PACKED',
  'ORDER_READY',
  'ORDER_SHIPPED',
  'CREATE_USER',
  'REGISTER_DEVICE'
]);

export const ROLES = Object.freeze([
  'ADMIN', 'MANAGER', 'RECEIVER', 'PICKER', 'PACKER', 'SHIPPER', 'VIEWER'
]);

export const DEVICE_TYPES = Object.freeze(['TSD', 'PHONE', 'TABLET']);
export const ORDER_PRIORITIES = Object.freeze(['LOW', 'NORMAL', 'HIGH', 'URGENT']);

export function positiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

export function cleanText(value, max = 200) {
  return String(value ?? '').trim().slice(0, max);
}

export function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanText(value, 254).toLowerCase());
}
