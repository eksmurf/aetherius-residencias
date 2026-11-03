'use strict';
const { messages, fail, uuid, integer } = require('./errors.cjs');
const { offerKind } = require('./tax.cjs');
const management=['public','addMember','setFamily','removeMember','payTax','listSale','cancelSale'];
function request(raw) {
  if(!raw||typeof raw!=='object'||JSON.stringify(raw).length>2048||raw.version!==1||!uuid(raw.requestId)) fail('INVALID');
  const fields={offer:['residenceId'],purchase:['residenceId','revision','currency','accessRevision','offerKind'],status:['operationRequestId'],properties:[],
    listSale:['residenceId','accessRevision','amount'],cancelSale:['residenceId','accessRevision'],
    public:['residenceId','accessRevision','open'],addMember:['residenceId','accessRevision','query'],
    setFamily:['residenceId','accessRevision','memberProfileId','family'],removeMember:['residenceId','accessRevision','memberProfileId','confirmed'],
    payTax:['residenceId','accessRevision','dueAt','periods']}[raw.action];
  if(!fields||Object.keys(raw).some(k=>!['version','requestId','action',...fields].includes(k))) fail('INVALID');
  if(fields.includes('residenceId')&&(typeof raw.residenceId!=='string'||!/^[a-z0-9_-]{1,48}$/.test(raw.residenceId))) fail('INVALID');
  if(management.includes(raw.action)&&!integer(raw.accessRevision)) fail('INVALID');
  if(raw.action==='listSale'&&!integer(raw.amount)) fail('INVALID');
  if(raw.action==='addMember'&&/^[0-9]+$/.test(raw.query||'')&&!integer(Number(raw.query)))fail('INVALID');
  if(raw.action==='purchase'&&(!['initial','resale','foreclosure'].includes(raw.offerKind)||!integer(raw.accessRevision)||!integer(raw.revision)||!['septims','diademas'].includes(raw.currency))) fail('INVALID');
  if(raw.action==='public'&&typeof raw.open!=='boolean') fail('INVALID');
  if(raw.action==='addMember'&&(typeof raw.query!=='string'||!raw.query.trim()||raw.query.length>255)) fail('INVALID');
  if(raw.action==='addMember') raw={...raw,query:raw.query.trim()};
  if(['setFamily','removeMember'].includes(raw.action)&&!integer(raw.memberProfileId)) fail('INVALID');
  if(raw.action==='setFamily'&&typeof raw.family!=='boolean') fail('INVALID');
  if(raw.action==='removeMember'&&raw.confirmed!==true) fail('INVALID');
  if(raw.action==='status'&&!uuid(raw.operationRequestId)) fail('INVALID');
  if(raw.action==='payTax'&&(!integer(raw.periods,0)||typeof raw.dueAt!=='string'||!Number.isFinite(Date.parse(raw.dueAt)))) fail('INVALID');
  return raw;
}
function createService({store,host,currencies,state,purchasesEnabled,allowProfiles=[]}) {
  const pending=new Set(),buckets=new WeakMap();
  async function handle(actorId,raw,channel='door') {
    const session=host.session(actorId),input=request(raw);
    if(!state.available()) fail('UNAVAILABLE');
    if(allowProfiles.length&&!allowProfiles.includes(session.profileId)) fail('FORBIDDEN');
    if((management.includes(input.action)||input.action==='properties')&&channel!=='properties') fail('FORBIDDEN');
    if(pending.has(session.profileId)) fail('BUSY');
    let bucket=buckets.get(session.identity);
    if(!bucket||Date.now()-bucket.start>10000){bucket={start:Date.now(),count:0};buckets.set(session.identity,bucket);}
    if(++bucket.count>25) fail('BUSY');
    pending.add(session.profileId);
    try {
      host.retireLegacyKeys(session);
      if(input.action==='properties') {const out=await store.properties(session);host.assertCurrent(session);return out;}
      if(input.action==='status') return await store.status(session,input.operationRequestId)||{committed:false,message:'Nenhum recibo encontrado. Reenvie o mesmo pedido.'};
      const residence=state.get(input.residenceId);
      if(!residence) fail('NOT_FOUND');
      if(input.action==='offer'||input.action==='purchase') host.assertNear(session,residence);
      if(input.action==='offer') {
        const kind=offerKind(residence),auction=kind==='foreclosure',resale=kind==='resale';
        if(residence.owner_profile_id!==null&&((!auction&&!resale)||residence.owner_profile_id===session.profileId)) fail('PRIVATE');
        return {residenceId:residence.id,name:residence.definition.name,revision:residence.revision,accessRevision:residence.access_revision,owned:false,owner:false,offerKind:kind,
          forSale:purchasesEnabled&&(residence.for_sale||auction||resale),refs:residence.definition.refs.map(r=>({kind:r.kind})),
          prices:Object.entries(resale?{septims:residence.listing_price}:residence.definition.prices).map(([currency,amount])=>({currency,amount,available:currencies.available(currency)}))};
      }
      state.invalidate();
      try {
        return await store.mutate(session,input,row=>input.action==='purchase'?host.assertNear(session,row):host.assertCurrent(session),()=>{},purchasesEnabled);
      } finally {await state.finishMutation();}
    } finally {pending.delete(session.profileId);}
  }
  async function core(actorId,action,payload) {
    try { return {ok:true,data:await handle(actorId,{...payload,version:1,action:action==='snapshot'?'properties':action},'properties')}; }
    catch(error){const code=Object.hasOwn(messages,error.code)?error.code:'UNAVAILABLE';return {ok:false,error:{code,message:messages[code]},uncertain:['UNKNOWN','UNAVAILABLE','BUSY'].includes(code)};}
  }
  async function receive(actorId,raw) {
    let session;try{session=host.session(actorId);}catch{return;}
    let response;
    try {response={requestId:raw.requestId,action:raw.action,status:'succeeded',data:await handle(actorId,raw)};}
    catch(error){const code=Object.hasOwn(messages,error.code)?error.code:'UNAVAILABLE';
      if(code==='PRIVATE'){host.notify(session,messages.PRIVATE);return;}
      response={requestId:uuid(raw?.requestId)?raw.requestId:null,action:raw?.action,status:code==='UNKNOWN'?'unknown':'rejected',code,message:messages[code]};}
    try{host.send(session,response);}catch{}
  }
  return {handle,receive,core};
}
module.exports={createService,request};
