const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
for(const version of ['v1','v2']) {
 const w=JSON.parse(fs.readFileSync(path.join(__dirname,`../workflow/kesar-support-${version}.json`),'utf8'));
 test(`${version} workflow references real nodes and contains two agent tools`,()=>{
   const names=new Set(w.nodes.map(n=>n.name));
   for(const [from,types] of Object.entries(w.connections)){assert.ok(names.has(from)); for(const groups of Object.values(types))for(const group of groups)for(const link of group)assert.ok(names.has(link.node));}
   assert.equal(w.connections.get_order.ai_tool[0][0].node,'Support Agent');
   assert.equal(w.connections.search_faq.ai_tool[0][0].node,'Support Agent');
 });
 test(`${version} all embedded JavaScript compiles`,()=>{
   for(const n of w.nodes.filter(n=>n.parameters.jsCode)) assert.doesNotThrow(()=>new Function(n.parameters.jsCode),n.name);
 });
 test(`${version} Sheets upserts stable IDs and writes RAW values`,()=>{
   for(const n of w.nodes.filter(n=>n.type==='n8n-nodes-base.googleSheets'&&n.parameters.operation==='appendOrUpdate')){
     assert.equal(n.parameters.options.cellFormat,'RAW');assert.equal(n.parameters.columns.matchingColumns.length,1);
   }
   assert.ok(w.nodes.find(n=>n.name==='Write Audit Log').parameters.columns.matchingColumns.includes('email_id'));
   assert.ok(w.nodes.find(n=>n.name==='Upsert Ticket').parameters.columns.matchingColumns.includes('ticket_id'));
 });
}
