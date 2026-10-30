'use strict';
const { taxView }=require('./tax.cjs');
function authorizeReference({ ref, residence, session, nearby, transfer }) {
  if (!ref) return true;
  if (ref.kind === 'exit' && !transfer) return true;
  if (!residence || !session || !nearby) return false;
  if(taxView(residence).suspended) return false;
  const owner = residence.owner_profile_id === session.profileId && residence.owner_account_id === session.accountId;
  const member = residence.members?.find(m => m.profile_id === session.profileId && m.account_id === session.accountId);
  if (ref.kind === 'container') return owner || member?.family === true;
  return !transfer && residence.owner_profile_id !== null && (owner || !!member || residence.locked === false);
}
module.exports = { authorizeReference };
