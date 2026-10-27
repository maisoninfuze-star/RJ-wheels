// POST /api/chat — the website assistant, powered by Claude.
// Body: { lang: 'fr'|'en', messages: Anthropic.Beta.BetaMessageParam[] }
// The client keeps the conversation and sends it back each turn (append-only;
// the server returns the updated history, including Claude's own blocks).
// Env: ANTHROPIC_API_KEY (required), RESEND_API_KEY + MAIL_FROM (for bookings).
import Anthropic from '@anthropic-ai/sdk';
import { json, clientIp, sameOrigin, rateLimit } from './_lib/guard.js';
import { systemPrompt, todayMontreal, availableSlots, isBookableSlot } from './_lib/site.js';
import { sendMail, mailConfigured } from './_lib/mail.js';

const MODEL = 'claude-opus-5-5';
const MAX_MESSAGES = 60;
const MAX_BODY = 400_000;
const MAX_USER_TEXT = 1500;

const client = new Anthropic(); // reads ANTHROPIC_API_KEY

const tools = [
  {
    name: 'get_available_slots',
    description: 'List upcoming opening-hour appointment slots (Montréal time) for an assessment at the shop. Use before proposing times. Slots are requests the shop confirms, not a live calendar.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        from_date: { type: 'string', description: 'First date to consider, YYYY-MM-DD. Use tomorrow if unsure.' },
        days: { type: 'integer', description: 'How many open days to return (1-14).' },
      },
      required: ['from_date', 'days'],
      additionalProperties: false,
    },
  },
  {
    name: 'request_booking',
    description: 'Send an assessment appointment request to the shop by email. Only call after the visitor has reviewed a recap and explicitly agreed to send it.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Full name' },
        phone: { type: 'string', description: 'Mobile number, 10 digits' },
        email: { type: 'string', description: 'Email, or empty string if not given' },
        contact_channel: { type: 'string', enum: ['whatsapp', 'sms', 'phone'] },
        service: { type: 'string', description: 'Service requested, in the visitor\'s words or a listed service' },
        finish: { type: 'string', description: 'Powder-coat colour if any, else empty string' },
        vehicle: { type: 'string', description: 'Make, model, year, or empty string' },
        wheels: { type: 'string', description: 'Number of wheels, or empty string' },
        date: { type: 'string', description: 'Requested date, YYYY-MM-DD, from get_available_slots' },
        time: { type: 'string', description: 'Requested time, HH:MM 24h, from get_available_slots' },
        notes: { type: 'string', description: 'Damage description or other notes, or empty string' },
        language: { type: 'string', enum: ['fr', 'en'] },
        consent: { type: 'boolean', description: 'True only if the visitor agreed to send their details to the shop' },
      },
      required: ['name', 'phone', 'email', 'contact_channel', 'service', 'finish', 'vehicle', 'wheels', 'date', 'time', 'notes', 'language', 'consent'],
      additionalProperties: false,
    },
  },
];

async function runTool(name, input, ctx) {
  if (name === 'get_available_slots') return JSON.stringify(availableSlots(input));
  if (name === 'request_booking') {
    if (!input.consent) return JSON.stringify({ error: 'The visitor has not agreed to send their details yet.' });
    const digits = String(input.phone).replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
    if (digits.length !== 10) return JSON.stringify({ error: 'Phone number must have 10 digits.' });
    if (!isBookableSlot(input.date, input.time)) return JSON.stringify({ error: 'That date/time is not an available slot. Call get_available_slots again.' });
    if (!rateLimit(`book:${ctx.ip}`, 3, 60 * 60 * 1000)) return JSON.stringify({ error: 'Too many requests from this connection. Ask the visitor to call the shop.' });
    if (!mailConfigured()) return JSON.stringify({ error: 'Online booking is not available right now. Ask the visitor to call the shop.' });
    const ref = 'RJ-' + Date.now().toString(36).slice(-4).toUpperCase() + Math.random().toString(36).slice(2, 4).toUpperCase();
    const phone = `${digits.slice(0, 3)} ${digits.slice(3, 6)}-${digits.slice(6)}`;
    try {
      await sendMail({
        subject: `Demande de rendez-vous ${ref} — ${input.name} — ${input.date} ${input.time}`,
        intro: 'Nouvelle demande d’évaluation reçue par l’assistant du site web. À confirmer avec le client.',
        replyTo: input.email || undefined,
        rows: [
          ['Référence', ref], ['Nom', input.name], ['Cellulaire', phone], ['Courriel', input.email],
          ['Contact préféré', input.contact_channel], ['Date demandée', `${input.date} à ${input.time}`],
          ['Service', input.service], ['Couleur', input.finish], ['Véhicule', input.vehicle], ['Roues', input.wheels],
          ['Notes', input.notes], ['Langue', input.language], ['Consentement', 'Oui (donné dans le clavardage)'],
        ],
      });
    } catch (err) {
      console.error('booking mail failed', err.message);
      return JSON.stringify({ error: 'The request could not be sent. Ask the visitor to call the shop.' });
    }
    ctx.booking = { ref, name: input.name, date: input.date, time: input.time, service: input.service, finish: input.finish };
    return JSON.stringify({ ok: true, reference: ref, message: 'Request sent to the shop by email. The shop will confirm with the visitor.' });
  }
  return JSON.stringify({ error: `Unknown tool ${name}` });
}

// Light validation of the client-held history: roles, sizes, and only the last
// user turn may contain free text from the visitor this request.
function validHistory(messages) {
  if (!Array.isArray(messages) || !messages.length || messages.length > MAX_MESSAGES) return false;
  if (messages[0].role !== 'user') return false;
  for (const m of messages) {
    if (m.role !== 'user' && m.role !== 'assistant') return false;
    if (m.role === 'user' && typeof m.content === 'string' && m.content.length > MAX_USER_TEXT) return false;
  }
  return true;
}

export async function POST(request) {
  if (!sameOrigin(request)) return json({ error: 'forbidden' }, 403);
  const ip = clientIp(request);
  if (!rateLimit(`chat:${ip}`, 40, 10 * 60 * 1000)) return json({ error: 'rate_limited' }, 429);
  if (!process.env.ANTHROPIC_API_KEY) return json({ error: 'not_configured' }, 503);

  const raw = await request.text();
  if (raw.length > MAX_BODY) return json({ error: 'too_large' }, 413);
  let body;
  try { body = JSON.parse(raw); } catch { return json({ error: 'bad_json' }, 400); }
  const messages = body.messages;
  if (!validHistory(messages)) return json({ error: 'bad_history' }, 400);
  const lang = body.lang === 'en' ? 'en' : 'fr';

  const { date, weekday } = todayMontreal();
  const system = [
    { type: 'text', text: systemPrompt(), cache_control: { type: 'ephemeral' } },
    { type: 'text', text: `Today in Montréal: ${weekday} ${date}. Site language: ${lang === 'fr' ? 'French' : 'English'}.` },
  ];

  const ctx = { ip, booking: null };
  const history = [...messages];
  try {
    for (let step = 0; step < 6; step++) {
      const response = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 4000,
        output_config: { effort: 'low' },
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system,
        tools,
        messages: history,
      });
      history.push({ role: 'assistant', content: response.content });

      if (response.stop_reason === 'refusal') {
        return json({ messages: history, reply: lang === 'fr' ? `Je ne peux pas aider avec ça. Pour toute question, appelez l’atelier au 514-466-9693.` : `I can't help with that. For any question, call the shop at 514-466-9693.`, booking: ctx.booking });
      }
      if (response.stop_reason === 'pause_turn') continue;
      if (response.stop_reason !== 'tool_use') {
        const reply = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
        return json({ messages: history, reply, booking: ctx.booking });
      }
      const results = [];
      for (const block of response.content) {
        if (block.type !== 'tool_use') continue;
        const content = await runTool(block.name, block.input, ctx);
        results.push({ type: 'tool_result', tool_use_id: block.id, content, is_error: content.includes('"error"') || undefined });
      }
      history.push({ role: 'user', content: results });
    }
    return json({ messages: history, reply: lang === 'fr' ? 'Désolé, je n’ai pas pu terminer. Appelez-nous au 514-466-9693.' : 'Sorry, I could not finish. Call us at 514-466-9693.', booking: ctx.booking });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return json({ error: 'busy' }, 429);
    if (err instanceof Anthropic.BadRequestError) { console.error('claude 400', err.message); return json({ error: 'bad_request' }, 400); }
    if (err instanceof Anthropic.AuthenticationError) { console.error('claude auth'); return json({ error: 'not_configured' }, 503); }
    if (err instanceof Anthropic.APIError) { console.error('claude', err.status, err.message); return json({ error: 'upstream' }, 502); }
    console.error('chat failed', err);
    return json({ error: 'server' }, 500);
  }
}
