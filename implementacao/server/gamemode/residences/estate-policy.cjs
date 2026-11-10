'use strict';
const {taxView}=require('./tax.cjs');
function instantOffer(row){
  const h=row.acquisition_history;
  if(!h || h.status!=='acquired' || h.chain!=='septims' || h.currency!=='septims')return {eligible:false,reason:h?.currency==='diademas'||h?.chain==='diademas'?'Casas adquiridas com Diademas não têm venda instantânea.':'Origem da aquisição em verificação.'};
  if(h.profileId!==row.owner_profile_id || h.accountId!==row.owner_account_id || !Number.isSafeInteger(h.base)||h.base<1||h.base>2147483647)return {eligible:false,reason:'Base da aquisição em verificação.'};
  const tax=taxView(row);
  if(!tax.configured||!Number.isSafeInteger(tax.amount))return {eligible:false,reason:'Imposto em verificação.'};
  const amount=Number(BigInt(h.base)*40n/100n);
  if(!amount)return {eligible:false,reason:'O valor base não permite retorno inteiro positivo.'};
  return {eligible:true,base:h.base,amount,net:Math.max(0,amount-tax.amount),taxWithheld:Math.min(amount,tax.amount),taxWaived:Math.max(0,tax.amount-amount),taxAmount:tax.amount,taxPeriods:tax.periods,dueAt:tax.dueAt,loss:h.base-amount,rounding:h.base%5!==0,currency:'septims'};
}
function acquisition(row,session,currency,paid,base,operationId){
  const previous=row.acquisition_history;
  const chain=currency==='diademas'||previous?.chain==='diademas'?'diademas':previous?.status==='never'||previous?.chain==='septims'?'septims':'unknown';
  return {status:'acquired',chain,currency,paid,base,operationId,profileId:session.profileId,accountId:session.accountId,characterId:session.characterId};
}
function tourEligible(row){return row.owner_profile_id===null&&row.for_sale===true;}
module.exports={instantOffer,acquisition,tourEligible};
