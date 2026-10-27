// Email delivery for booking requests and quotes, via Resend (https://resend.com).
// Environment variables (set in Vercel → Project → Settings → Environment Variables):
//   RESEND_API_KEY   API key from Resend
//   MAIL_TO          where requests go (default info@rjwheels.ca)
//   MAIL_FROM        verified sender, e.g. "RJ Welding & Wheels <reservations@rjwheels.ca>"
// Messages only ever go to MAIL_TO: visitors cannot choose a recipient.

export const MAIL_TO = process.env.MAIL_TO || 'info@rjwheels.ca';

export function mailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
}

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// rows: [[label, value], ...]; attachments: [{ filename, content (base64) }]
export async function sendMail({ subject, intro, rows, replyTo, attachments = [] }) {
  if (!mailConfigured()) throw new Error('mail-not-configured');
  const table = rows.filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `<tr><td style="padding:6px 12px 6px 0;color:#666;vertical-align:top">${escapeHtml(k)}</td><td style="padding:6px 0;white-space:pre-wrap">${escapeHtml(v)}</td></tr>`).join('');
  const text = [intro, '', ...rows.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`)].join('\n');
  const res = await fetch(process.env.RESEND_API_URL || 'https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: process.env.MAIL_FROM,
      to: [MAIL_TO],
      reply_to: replyTo || undefined,
      subject,
      text,
      html: `<div style="font-family:system-ui,sans-serif;font-size:15px;color:#111"><p>${escapeHtml(intro)}</p><table>${table}</table></div>`,
      attachments: attachments.length ? attachments : undefined,
    }),
  });
  if (!res.ok) throw new Error(`mail-failed-${res.status}`);
  return res.json();
}
