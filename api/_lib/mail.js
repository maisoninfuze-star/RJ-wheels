// Email delivery for booking requests and quotes, through the shop's own
// Spacemail mailbox (SMTP mail.spacemail.com:465, SSL).
// Environment variables (Vercel → Project → Settings → Environment Variables):
//   SMTP_PASS   password of the info@rjwheels.ca mailbox (required)
//   SMTP_USER   mailbox login (default info@rjwheels.ca)
//   SMTP_HOST / SMTP_PORT   optional overrides (default mail.spacemail.com / 465)
// The recipient is fixed in code: every message goes to the shop's address from
// src/content.mjs (info@rjwheels.ca). No setting or visitor input can change it.
import nodemailer from 'nodemailer';
import { business } from '../../src/content.mjs';

export const MAIL_TO = business.email; // 'info@rjwheels.ca'
if (MAIL_TO !== 'info@rjwheels.ca') throw new Error(`Unexpected shop email: ${MAIL_TO}`);

const SMTP_USER = process.env.SMTP_USER || MAIL_TO;

export function mailConfigured() {
  return Boolean(process.env.SMTP_PASS);
}

let transport;
function getTransport() {
  transport ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'mail.spacemail.com',
    port: Number(process.env.SMTP_PORT || 465),
    secure: Number(process.env.SMTP_PORT || 465) === 465,
    auth: { user: SMTP_USER, pass: process.env.SMTP_PASS },
    connectionTimeout: 10_000,
    socketTimeout: 15_000,
  });
  return transport;
}

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// rows: [[label, value], ...]; attachments: [{ filename, content (base64) }]
export async function sendMail({ subject, intro, rows, replyTo, attachments = [] }) {
  if (!mailConfigured()) throw new Error('mail-not-configured');
  const filled = rows.filter(([, v]) => v !== undefined && v !== null && v !== '');
  const table = filled.map(([k, v]) => `<tr><td style="padding:6px 12px 6px 0;color:#666;vertical-align:top">${escapeHtml(k)}</td><td style="padding:6px 0;white-space:pre-wrap">${escapeHtml(v)}</td></tr>`).join('');
  return getTransport().sendMail({
    from: { name: 'RJ Welding & Wheels — site web', address: SMTP_USER },
    to: MAIL_TO,
    replyTo: replyTo || undefined,
    subject,
    text: [intro, '', ...filled.map(([k, v]) => `${k}: ${v}`)].join('\n'),
    html: `<div style="font-family:system-ui,sans-serif;font-size:15px;color:#111"><p>${escapeHtml(intro)}</p><table>${table}</table></div>`,
    attachments: attachments.map((a) => ({ filename: a.filename, content: a.content, encoding: 'base64' })),
  });
}
