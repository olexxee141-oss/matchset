export function extractCode(value: string, kind: 'set' | 'community') {
  let slug = value.trim();
  try {
    if (slug.includes('://')) slug = new URL(slug).pathname.split('/').filter(Boolean).at(-1) || '';
  } catch { return ''; }
  slug = slug.replace(new RegExp('^' + kind + '/'), '').trim();
  return /^[a-zA-Z0-9_-]{6,40}$/.test(slug) ? slug : '';
}
