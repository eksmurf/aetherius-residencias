'use strict';
const {randomUUID}=require('node:crypto');
const {fail}=require('./errors.cjs');
const {tourEligible}=require('./estate-policy.cjs');
// All motor calls below are a new explicit adapter contract, not assumed native APIs.
function createTours({transact,authorize,extensions}){
  const runtime=extensions.runtime;
  let busy=false;
  async function start(s,input,guard){
    if(!extensions.toursAvailable())fail('EXT_UNAVAILABLE');
    const tour=await transact(async conn=>{
      await conn.query('SELECT pg_advisory_xact_lock(174623,$1)',[s.profileId]);await authorize(conn,s);
      const [rows]=await conn.query('SELECT * FROM aetherius_residences WHERE id=$1 FOR UPDATE',[input.residenceId]);const row=rows[0];
      if(!row)fail('NOT_FOUND');guard(row);
      const [old]=await conn.query("SELECT * FROM aetherius_residence_tours WHERE account_id=$1 AND state<>'closed'",[s.accountId]);
      if(old.length){if(old[0].session_id!==extensions.sessionId(s))fail('TOUR_RETURN');return old[0];}
      if(!tourEligible(row)||row.revision!==input.revision)fail('TOUR_INELIGIBLE');
      const route=await runtime.prepareTour({session:s,residence:row,door:input.door});
      if(!route||route.alive!==true||route.inCombat!==false||route.verified!==true||!route.returnPoint||!route.destination||!row.definition.interiorCells.includes(route.cell))fail('TOUR_UNSAFE');
      guard(row);
      const [created]=await conn.query(`INSERT INTO aetherius_residence_tours(id,account_id,profile_id,character_id,session_id,residence_id,revision,state,route,deadline)
        VALUES($1,$2,$3,$4,$5,$6,$7,'entering',$8::jsonb,clock_timestamp()+interval '20 seconds') RETURNING *`,[randomUUID(),s.accountId,s.profileId,s.characterId,extensions.sessionId(s),row.id,row.revision,JSON.stringify(route)]);
      // Protection must be active before any teleport. It is retained until verified return.
      await runtime.protectTour(created[0]);guard(row);return created[0];
    });
    // Delivery is idempotent by tour.id; deadline is never renewed by retry.
    if(tour.state==='entering')try{await runtime.enterTour(tour);}catch{await markReturn(tour.id,'entry-failed');}
    return view(tour);
  }
  const view=t=>t?{tourId:t.id,residenceId:t.residence_id,state:t.state,deadline:t.deadline,serverNow:new Date().toISOString()}:null;
  async function status(s){return transact(async conn=>{await authorize(conn,s);const [rows]=await conn.query("SELECT * FROM aetherius_residence_tours WHERE account_id=$1 AND character_id=$2 AND state<>'closed'",[s.accountId,s.characterId]);return view(rows[0]);});}
  async function end(s){return transact(async conn=>{await authorize(conn,s);await conn.query("UPDATE aetherius_residence_tours SET state='returning',reason='exit' WHERE account_id=$1 AND character_id=$2 AND state<>'closed'",[s.accountId,s.characterId]);return {returning:true};});}
  async function markReturn(id,reason){return transact(conn=>conn.query("UPDATE aetherius_residence_tours SET state='returning',reason=$2 WHERE id=$1 AND state<>'closed'",[id,reason]));}
  async function recover(){
    await transact(conn=>conn.query("UPDATE aetherius_residence_tours SET state='returning',reason='restart' WHERE state<>'closed'"));
    await step();
  }
  async function step(){
    if(busy)return;busy=true;
    try{
      const tours=await transact(async conn=>{const [rows]=await conn.query("SELECT * FROM aetherius_residence_tours WHERE state<>'closed' ORDER BY created_at");return rows;});
      if(tours.length&&['protectTour','observeTour','returnTour','releaseTour'].some(method=>typeof runtime?.[method]!=='function'))fail('TOUR_RETURN');
      for(const tour of tours){
        try{
          await runtime.protectTour(tour);
          const observed=await runtime.observeTour(tour);
          if(!observed||observed.connected!==true||observed.sameSession!==true||observed.alive!==true||observed.inCombat!==false||observed.inside===false||Date.now()>=new Date(tour.deadline).getTime()){
            await markReturn(tour.id,'expired-or-unsafe');tour.state='returning';
          }
          if(tour.state==='entering'&&observed?.arrived===true){
            await transact(async conn=>{
              // Match lock order with purchases: residence first. Recheck eligibility on arrival.
              const [rows]=await conn.query('SELECT * FROM aetherius_residences WHERE id=$1 FOR UPDATE',[tour.residence_id]);
              if(!rows[0]||!tourEligible(rows[0])||rows[0].revision!==tour.revision){await conn.query("UPDATE aetherius_residence_tours SET state='returning',reason='changed' WHERE id=$1 AND state<>'closed'",[tour.id]);return;}
              await conn.query("UPDATE aetherius_residence_tours SET state='active',deadline=clock_timestamp()+interval '60 seconds' WHERE id=$1 AND state='entering' AND deadline>clock_timestamp()",[tour.id]);
            });
          }
          // Reload: a purchase may have revoked the session while observation was in flight.
          const current=await transact(async conn=>{const [r]=await conn.query('SELECT * FROM aetherius_residence_tours WHERE id=$1',[tour.id]);return r[0];});
          if(current.state==='returning'){
            const result=await runtime.returnTour(current);
            // Offline/dead actors remain pending until the official login/respawn path confirms safety.
            if(result?.safe===true){
              await runtime.releaseTour(current);
              await transact(conn=>conn.query("UPDATE aetherius_residence_tours SET state='closed',closed_at=clock_timestamp() WHERE id=$1 AND state='returning'",[tour.id]));
            }
          }
        }catch{ /* durable row + adapter guard retain recovery; next worker pass retries */ }
      }
    }finally{busy=false;}
  }
  return {start,status,end,step,recover};
}
module.exports={createTours};
