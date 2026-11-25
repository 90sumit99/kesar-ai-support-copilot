'use strict';

// These functions run both in n8n Code nodes and the local safety tests.
const INTENTS = ['order_status', 'product_query', 'return_refund', 'complaint', 'other'];
function validateClassification(value) {
  const errors = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ['Expected a JSON object'];
  if (!INTENTS.includes(value.intent)) errors.push('Invalid intent');
  if (value.secondary_intent !== null && !INTENTS.includes(value.secondary_intent)) errors.push('Invalid secondary_intent');
  if (value.order_id !== null && (typeof value.order_id !== 'string' || !/^KC-\d{4}$/.test(value.order_id))) errors.push('Invalid order_id');
  if (!['positive', 'neutral', 'negative', 'angry'].includes(value.sentiment)) errors.push('Invalid sentiment');
  if (!['en', 'hi', 'hinglish'].includes(value.language)) errors.push('Invalid language');
  if (typeof value.confidence !== 'number' || !Number.isFinite(value.confidence) || value.confidence < 0 || value.confidence > 1) errors.push('Invalid confidence');
  if (typeof value.summary !== 'string' || value.summary.length > 200) errors.push('Invalid summary');
  return errors;
}
function parseClassification(raw) {
  try {
    const value = typeof raw === 'string' ? JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')) : raw;
    const errors = validateClassification(value);
    return { valid: errors.length === 0, value, errors };
  } catch { return { valid: false, value: null, errors: ['Response was not valid JSON'] }; }
}
function fallbackClassification() {
  return { intent: 'other', secondary_intent: null, order_id: null, sentiment: 'neutral', language: 'en', confidence: 0, summary: 'Classification failed; human triage required.' };
}
function normalizeEmail(input) {
  const e = input.body && typeof input.body === 'object' ? input.body : input;
  if (!e || typeof e.id !== 'string' || !/^[-\w]{1,100}$/.test(e.id) || !e.from || typeof e.from.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.from.email) || typeof e.body !== 'string' || typeof e.subject !== 'string' || !Number.isFinite(Date.parse(e.received_at))) throw new Error('Invalid email input: id, sender, subject, body and received_at are required.');
  if (e.body.length > 30000 || e.subject.length > 1000) throw new Error('Email exceeds the supported size; manual intake required.');
  return { id: e.id, received_at: e.received_at, from: { name: String(e.from.name || 'there').slice(0,100), email: e.from.email.trim().toLowerCase() }, subject: e.subject, body: e.body, attachments: Array.isArray(e.attachments) ? e.attachments.map(String) : [] };
}
function resolveOrder(email, classification, orders) {
  // Bind identity to the trusted workflow input, never to agent-supplied arguments.
  const ids = [...new Set((email.subject + '\n' + email.body).match(/\bKC-\d{4}\b/g) || [])];
  if (ids.length > 1) return { status: 'ambiguous', order: null };
  const mentioned = ids[0] || null;
  if (classification.order_id && classification.order_id !== mentioned) return { status: 'untrusted_order_id', order: null };
  const matches = mentioned ? orders.filter(o => o.order_id === mentioned) : orders.filter(o => o.customer_email.toLowerCase() === email.from.email);
  if (matches.length !== 1) return { status: matches.length ? 'ambiguous' : 'not_found', order: null };
  const order = matches[0];
  if (order.customer_email.toLowerCase() !== email.from.email) return { status: 'identity_mismatch', order: null };
  // Deliberately omit street address and other customers' data from all tool results.
  const { shipping_address, ...safeOrder } = order;
  return { status: 'verified', order: safeOrder };
}
function assessCase(email, c, lookup, classificationFailed = false) {
  const text = email.subject + '\n' + email.body;
  const risks = [];
  const intents = [c.intent, c.secondary_intent];
  const injection = /ignore (?:all |any )?(?:previous|prior)|system (?:note|prompt)|do not create (?:any |a )?ticket|set priority|developer message/i.test(text);
  const medical = /eczema|psoriasis|pregnan|allerg|reaction|rash|cure|treat.*(?:acne|condition)/i.test(text);
  const reaction = /reaction|rash|burning|swelling/i.test(text);
  const damage = /crack(?:ed)?|leak(?:ed|ing)?|damaged|wrong item|wrong.*deliver|missing|spilled/i.test(text);
  const used = /\b(?:used|using|opened)\b/i.test(text.replace(/\b(?:unused|unopened|never opened|not opened)\b/gi, ''));
  const sealed = /unopened|unused|still sealed|never opened|seals? intact/i.test(text);
  const needsOrder = intents.some(i => ['order_status','return_refund','complaint'].includes(i));
  if (classificationFailed) risks.push('classification_failed');
  if (c.confidence < 0.85) risks.push('low_confidence');
  if (injection) risks.push('prompt_injection');
  if (medical) risks.push('medical_question');
  if (c.sentiment === 'angry') risks.push('angry_customer');
  if (needsOrder && lookup.status !== 'verified') risks.push(lookup.status);
  const needsTicket = intents.some(i => ['return_refund','complaint'].includes(i)) || (injection && /\breturn|\brefund/i.test(text));
  if (needsTicket) risks.push('human_approval_required');
  const policy = { type: damage ? 'damage_wrong_missing' : 'standard_return', eligibility: 'not_applicable', days_since_delivery: null, timing_note: '' };
  const order = lookup.order;
  if (needsTicket && order) {
    if (!order.delivered_date) policy.eligibility = 'delivery_not_confirmed';
    else {
      const received = new Date(email.received_at);
      const istDate = new Date(received.getTime() + 330 * 60000).toISOString().slice(0,10);
      const days = Math.round((Date.parse(istDate) - Date.parse(order.delivered_date)) / 86400000);
      policy.days_since_delivery = days;
      if (days < 0) policy.eligibility = 'inconsistent_dates';
      else if (damage) {
        const earliestDelivery = Date.parse(order.delivered_date + 'T00:00:00+05:30');
        const maxHours = (received.getTime() - earliestDelivery) / 3600000;
        const minHours = Math.max(0, maxHours - 24);
        policy.eligibility = maxHours <= 48 ? 'within_reporting_window_pending_verification' : minHours >= 48 ? 'outside_reporting_window' : 'exact_delivery_time_required';
        policy.timing_note = 'Delivery has a date but no time. The 48-hour boundary requires human verification when uncertain.';
        policy.attachments_present = email.attachments.length > 0;
        policy.photos_verified = false;
      } else {
        policy.eligibility = used ? 'ineligible_opened_or_used' : days > 7 ? 'ineligible_outside_7_days' : sealed ? 'potentially_eligible_pending_inspection' : 'item_condition_required';
        policy.complete_kit_required = order.items.some(i => /kit|combo/i.test(i.name));
        policy.refund_method = order.payment_method === 'cod' ? 'UPI or bank transfer, details collected only after pickup' : 'Original payment method after quality check';
        policy.refundable_product_subtotal = order.subtotal;
        policy.non_refundable_fees = order.shipping_fee + order.cod_fee;
        policy.timing_note = '7-day eligibility uses IST calendar dates; physical condition and final approval remain manual.';
      }
    }
  }
  if (c.intent === 'other' && !/selected|ranking|collab|collaboration|thank you/i.test(text)) risks.push('uncovered_request');
  if (c.intent === 'product_query' && /GST|invoice/i.test(text)) risks.push('uncovered_request');
  return { needs_human: risks.length > 0, risks: [...new Set(risks)], needs_ticket: needsTicket, priority: intents.includes('complaint') || c.sentiment === 'angry' || injection || medical || damage ? 'High' : 'Medium', policy, medical, reaction, injection };
}
function safeReply(email, reason, reaction = false) {
  const firstName = email.from.name.split(/\s+/)[0].replace(/[<>\r\n]/g, '') || 'there';
  const text = reason === 'identity_mismatch' ? 'For privacy, please ask the person who placed the order to contact us from their registered email address. We cannot share order details with another email address.' : reaction ? 'Please stop using the product immediately and consult a doctor. A team member will review your concern and follow up within 24 business hours.' : reason === 'ineligible_opened_or_used' ? 'Our return policy does not cover products that have been opened or used, so we cannot approve this return through the standard policy. A team member will review your concern and follow up within 24 business hours.' : 'Your request needs a team member to check it before we can confirm the details. Our team will follow up within 24 business hours.';
  return `Hi ${firstName},\n\n${text}\n\nWarm regards,\nTeam Kesar`;
}
function chooseTicket(existingRows, email, c, lookup, assessment, now) {
  if (!assessment.needs_ticket) return { operation: 'skip', ticket: null };
  const orderId = lookup.order?.order_id || '';
  const open = existingRows.find(t => t.ticket_id && String(t.status).toLowerCase() !== 'closed' && (orderId ? t.order_id === orderId && String(t.customer_email).toLowerCase() === email.from.email : !t.order_id && String(t.customer_email).toLowerCase() === email.from.email));
  const id = open?.ticket_id || `TKT-${email.id}`;
  const emailIds = [...new Set([...(open?.email_ids ? String(open.email_ids).split(',').map(s => s.trim()) : []), email.id])].join(',');
  const alreadyLinked = open && String(open.email_ids).split(',').map(s=>s.trim()).includes(email.id);
  const note = `${email.id}: ${c.summary} | ${assessment.policy.eligibility} | ${assessment.risks.join(', ')}`;
  return { operation: 'upsert', ticket: { ticket_id: id, created_at: open?.created_at || now, updated_at: now, order_id: orderId, customer_email: email.from.email, email_ids: emailIds, intent: open?.intent === 'complaint' || [c.intent,c.secondary_intent].includes('complaint') ? 'complaint' : 'return_refund', priority: open?.priority === 'High' ? 'High' : assessment.priority, status: open?.status || 'Open', summary: open?.summary || c.summary, notes: alreadyLinked ? open.notes : [open?.notes, note].filter(Boolean).join('\n') } };
}

// EXPORTS
module.exports = { validateClassification, parseClassification, fallbackClassification, normalizeEmail, resolveOrder, assessCase, safeReply, chooseTicket };
