// Only a feasibility test server. No ERP imports, financial posting or real booking.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
const assets = fileURLToPath(new URL('.', import.meta.url));
const digest = text => createHash('sha256').update(text).digest('hex');
export async function startProofServer(filename, port=0) {
  const db = new DatabaseSync(filename);
  db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS receipts(company TEXT,id TEXT,hash TEXT,result TEXT,PRIMARY KEY(company,id)); CREATE TABLE IF NOT EXISTS notes(company TEXT,id TEXT,version INTEGER,text TEXT,attachment TEXT,PRIMARY KEY(company,id)); CREATE TABLE IF NOT EXISTS slots(company TEXT PRIMARY KEY,remaining INTEGER); CREATE TABLE IF NOT EXISTS actors(id TEXT PRIMARY KEY,company TEXT,branch TEXT,active INTEGER);');
  for (const [id,company,branch] of [['a','company-a','branch-a'],['b','company-a','branch-a'],['other','company-b','branch-b']]) db.prepare('INSERT OR IGNORE INTO actors VALUES(?,?,?,1)').run(id,company,branch);
  db.prepare('INSERT OR IGNORE INTO slots VALUES(?,1)').run('company-a');
  const faults = {dropAfterCommit:new Set(),failDuringTransaction:new Set()};
  const json = (res,status,value) => {res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(value));};
  function apply(command, actorId) {
    const actor = db.prepare('SELECT * FROM actors WHERE id=?').get(actorId);
    if (!actor?.active || command.userId!==actor.id || command.companyId!==actor.company || command.branchId!==actor.branch) return {status:403,result:{reason:'AUTHORIZATION_REJECTED'}};
    if (typeof command.id!=='string'||!command.id||!['NOTE','SLOT'].includes(command.kind)||typeof command.recordId!=='string'||!Number.isSafeInteger(command.expectedVersion)||typeof command.text!=='string') return {status:400,result:{reason:'INVALID_COMMAND'}};
    const requestHash = digest(JSON.stringify(command));
    const prior = db.prepare('SELECT * FROM receipts WHERE company=? AND id=?').get(actor.company,command.id);
    if(prior) return prior.hash===requestHash ? {status:200,result:JSON.parse(prior.result)} : {status:409,result:{reason:'IDEMPOTENCY_PAYLOAD_MISMATCH'}};
    if(command.attachment && digest(command.attachment)!==command.attachmentHash) return {status:422,result:{reason:'ATTACHMENT_CHECKSUM'}};
    db.exec('BEGIN IMMEDIATE');
    try {
      let result;
      if(command.kind==='SLOT') {
        const changed=db.prepare('UPDATE slots SET remaining=remaining-1 WHERE company=? AND remaining>0').run(actor.company);
        result={outcome:changed.changes===1?'CONFIRMED':'WAITLIST'};
      } else {
        const note=db.prepare('SELECT * FROM notes WHERE company=? AND id=?').get(actor.company,command.recordId);
        if((note?.version || 0)!==command.expectedVersion) {db.exec('ROLLBACK');return {status:409,result:{reason:'VERSION_CONFLICT',currentVersion:note?.version || 0}};}
        const version=command.expectedVersion+1;
        db.prepare('INSERT INTO notes VALUES(?,?,?,?,?) ON CONFLICT(company,id) DO UPDATE SET version=excluded.version,text=excluded.text,attachment=excluded.attachment').run(actor.company,command.recordId,version,command.text,command.attachment);
        result={outcome:'SAVED',version};
      }
      if(faults.failDuringTransaction.delete(command.id)) throw new Error('Injected transaction failure after write');
      db.prepare('INSERT INTO receipts VALUES(?,?,?,?)').run(actor.company,command.id,requestHash,JSON.stringify(result));
      db.exec('COMMIT');
      return {status:200,result};
    } catch(error) {db.exec('ROLLBACK');throw error;}
  }
  const server=createServer(async(req,res)=>{
    if(req.method==='POST'&&req.url==='/api/proof/operations') {
      try {
        let body='';for await(const chunk of req){body+=chunk;if(body.length>1500000){json(res,413,{reason:'TOO_LARGE'});return;}}
        const command=JSON.parse(body);
        const result=apply(command,req.headers['x-proof-actor']);
        if(result.status===200&&faults.dropAfterCommit.delete(command.id)){req.socket.destroy();return;}
        json(res,result.status,result.result);
      } catch {json(res,500,{reason:'PROOF_SERVER_FAILURE'});}
      return;
    }
    const paths={'/':'index.html','/browser-client.mjs':'browser-client.mjs','/register-worker.mjs':'register-worker.mjs','/service-worker.mjs':'service-worker.mjs'};
    const path=paths[req.url];
    if(req.method!=='GET'||!path){json(res,404,{reason:'NOT_FOUND'});return;}
    res.writeHead(200,{'content-type':path.endsWith('.html')?'text/html; charset=utf-8':'text/javascript; charset=utf-8','cache-control':'no-store'});res.end(await readFile(join(assets,path)));
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  return {url:'http://127.0.0.1:'+server.address().port,port:server.address().port,faults,
    revoke(id){db.prepare('UPDATE actors SET active=0 WHERE id=?').run(id);},
    snapshot(){return {receipts:db.prepare('SELECT * FROM receipts').all(),notes:db.prepare('SELECT * FROM notes').all(),slots:db.prepare('SELECT * FROM slots').all()};},
    async close(){await new Promise(resolve=>server.close(resolve));db.close();}
  };
}
