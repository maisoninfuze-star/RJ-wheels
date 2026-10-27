// POST /api/booking-photos — emails photos for an existing booking reference
// to the shop (MAIL_TO only). multipart/form-data: ref, photos[] (images).
import { json, clientIp, sameOrigin, rateLimit } from './_lib/guard.js';
import { sendMail, mailConfigured } from './_lib/mail.js';

const MAX_FILES = 6;
const MAX_FILE = 2_500_000;

export async function POST(request) {
  if (!sameOrigin(request)) return json({ error: 'forbidden' }, 403);
  if (!rateLimit(`photos:${clientIp(request)}`, 6, 60 * 60 * 1000)) return json({ error: 'rate_limited' }, 429);
  if (!mailConfigured()) return json({ error: 'not_configured' }, 503);
  let form;
  try { form = await request.formData(); } catch { return json({ error: 'bad_form' }, 400); }
  const ref = String(form.get('ref') || '');
  if (!/^RJ-[A-Z0-9]{4,8}$/.test(ref)) return json({ error: 'bad_ref' }, 400);
  const files = form.getAll('photos').filter((f) => typeof f === 'object' && f.type?.startsWith('image/') && f.size <= MAX_FILE).slice(0, MAX_FILES);
  if (!files.length) return json({ error: 'no_photos' }, 400);
  const attachments = await Promise.all(files.map(async (f, i) => ({ filename: `${ref}-${i + 1}.jpg`, content: Buffer.from(await f.arrayBuffer()).toString('base64') })));
  try {
    await sendMail({ subject: `Photos — demande ${ref}`, intro: `Photos ajoutées par le client pour la demande ${ref}.`, rows: [['Référence', ref], ['Photos', String(attachments.length)]], attachments });
  } catch (err) {
    console.error('photo mail failed', err.message);
    return json({ error: 'send_failed' }, 502);
  }
  return json({ ok: true, count: attachments.length });
}
