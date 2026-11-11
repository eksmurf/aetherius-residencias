'use strict';
const { fail, integer } = require('./errors.cjs');
const TAX_PERIOD_DAYS=15;
const TAX_PERIOD_MS=TAX_PERIOD_DAYS*86400000;
function terms(basePrice) {
  if(!integer(basePrice)) fail('TAX_BASE');
  return {amount:Math.ceil(basePrice/10),currency:'septims',periodDays:TAX_PERIOD_DAYS,basePrice};
}
function taxView(row, available=()=>true, now=Date.now()) {
  if(!row.tax_due_at||!row.tax_terms) return {configured:false,canPay:false,periods:0,suspended:false,auction:false};
  if(row.tax_terms.periodDays!==TAX_PERIOD_DAYS) fail('TAX_PERIOD');
  const due=new Date(row.tax_due_at).getTime(),periods=now<due?0:Math.floor((now-due)/TAX_PERIOD_MS)+1;
  const amount=row.tax_terms.amount*periods;
  const paymentPeriods=periods,paymentAmount=amount;
  return {configured:true,dueAt:new Date(due).toISOString(),opensAt:new Date(due).toISOString(),
    periodAmount:row.tax_terms.amount,periodDays:TAX_PERIOD_DAYS,amount,currency:'septims',periods,suspended:periods>=2,auction:periods>=3,
    advance:false,paymentPeriods,paymentAmount,
    canPay:Number.isSafeInteger(paymentAmount)&&paymentAmount>0&&paymentAmount<=2147483647&&available('septims'),
    nextAccrualAt:new Date(due+periods*TAX_PERIOD_MS).toISOString(),serverNow:new Date(now).toISOString()};
}
function offerKind(row,now=Date.now()) {
  if(row.owner_profile_id===null)return 'initial';
  const tax=taxView(row,()=>true,now);
  if(tax.auction)return 'foreclosure';
  if(tax.configured&&tax.periods===0&&Number.isInteger(row.listing_price)&&row.listing_price>0)return 'resale';
  return null;
}
module.exports={terms,taxView,offerKind,TAX_PERIOD_DAYS,TAX_PERIOD_MS};
