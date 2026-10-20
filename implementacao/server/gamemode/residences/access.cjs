'use strict';
function authorizeReference({ ref, residence, session, nearby, transfer }) {
  if (!ref) return true;
  if (ref.kind === 'exit' && !transfer) return true;
  if (!residence || !session || !nearby) return false;
  if (ref.kind === 'container') return residence.owner_profile_id === session.profileId && residence.owner_account_id === session.accountId;
  return !transfer && residence.owner_profile_id !== null && residence.locked === false;
}
module.exports = { authorizeReference };
