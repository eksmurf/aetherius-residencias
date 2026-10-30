'use strict';
const { fail, integer } = require('./errors.cjs');
function createCurrencies(transactionService, diademas) {
  if (typeof transactionService?.tx?.applyGoldDelta !== 'function' ||
      typeof transactionService?.tx?.recordGoldLedger !== 'function') throw Error('Economia oficial de Septims indisponível.');
  if (diademas && (diademas.contract !== 'aetherius-diademas-same-transaction-v1' ||
      typeof diademas.debitInTransaction !== 'function')) throw Error('Contrato de Diademas incompatível.');
  return {
    available: currency => currency === 'septims' || (currency === 'diademas' && !!diademas),
    async creditSeller(conn, {amount,profileId,accountId,characterId,purchaseId}) {
      if(!integer(amount)||!integer(profileId)) fail('INVALID');
      const [rows]=await conn.query(`SELECT c.id,COALESCE(c.gold,0) AS gold FROM users u JOIN characters c ON c.user_id=u.id
        WHERE u.profile_id=$1 AND u.id=$2 AND c.id=$3 AND c.status='approved' FOR UPDATE OF c`,[profileId,accountId,characterId]);
      if(rows.length!==1||Number(rows[0].gold)+amount>2147483647) fail('SELLER');
      await transactionService.tx.applyGoldDelta(conn,characterId,amount);
      return transactionService.tx.recordGoldLedger(conn,{characterId,delta:amount,reason:'residence_sale',module:'residences',idempotencyKey:`residence:${purchaseId}:seller`});
    },
    async debit(conn, { currency, amount, accountId, characterId, profileId, purchaseId, reason='residence_purchase' }) {
      if (!integer(amount)) fail('INVALID');
      const idempotencyKey = `residence:${purchaseId}`;
      if (currency === 'septims') {
        const [rows] = await conn.query('SELECT COALESCE(gold,0) AS gold FROM characters WHERE id=$1 AND user_id=$2 FOR UPDATE', [characterId, accountId]);
        if (!rows.length || Number(rows[0].gold) < amount) fail('FUNDS');
        await transactionService.tx.applyGoldDelta(conn, characterId, -amount);
        return transactionService.tx.recordGoldLedger(conn, { characterId, delta: -amount, reason, module: 'residences', idempotencyKey });
      }
      if (currency !== 'diademas') fail('CURRENCY');
      if (!diademas) fail('DIADEMAS_UNAVAILABLE');
      const receipt = await diademas.debitInTransaction(conn, { accountId, characterId, profileId, amount, idempotencyKey });
      if (!receipt || receipt.currency !== currency || receipt.amount !== amount || receipt.accountId !== accountId ||
          typeof receipt.transactionId !== 'string' || !receipt.transactionId || receipt.transactionId.length > 160) fail('UNAVAILABLE');
      return receipt.transactionId;
    },
  };
}
module.exports = { createCurrencies };
