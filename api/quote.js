// POST /api/quote — the contact-page quote form, emailed to the shop (MAIL_TO)
// with up to 6 photos. multipart/form-data from the form in contactPage().
import { json, clientIp, sameOrigin, rateLimit } from './_lib/guard.js';
import { sendMail, mailConfigured } from './_lib/mail.js';

const field = (form, k, max = 2000) => String(form.get(k) || '').trim().slice(0, max);

export async function POST(request) {
  if (!sameOrigin(request)) return json({ error: 'forbidden' }, 403);
  if (!rateLimit(`quote:${clientIp(request)}`, 5, 60 * 60 * 1000)) return json({ error: 'rate_limited' }, 429);
  if (!mailConfigured()) return json({ error: 'not_configured' }, 503);
  let form;
  try { form = await request.formData(); } catch { return json({ error: 'bad_form' }, 400); }
  if (field(form, 'company')) return json({ ok: true }); // honeypot: silently drop bots
  const name = field(form, 'name', 120), phone = field(form, 'phone', 40), message = field(form, 'message');
  if (!name || phone.replace(/\D/g, '').length < 10 || !message) return json({ error: 'invalid' }, 400);
  const files = form.getAll('photos').filter((f) => typeof f === 'object' && f.type?.startsWith('image/') && f.size <= 2_500_000).slice(0, 6);
  const attachments = await Promise.all(files.map(async (f, i) => ({ filename: `photo-${i + 1}.jpg`, content: Buffer.from(await f.arrayBuffer()).toString('base64') })));
  try {
    await sendMail({
      subject: `Demande de soumission — ${name}`,
      intro: 'Nouvelle demande de soumission reçue par le formulaire du site web.',
      replyTo: field(form, 'email', 200) || undefined,
      rows: [['Nom', name], ['Téléphone', phone], ['Courriel', field(form, 'email', 200)], ['Véhicule', field(form, 'vehicle', 200)],
        ['Service', field(form, 'service', 100)], ['Roues', field(form, 'count', 10)], ['Diamètre', field(form, 'size', 10)],
        ['Message', message], ['Langue', field(form, 'lang', 5)], ['Photos', String(attachments.length)]],
      attachments,
    });
  } catch (err) {
    console.error('quote mail failed', err.message);
    return json({ error: 'send_failed' }, 502);
  }
  return json({ ok: true });
}
