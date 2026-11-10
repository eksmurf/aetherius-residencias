'use strict';
const {randomUUID,createHash}=require('node:crypto');
const {fail,uuid,integer}=require('./errors.cjs');
const {instantOffer,tourEligible}=require('./estate-policy.cjs');
const {publicSheet,validateSheet}=require('./amenities.cjs');
const CONTRACT='aetherius-residence-extensions-v1';
function createExtensions({transact,authorize,cityTaxes,runtime=null,features={}}){
  if(runtime && runtime.contract!==CONTRACT)throw Error('Contrato de extensões residenciais incompatível.');
  const sessions=new WeakMap();
  const sessionId=s=>{if(!sessions.has(s.identity))sessions.set(s.identity,randomUUID());return sessions.get(s.identity);};
  const saleAvailable=()=>features.instantSale===true&&typeof runtime?.withTransferBarrier==='function'&&typeof runtime?.creditInstantSaleInTransaction==='function';
  const toursAvailable=()=>features.tours===true&&typeof runtime?.prepareTour==='function'&&typeof runtime?.protectTour==='function'&&typeof runtime?.enterTour==='function'&&typeof runtime?.observeTour==='function'&&typeof runtime?.returnTour==='function'&&typeof runtime?.releaseTour==='function';
  async function rowLock(conn,id){const [rows]=await conn.query('SELECT * FROM aetherius_residences WHERE id=$1 FOR UPDATE',[id]);if(!rows.length)fail('NOT_FOUND');return rows[0];}
  async function owned(conn,s,id,guard){await authorize(conn,s);const row=await rowLock(conn,id);guard(row);if(row.owner_profile_id!==s.profileId||row.owner_account_id!==s.accountId)fail('FORBIDDEN');return row;}
  function saleView(row){return saleAvailable()?instantOffer(row):{eligible:false,reason:'Venda instantânea aguardando integração oficial.'};}
  function tourView(row){return {available:toursAvailable()&&tourEligible(row),reason:row.owner_profile_id!==null?'Imóvel em revenda. Combine uma visita com o proprietário.':!tourEligible(row)?'Imóvel indisponível para visita.':'Visita aguardando validação do interior e da proteção no servidor.'};}
  async function quote(s,input,guard){
    if(!saleAvailable())fail('EXT_UNAVAILABLE');
    return transact(async conn=>{
      const row=await owned(conn,s,input.residenceId,guard), offer=instantOffer(row);
      if(!offer.eligible)fail('INSTANT_INELIGIBLE');
      if(row.access_revision!==input.accessRevision)fail('STALE');
      const id=randomUUID();
      await conn.query(`INSERT INTO aetherius_residence_sale_quotes(id,account_id,profile_id,character_id,session_id,residence_id,access_revision,revision,base,amount,tax,expires_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,clock_timestamp()+interval '2 minutes')`,[id,s.accountId,s.profileId,s.characterId,sessionId(s),row.id,row.access_revision,row.revision,offer.base,offer.amount,JSON.stringify({amount:offer.taxAmount,periods:offer.taxPeriods,dueAt:offer.dueAt})]);
      guard(row);return {...offer,quoteId:id,residenceId:row.id,name:row.definition.name,expiresInSeconds:120};
    });
  }
  async function getQuote(conn,s,input,row){
    const [rows]=await conn.query('SELECT *,clock_timestamp() AS server_now FROM aetherius_residence_sale_quotes WHERE id=$1 FOR UPDATE',[input.quoteId]);const q=rows[0];
    if(!q||q.cancelled||q.account_id!==s.accountId||q.profile_id!==s.profileId||q.character_id!==s.characterId||q.session_id!==sessionId(s)||q.residence_id!==row.id||new Date(q.expires_at).getTime()<=new Date(q.server_now).getTime())fail('QUOTE_EXPIRED');
    const offer=instantOffer(row);
    if(!offer.eligible||q.revision!==row.revision||q.access_revision!==row.access_revision||q.base!==offer.base||q.amount!==offer.amount||q.tax.amount!==offer.taxAmount||q.tax.periods!==offer.taxPeriods||q.tax.dueAt!==offer.dueAt)fail('STALE');
    return q;
  }
  async function arm(s,input,guard){
    if(!saleAvailable())fail('EXT_UNAVAILABLE');
    return transact(async conn=>{
      const row=await owned(conn,s,input.residenceId,guard);await getQuote(conn,s,input,row);
      // Repeated delivery preserves the original deadline; client still displays ten full seconds.
      const [rows]=await conn.query(`UPDATE aetherius_residence_sale_quotes SET ready_at=COALESCE(ready_at,clock_timestamp()+interval '10 seconds') WHERE id=$1 RETURNING ready_at,expires_at`,[input.quoteId]);
      guard(row);return {quoteId:input.quoteId,readyAt:rows[0].ready_at,expiresAt:rows[0].expires_at,waitSeconds:10};
    });
  }
  async function cancel(s,input){return transact(async conn=>{await authorize(conn,s);await conn.query('UPDATE aetherius_residence_sale_quotes SET cancelled=true WHERE id=$1 AND account_id=$2 AND session_id=$3',[input.quoteId,s.accountId,sessionId(s)]);return {cancelled:true};});}
  async function status(s,requestId){return transact(async conn=>{await authorize(conn,s);const [rows]=await conn.query('SELECT result FROM aetherius_residence_extension_operations WHERE account_id=$1 AND profile_id=$2 AND request_id=$3',[s.accountId,s.profileId,requestId]);return rows[0]?.result||null;});}
  async function sell(s,input,guard){
    if(!saleAvailable())fail('EXT_UNAVAILABLE');
    // The official barrier drains storage writes and survives uncertain SQL/native outcomes.
    return runtime.withTransferBarrier({session:s,residenceId:input.residenceId,requestId:input.requestId},()=>transact(async conn=>{
      await conn.query('SELECT pg_advisory_xact_lock(174623,$1)',[s.profileId]);await authorize(conn,s);
      const hash=createHash('sha256').update(JSON.stringify([input.residenceId,input.quoteId])).digest('hex');
      const [old]=await conn.query('SELECT * FROM aetherius_residence_extension_operations WHERE account_id=$1 AND request_id=$2',[s.accountId,input.requestId]);
      if(old.length){if(old[0].profile_id!==s.profileId||old[0].payload_hash!==hash)fail('CONFLICT');return old[0].result;}
      const row=await owned(conn,s,input.residenceId,guard),q=await getQuote(conn,s,input,row);
      if(!q.ready_at||new Date(q.server_now).getTime()<new Date(q.ready_at).getTime())fail('QUOTE_EARLY');
      const id=randomUUID(),withheld=Math.min(q.amount,q.tax.amount),net=q.amount-withheld,result={operationId:id,residenceId:row.id,action:'instantSell',amount:net,gross:q.amount,taxAmount:q.tax.amount,taxWithheld:withheld,taxWaived:Math.max(0,q.tax.amount-withheld),base:q.base,loss:q.base-q.amount,currency:'septims',ownerProfileId:null};
      if(net>0){
        const receipt=await runtime.creditInstantSaleInTransaction(conn,{...s,operationId:id,idempotencyKey:`residence-instant:${id}`,residenceId:row.id,amount:net,currency:'septims',reason:'residence_instant_sale'});
        if(!receipt||receipt.amount!==net||receipt.currency!=='septims'||receipt.accountId!==s.accountId||receipt.characterId!==s.characterId||typeof receipt.transactionId!=='string'||!receipt.transactionId)fail('INSTANT_CREDIT');
        result.transactionId=receipt.transactionId;
      }
      if(q.tax.amount>0){
        const taxId=randomUUID();
        await conn.query(`INSERT INTO aetherius_residence_operations(id,profile_id,account_id,character_id,request_id,action,residence_id,payload_hash,currency,amount,result)
          VALUES($1,$2,$3,$4,$5,'payTax',$6,$7,'septims',$8,$9::jsonb)`,[taxId,s.profileId,s.accountId,s.characterId,randomUUID(),row.id,hash,withheld,JSON.stringify({operationId:taxId,source:'instant-sale-proceeds',saleOperationId:id,amount:withheld,originalDebt:q.tax.amount,waived:Math.max(0,q.tax.amount-withheld)})]);
        await conn.query('INSERT INTO aetherius_residence_tax_receipts(residence_id,due_at,operation_id) VALUES($1,$2,$3)',[row.id,q.tax.dueAt,taxId]);
        await cityTaxes.recordPayment(conn,row,taxId,withheld);
        result.taxOperationId=taxId;
      }
      await conn.query('DELETE FROM aetherius_residence_members WHERE residence_id=$1',[row.id]);
      await conn.query("UPDATE aetherius_residence_keys SET delivery_state='revoked' WHERE residence_id=$1",[row.id]);
      await conn.query(`UPDATE aetherius_residences SET owner_profile_id=NULL,owner_account_id=NULL,locked=true,generation=generation+1,access_revision=access_revision+1,
        for_sale=true,listing_price=NULL,seller_character_id=NULL,tax_due_at=NULL,tax_terms=NULL,updated_at=now() WHERE id=$1`,[row.id]);
      await conn.query('UPDATE aetherius_residence_sale_quotes SET cancelled=true WHERE residence_id=$1',[row.id]);
      await conn.query(`INSERT INTO aetherius_residence_extension_operations(id,account_id,profile_id,character_id,request_id,residence_id,action,payload_hash,result)
        VALUES($1,$2,$3,$4,$5,$6,'instantSell',$7,$8::jsonb)`,[id,s.accountId,s.profileId,s.characterId,input.requestId,row.id,hash,JSON.stringify({...result,acquisition:row.acquisition_history})]);
      guard(row);return result;
    }));
  }
  async function review(s,input,guard){
    if(!uuid(input.requestId)||typeof input.residenceId!=='string'||input.residenceId.length>48)fail('INVALID');
    return transact(async conn=>{
      await authorize(conn,s);
      const [staff]=await conn.query("SELECT id FROM users WHERE id=$1 AND role='superadmin' AND is_banned IS FALSE FOR SHARE",[s.accountId]);if(!staff.length)fail('FORBIDDEN');
      const row=await rowLock(conn,input.residenceId);guard(row);
      const current=row.amenities?.revision||0;
      if(input.expectedRevision!==current||input.sheet?.revision!==current+1)fail('STALE');
      const sheet=validateSheet(input.sheet,row);
      await conn.query('UPDATE aetherius_residences SET amenities=$2::jsonb WHERE id=$1',[row.id,JSON.stringify(sheet)]);
      await conn.query(`INSERT INTO aetherius_residence_extension_operations(id,account_id,profile_id,character_id,request_id,residence_id,action,payload_hash,result)
        VALUES($1,$2,$3,$4,$5,$6,'reviewAmenities',$7,$8::jsonb)`,[randomUUID(),s.accountId,s.profileId,s.characterId,input.requestId,row.id,createHash('sha256').update(JSON.stringify(sheet)).digest('hex'),JSON.stringify({revision:sheet.revision,source:sheet.source,sheet})]);
      guard(row);return publicSheet({...row,amenities:sheet});
    });
  }
  async function beforePurchase(conn,row,input){
    const sheet=publicSheet(row);
    if(features.requireAmenities===true && !sheet.verified)fail('AMENITIES');
    if((input.amenitiesRevision??null)!==sheet.revision)fail('AMENITIES_CHANGED');
    const [tours]=await conn.query("SELECT id FROM aetherius_residence_tours WHERE residence_id=$1 AND state<>'closed'",[row.id]);
    if(tours.length){
      if(typeof runtime?.revokeToursBeforeTransfer!=='function')fail('EXT_UNAVAILABLE');
      // Returns only after interaction guards are installed. Rollback may end a tour, never sell a house.
      await runtime.revokeToursBeforeTransfer(tours.map(t=>t.id));
      await conn.query("UPDATE aetherius_residence_tours SET state='returning',reason='purchase' WHERE residence_id=$1 AND state<>'closed'",[row.id]);
    }
  }
  async function reviewAcquisition(s,input,guard){
    if(!uuid(input.requestId)||!uuid(input.purchaseId)||!integer(input.basePrice)||!integer(input.accessRevision)||
      !['septims','diademas'].includes(input.chain)||typeof input.evidence!=='string'||input.evidence.trim().length<20||input.evidence.length>2000)fail('INVALID');
    return transact(async conn=>{
      await authorize(conn,s);
      const [staff]=await conn.query("SELECT id FROM users WHERE id=$1 AND role='superadmin' AND is_banned IS FALSE FOR SHARE",[s.accountId]);if(!staff.length)fail('FORBIDDEN');
      const row=await rowLock(conn,input.residenceId);guard(row);
      if(row.access_revision!==input.accessRevision||row.tax_terms?.basePrice!==input.basePrice)fail('STALE');
      const [purchases]=await conn.query("SELECT * FROM aetherius_residence_operations WHERE residence_id=$1 AND action='purchase' ORDER BY created_at DESC,id DESC",[row.id]);
      const last=purchases[0];
      if(!last||last.id!==input.purchaseId||last.profile_id!==row.owner_profile_id||last.account_id!==row.owner_account_id||
        (input.chain==='septims'&&purchases.some(p=>p.currency!=='septims')))fail('INSTANT_INELIGIBLE');
      const history={status:'acquired',chain:input.chain,currency:last.currency,paid:last.amount,base:input.basePrice,operationId:last.id,profileId:last.profile_id,accountId:last.account_id,characterId:last.character_id,reviewedBy:s.profileId,evidence:input.evidence};
      await conn.query('UPDATE aetherius_residences SET acquisition_history=$2::jsonb,access_revision=access_revision+1 WHERE id=$1',[row.id,JSON.stringify(history)]);
      await conn.query(`INSERT INTO aetherius_residence_extension_operations(id,account_id,profile_id,character_id,request_id,residence_id,action,payload_hash,result)
        VALUES($1,$2,$3,$4,$5,$6,'reviewAcquisition',$7,$8::jsonb)`,[randomUUID(),s.accountId,s.profileId,s.characterId,input.requestId,row.id,createHash('sha256').update(JSON.stringify(history)).digest('hex'),JSON.stringify({previous:row.acquisition_history,history})]);
      guard(row);return {reviewed:true,residenceId:row.id};
    });
  }
  return {quote,arm,cancel,sell,status,review,reviewAcquisition,beforePurchase,saleView,tourView,sessionId,toursAvailable,runtime};
}
module.exports={createExtensions,CONTRACT};
