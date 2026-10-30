import { COUNTRY_NAMES } from './countries';
import { LANG_ENGLISH } from './i18n';
import { GuardError } from './model-guard';
const invalid = () => { throw new GuardError(400, 'Invalid request fields'); };
const text = (v: unknown, max: number) => typeof v === 'string' && v.trim().length > 0 && v.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v);
export function profile(body: Record<string, unknown>, chat = false) {
  const allowed = ['country', 'age', 'employmentStatus', 'industry', 'isParent', 'housingStatus', 'lang', ...(chat ? ['question'] : [])];
  if (Object.keys(body).some(k => !allowed.includes(k))) invalid();
  if (typeof body.country !== 'string' || !Object.hasOwn(COUNTRY_NAMES, body.country)) invalid();
  if (typeof body.age !== 'number' || !Number.isInteger(body.age) || body.age < 13 || body.age > 120) invalid();
  for (const key of ['employmentStatus', 'industry', 'housingStatus']) {
    if (body[key] !== undefined && body[key] !== '' && !text(body[key], 80)) invalid();
  }
  if (body.lang !== undefined && (typeof body.lang !== 'string' || !Object.hasOwn(LANG_ENGLISH, body.lang))) invalid();
  if (body.isParent !== undefined && typeof body.isParent !== 'boolean') invalid();
  if (chat && !text(body.question, 2000)) invalid();
  return body as { country: string; age: number; question: string; employmentStatus?: string; industry?: string; housingStatus?: string; isParent?: boolean };
}
export function translation(body: Record<string, unknown>) {
  if (Object.keys(body).some(k => !['lang', 'labels', 'hints'].includes(k)) || typeof body.lang !== 'string' || !Object.hasOwn(LANG_ENGLISH, body.lang)) invalid();
  for (const name of ['labels', 'hints']) {
    const values = body[name];
    if (!values || typeof values !== 'object' || Array.isArray(values)) invalid();
    const entries = Object.entries(values as object);
    if (entries.length > 40 || entries.some(([k, v]) => !/^[a-zA-Z0-9_-]{1,60}$/.test(k) || !text(v, 300))) invalid();
  }
  return body as { lang: string; labels: Record<string, string>; hints: Record<string, string> };
}
