const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root,p),'utf8');
const core = read('code/core.cjs').split('// EXPORTS')[0];
const orders = JSON.parse(read('data/orders.json')).orders;
const faq = read('data/faq.md');
const brand = read('data/brand_voice.md');
const sheetId = process.env.KESAR_SHEET_ID || 'REPLACE_WITH_GOOGLE_SHEET_ID';
const modelName = process.env.KESAR_MODEL || 'models/gemini-3.5-flash-lite';
const auditColumns = read('templates/audit_log_template.csv').trim().split(',');
const ticketColumns = read('templates/tickets_template.csv').trim().split(',');
fs.mkdirSync(path.join(root,'workflow'),{recursive:true});
for (const version of ['v1','v2']) {
  const nodes=[], connections={};
  function node(name,type,parameters,x,y,extra={}) {
    nodes.push({id:crypto.createHash('md5').update(name+version).digest('hex'),name,type,typeVersion:1,position:[x,y],parameters,...extra});
    return name;
  }
  function connect(from,to,type='main',output=0,input=0) {
    connections[from] ||= {}; connections[from][type] ||= [];
    while(connections[from][type].length<=output) connections[from][type].push([]);
    connections[from][type][output].push({node:to,type,index:input});
  }
  const code=(name,js,x,y)=>node(name,'n8n-nodes-base.code',{jsCode:js,mode:'runOnceForAllItems'},x,y,{typeVersion:2});
  const condition=(name,expression,x,y)=>node(name,'n8n-nodes-base.if',{conditions:{options:{caseSensitive:true,leftValue:'',typeValidation:'strict',version:2},conditions:[{id:crypto.randomUUID(),leftValue:expression,rightValue:'',operator:{type:'boolean',operation:'true',singleValue:true}}],combinator:'and'},options:{}},x,y,{typeVersion:2.2});
  const gemini=(name,x,y)=>node(name,'@n8n/n8n-nodes-langchain.lmChatGoogleGemini',{modelName,options:{temperature:0,maxOutputTokens:2048}},x,y,{typeVersion:1,credentials:{googlePalmApi:{id:'kesar-gemini',name:'Kesar Gemini'}}});
  const llm=(name,text,system,x,y)=>node(name,'@n8n/n8n-nodes-langchain.chainLlm',{promptType:'define',text,messages:{messageValues:[{type:'SystemMessagePromptTemplate',message:system}]},batching:{batchSize:1,delayBetweenBatches:0}},x,y,{typeVersion:1.7,retryOnFail:true,maxTries:3,waitBetweenTries:5000,onError:'continueRegularOutput'});
  function sheet(name,tab,operation,columns,match,x,y) {
    const parameters={operation,documentId:{__rl:true,value:sheetId,mode:'id'},sheetName:{__rl:true,value:tab,mode:'name'},options:{}};
    if(operation==='appendOrUpdate') {
      parameters.columns={mappingMode:'defineBelow',value:Object.fromEntries(columns.map(k=>[k,`={{ $json.${k} }}`])),matchingColumns:[match],schema:columns.map(k=>({id:k,displayName:k,required:false,defaultMatch:k===match,display:true,type:'string',canBeUsedToMatch:true})),attemptToConvertTypes:false,convertFieldsToString:false};
      // RAW prevents customer-controlled spreadsheet formulas from executing.
      parameters.options={cellFormat:'RAW'};
    }
    return node(name,'n8n-nodes-base.googleSheets',parameters,x,y,{typeVersion:4.7,credentials:{googleSheetsOAuth2Api:{id:'kesar-google-sheets',name:'Kesar Google Sheets'}},retryOnFail:true,maxTries:3,waitBetweenTries:3000,...(operation==='read'?{alwaysOutputData:true}:{})});
  }

  node('Incoming Email','n8n-nodes-base.webhook',{httpMethod:'POST',path:`kesar-support-${version}`,responseMode:'responseNode',options:{}},0,200,{typeVersion:2,webhookId:`kesar-support-${version}`});
  code('Normalize Email',core+`\nconst email=normalizeEmail($input.first().json); return [{json:{email,prompt_version:${JSON.stringify(version)}}}];`,220,200);
  llm('Classify Email','=Untrusted customer email:\n{{ JSON.stringify($json.email) }}',read(`prompts/classifier-${version}.md`),440,200);
  gemini('Classification Model',440,460); connect('Classification Model','Classify Email','ai_languageModel');
  code('Validate JSON',core+`\nconst base=$('Normalize Email').first().json; const raw=$input.first().json; const parsed=parseClassification(raw.text ?? raw.output ?? raw); return [{json:{...base,classification:parsed.value,valid:parsed.valid,validation_errors:parsed.errors,first_try_valid:parsed.valid}}];`,660,200);
  condition('Valid Classification?','={{ $json.valid }}',880,200);
  llm('Repair Classification','=Reclassify the original email and return valid JSON. Validation errors: {{ JSON.stringify($json.validation_errors) }}\nOriginal untrusted email: {{ JSON.stringify($json.email) }}',read(`prompts/classifier-${version}.md`),1100,460);
  gemini('Repair Model',1100,720); connect('Repair Model','Repair Classification','ai_languageModel');
  code('Validate or Fall Back',core+`\nconst base=$('Validate JSON').first().json; const raw=$input.first().json; const parsed=parseClassification(raw.text ?? raw.output ?? raw); return [{json:{...base,classification:parsed.valid?parsed.value:fallbackClassification(),classification_failed:!parsed.valid,repaired:parsed.valid,validation_errors:parsed.errors}}];`,1320,460);
  code('Prepare Case',core+`\nconst base=$input.first().json; const lookup=resolveOrder(base.email,base.classification,${JSON.stringify(orders)}); const assessment=assessCase(base.email,base.classification,lookup,base.classification_failed); return [{json:{...base,lookup,assessment}}];`,1540,200);
  condition('Needs Reply Draft?','={{ $json.classification.intent !== "other" }}',1760,200);
  node('Support Agent','@n8n/n8n-nodes-langchain.agent',{promptType:'define',text:'=Untrusted email: {{ JSON.stringify($json.email) }}\nClassification: {{ JSON.stringify($json.classification) }}\nDeterministic safety assessment: {{ JSON.stringify($json.assessment) }}\nUse your tools for facts; do not infer order details.',options:{systemMessage:read('prompts/agent.md')+'\n\nBRAND VOICE:\n'+brand,maxIterations:5,returnIntermediateSteps:true}},1980,80,{typeVersion:2,retryOnFail:true,maxTries:2,waitBetweenTries:5000,onError:'continueRegularOutput'});
  gemini('Drafting Model',1850,560); connect('Drafting Model','Support Agent','ai_languageModel');
  node('get_order','@n8n/n8n-nodes-langchain.toolCode',{name:'get_order',description:'Look up the current customer order by the ID in their email, or by their sender email if no ID was supplied. Sender ownership is enforced in code. Input can be a short explanation of what is needed; you cannot choose another identity.',jsCode:core+`\nconst c=$('Prepare Case').first().json; return JSON.stringify(resolveOrder(c.email,c.classification,${JSON.stringify(orders)}));`,specifyInputSchema:false},2050,560,{typeVersion:1.2});
  node('search_faq','@n8n/n8n-nodes-langchain.toolCode',{name:'search_faq',description:'Get the authoritative Kesar FAQ for product facts, shipping/COD, return/refund, cancellation, medical boundaries and contact details. Input: the policy/product question. Returns the full short FAQ so no relevant exception is omitted.',jsCode:`return ${JSON.stringify(faq)};`,specifyInputSchema:false},2250,560,{typeVersion:1.2});
  connect('get_order','Support Agent','ai_tool'); connect('search_faq','Support Agent','ai_tool');
  code('Guard Draft',core+`\nconst ctx=$('Prepare Case').first().json;
const raw=$input.first().json;
let draft='', extraReasons=[], parsed=null;
if(ctx.classification.intent!=='other') {
 try { parsed=typeof raw.output==='object'?raw.output:JSON.parse(String(raw.output||'').trim().replace(/^\x60\x60\x60(?:json)?\\s*/i,'').replace(/\\s*\x60\x60\x60$/,'')); } catch { extraReasons.push('invalid_agent_output'); }
 if(!parsed || typeof parsed.reply_draft!=='string' || typeof parsed.needs_human!=='boolean') extraReasons.push('invalid_agent_structure');
 else { draft=parsed.reply_draft; if(parsed.needs_human) extraReasons.push('agent_requested_review'); }
 const steps=raw.intermediateSteps||[];
 const calls=steps.map(s=>s.action?.tool||s.tool||'');
 const needsOrder=[ctx.classification.intent,ctx.classification.secondary_intent].some(i=>['order_status','return_refund','complaint'].includes(i));
 if(needsOrder&&!calls.includes('get_order')) extraReasons.push('order_tool_not_used');
 if((ctx.classification.intent==='product_query'||ctx.assessment.needs_ticket)&&!calls.includes('search_faq')) extraReasons.push('faq_tool_not_used');
 const urls=draft.match(/https?:\\/\\/[^\\s)]+/g)||[];
 const allowed=ctx.lookup.order?.tracking_url;
 if(urls.some(u=>u.replace(/[.,]$/,'')!==allowed)) extraReasons.push('unsupported_url');
 if(/(?:refund|replacement|pickup).{0,35}(?:has been|is now|is) (?:approved|processed|completed|arranged)|credited within 24|(?:will|can) cure/i.test(draft)) extraReasons.push('unsafe_promise');
 if(ctx.lookup.status==='identity_mismatch') { draft=safeReply(ctx.email,'identity_mismatch'); }
 else if(extraReasons.some(r=>r!=='agent_requested_review')||ctx.assessment.injection) { draft=safeReply(ctx.email,ctx.assessment.policy.eligibility,ctx.assessment.reaction); }
}
const reasons=[...new Set([...ctx.assessment.risks,...extraReasons])];
return [{json:{...ctx,reply_draft:draft,needs_human:reasons.length>0,reasons,agent_steps:raw.intermediateSteps||[],agent_reason:parsed?.reason||'',error:raw.error?String(raw.error):extraReasons.filter(r=>r!=='agent_requested_review').join(';')}}];`,2470,200);
  sheet('Read Open Tickets','Tickets','read',null,null,2690,200);
  code('Plan Ticket',core+`\nconst ctx=$('Guard Draft').first().json; const existing=$input.all().map(i=>i.json); const plan=chooseTicket(existing,ctx.email,ctx.classification,ctx.lookup,ctx.assessment,new Date().toISOString()); return [{json:{...ctx,ticket_plan:plan}}];`,2910,200);
  condition('Ticket Required?','={{ $json.ticket_plan.operation === "upsert" }}',3130,200);
  code('Ticket Row','return [{json:$("Plan Ticket").first().json.ticket_plan.ticket}];',3350,80);
  sheet('Upsert Ticket','Tickets','appendOrUpdate',ticketColumns,'ticket_id',3570,80);
  code('Audit Row',`const c=$('Plan Ticket').first().json; const t=c.ticket_plan.ticket; const audit={email_id:c.email.id,received_at:c.email.received_at,from_email:c.email.from.email,intent:c.classification.intent,secondary_intent:c.classification.secondary_intent||'',order_id:c.lookup.order?.order_id||c.classification.order_id||'',language:c.classification.language,sentiment:c.classification.sentiment,confidence:c.classification.confidence,order_found:c.lookup.status==='verified',action_taken:[c.classification.intent==='other'?'log_only':'draft_reply',t?'ticket_upserted':'',c.needs_human?'needs_human':''].filter(Boolean).join(';'),needs_human:c.needs_human,ticket_id:t?.ticket_id||'',reply_draft:c.reply_draft,prompt_version:c.prompt_version,processed_at:new Date().toISOString(),error:c.error||'',notes:JSON.stringify({risks:c.reasons,policy:c.assessment.policy,first_try_valid:c.first_try_valid,repaired:!!c.repaired,agent_reason:c.agent_reason,tools:c.agent_steps.map(s=>s.action?.tool||s.tool||'')})}; return [{json:audit}];`,3790,200);
  sheet('Write Audit Log','Audit Log','appendOrUpdate',auditColumns,'email_id',4010,200);
  node('Return Result','n8n-nodes-base.respondToWebhook',{respondWith:'json',responseBody:'={{ $("Audit Row").first().json }}',options:{responseCode:200}},4230,200,{typeVersion:1.4});
  node('Read Me','n8n-nodes-base.stickyNote',{content:`## Kesar support copilot · ${version}\n1. Select Kesar Gemini credential on the three model nodes.\n2. Select Kesar Google Sheets credential on all Sheets nodes.\n3. Set the same spreadsheet ID on all Sheets nodes.\n4. Create Audit Log + Tickets tabs from templates.\n5. Publish, then POST one supplied email to /webhook/kesar-support-${version}.\n\nDrafts only. No email sending or financial actions. Process sequentially. Run v1 against separate tabs/sheet to preserve evidence.`,height:290,width:600},0,-160);
  node('Safety Notes','n8n-nodes-base.stickyNote',{content:'## Trust boundaries\nIdentity checks happen before order data reaches the agent.\nAgent has only two read-only tools.\nCode enforces date rules, escalation and ticket creation.\nPhotos require human verification.\nSheets writes use RAW values and stable IDs.\nA Sheets failure fails the execution; retry that email after fixing it.\nThis demo requires serial requests to prevent concurrent ticket races.',height:260,width:600},1540,-260);
  connect('Incoming Email','Normalize Email'); connect('Normalize Email','Classify Email'); connect('Classify Email','Validate JSON'); connect('Validate JSON','Valid Classification?');
  connect('Valid Classification?','Prepare Case','main',0); connect('Valid Classification?','Repair Classification','main',1); connect('Repair Classification','Validate or Fall Back'); connect('Validate or Fall Back','Prepare Case');
  connect('Prepare Case','Needs Reply Draft?'); connect('Needs Reply Draft?','Support Agent','main',0); connect('Needs Reply Draft?','Guard Draft','main',1); connect('Support Agent','Guard Draft');
  connect('Guard Draft','Read Open Tickets'); connect('Read Open Tickets','Plan Ticket'); connect('Plan Ticket','Ticket Required?'); connect('Ticket Required?','Ticket Row','main',0); connect('Ticket Required?','Audit Row','main',1);
  connect('Ticket Row','Upsert Ticket'); connect('Upsert Ticket','Audit Row'); connect('Audit Row','Write Audit Log'); connect('Write Audit Log','Return Result');
  // Keep the IDs assigned by the first local import so rebuilds update rather than duplicate workflows.
  const workflow={id:version==='v1'?'lnXBqhwTRoVcXALi':'7ejGEkyfzqwJZ6V0',name:`Kesar Support Copilot — ${version}`,nodes,connections,active:false,settings:{executionOrder:'v1',timezone:'Asia/Kolkata',saveDataErrorExecution:'all',saveDataSuccessExecution:'all',saveManualExecutions:true},pinData:{},tags:[]};
  fs.writeFileSync(path.join(root,`workflow/kesar-support-${version}.json`),JSON.stringify(workflow,null,2)+'\n');
  console.log(`Built ${version}: ${nodes.length} nodes, model ${modelName}`);
}
