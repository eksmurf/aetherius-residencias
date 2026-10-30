'use strict';
const { fail, integer } = require('./errors.cjs');
const WEEK=7*86400000;
function terms(basePrice) {
  if(!integer(basePrice)) fail('TAX_BASE');
  return {amount:Math.ceil(basePrice/10),currency:'septims',periodDays:7,basePrice};
}
function taxView(row, available=()=>true, now=Date.now()) {
  if(!row.tax_due_at||!row.tax_terms) return {configured:false,canPay:false,periods:0,suspended:false,auction:false};
  const due=new Date(row.tax_due_at).getTime(),periods=now<due?0:Math.floor((now-due)/WEEK)+1;
  const amount=row.tax_terms.amount*periods;
  return {configured:true,dueAt:new Date(due).toISOString(),opensAt:new Date(due).toISOString(),
    weeklyAmount:row.tax_terms.amount,amount,currency:'septims',periods,suspended:periods>=2,auction:periods>=3,
    canPay:periods>0&&Number.isSafeInteger(amount)&&amount<=2147483647&&available('septims'),
    nextAccrualAt:new Date(due+periods*WEEK).toISOString(),serverNow:new Date(now).toISOString()};
}
function offerKind(row,now=Date.now()) {
  if(row.owner_profile_id===null)return 'initial';
  const tax=taxView(row,()=>true,now);
  if(tax.auction)return 'foreclosure';
  if(!tax.suspended&&Number.isInteger(row.listing_price)&&row.listing_price>0)return 'resale';
  return null;
}
module.exports={terms,taxView,offerKind,WEEK};
