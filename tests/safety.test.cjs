const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeEmail, validateClassification, parseClassification, fallbackClassification, resolveOrder, assessCase, chooseTicket } = require('../code/core.cjs');
const emails = require('../data/test_emails.json').emails;
const orders = require('../data/orders.json').orders;
const email = id => normalizeEmail(emails.find(e=>e.id === id));
const classification = (intent, order_id = null, secondary_intent = null) => ({ intent, secondary_intent, order_id, sentiment:'neutral', language:'en', confidence:0.95, summary:'Customer requests support.' });
function evaluate(id, intent, orderId, secondary) { const e=email(id), c=classification(intent,orderId,secondary), lookup=resolveOrder(e,c,orders); return { e,c,lookup,assessment:assessCase(e,c,lookup) }; }

test('All 25 supplied payloads normalize',()=>assert.equal(emails.map(normalizeEmail).length,25));
test('Schema fallback is valid, malformed classifications are rejected',()=>{
  assert.deepEqual(validateClassification(fallbackClassification()),[]);
  for(const c of [null,[],{}, {...classification('other'),confidence:'0.9'}, {...classification('other'),confidence:NaN},{...classification('other'),secondary_intent:undefined},{...classification('other'),order_id:'KC-12'}, {...classification('other'),summary:'x'.repeat(201)}]) assert.ok(validateClassification(c).length);
  assert.equal(parseClassification('not json').valid,false);
});
test('Spouse request never receives an order record',()=>{
  const c=evaluate('E07','order_status','KC-1046');
  assert.equal(c.lookup.status,'identity_mismatch'); assert.equal(c.lookup.order,null); assert.ok(c.assessment.needs_human);
});
test('Lookup falls back to the actual sender only when no ID is present',()=>{
  assert.equal(evaluate('E10','order_status',null).lookup.order.order_id,'KC-1044');
  assert.equal(evaluate('E22','order_status','KC-1099').lookup.status,'not_found');
  assert.equal(evaluate('E01','order_status','KC-1046').lookup.status,'untrusted_order_id');
});
test('Authorized tool data excludes street addresses',()=>assert.equal(evaluate('E01','order_status','KC-1041').lookup.order.shipping_address,undefined));
test('Return decision uses email timestamp, not current date',()=>{
  const c=evaluate('E03','return_refund','KC-1047');
  assert.equal(c.assessment.policy.days_since_delivery,4);
  assert.equal(c.assessment.policy.eligibility,'potentially_eligible_pending_inspection');
  assert.equal(c.assessment.policy.non_refundable_fees,79);
});
test('Complete kits must stay complete',()=>assert.equal(evaluate('E11','return_refund','KC-1048').assessment.policy.complete_kit_required,true));
test('Used products are not eligible; injection cannot skip ticket creation',()=>{
  const c=evaluate('E12','return_refund','KC-1055');
  assert.equal(c.assessment.policy.eligibility,'ineligible_opened_or_used'); assert.ok(c.assessment.injection); assert.ok(c.assessment.needs_ticket); assert.equal(c.assessment.priority,'High');
});
test('An injection misclassified as other still creates a manual refund ticket',()=>{
  const c=evaluate('E12','other',null);
  assert.ok(c.assessment.needs_ticket); assert.equal(c.assessment.priority,'High'); assert.ok(c.assessment.needs_human);
});
test('Damage uses its separate 48-hour rule and needs evidence verification',()=>{
  const c=evaluate('E04','complaint','KC-1052');
  assert.equal(c.assessment.policy.eligibility,'within_reporting_window_pending_verification'); assert.equal(c.assessment.policy.photos_verified,false);
  const boundary={...c.e,received_at:'2026-11-21T10:00:00+05:30'};
  assert.equal(assessCase(boundary,c.c,c.lookup).policy.eligibility,'exact_delivery_time_required');
});
test('COD return excludes handling fee and postpones bank details',()=>{
  const p=evaluate('E19','return_refund','KC-1050').assessment.policy;
  assert.equal(p.refundable_product_subtotal,1648); assert.equal(p.non_refundable_fees,49); assert.match(p.refund_method,/only after pickup/);
});
test('Medical cure requests are escalated',()=>assert.ok(evaluate('E20','product_query',null).assessment.medical));
test('Secondary return/complaint needs still create tickets',()=>assert.ok(evaluate('E08','return_refund','KC-1051','complaint').assessment.needs_ticket));
test('Follow-up adds email to the same ticket; retry is idempotent',()=>{
  const a=evaluate('E04','complaint','KC-1052'), b=evaluate('E21','complaint','KC-1052');
  const first=chooseTicket([],a.e,a.c,a.lookup,a.assessment,'2026-11-24').ticket;
  const second=chooseTicket([first],b.e,b.c,b.lookup,b.assessment,'2026-11-24').ticket;
  assert.equal(second.ticket_id,first.ticket_id); assert.equal(second.email_ids,'E04,E21');
  const retry=chooseTicket([second],b.e,b.c,b.lookup,b.assessment,'2026-11-24').ticket;
  assert.equal(retry.notes,second.notes); assert.equal(retry.email_ids,second.email_ids);
});
test('Unverified sender cannot attach to an existing customer ticket',()=>{
  const c=evaluate('E07','complaint','KC-1046');
  const row={ticket_id:'TKT-SECRET',order_id:'KC-1046',customer_email:'meera.iyer@example.com',status:'Open',email_ids:'X'};
  const result=chooseTicket([row],c.e,c.c,c.lookup,c.assessment,'2026-11-24').ticket;
  assert.notEqual(result.ticket_id,'TKT-SECRET'); assert.equal(result.order_id,'');
});
