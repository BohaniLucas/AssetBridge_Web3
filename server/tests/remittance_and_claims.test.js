import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import app from '../server.js';
import {
  remittanceService,
  parseMajorToMinor,
  formatMinorToMajor,
} from '../services/remittanceService.js';
import { claimService } from '../services/claimService.js';

let server;
let baseUrl;

const USER_A_TOKEN = 'Bearer assetbridge_test_token_00000000-0000-0000-0000-000000000001';
const USER_B_TOKEN = 'Bearer assetbridge_test_token_00000000-0000-0000-0000-000000000099';

before(async () => {
  process.env.NODE_ENV = 'development';
  process.env.ENABLE_DEV_TEST_ACCOUNT = 'true';
  process.env.QUOTE_SIGNING_SECRET = 'test-hmac-secret-32-bytes-minimum-length-ok';
  process.env.PAYOUT_WEBHOOK_SECRET = 'test-webhook-hmac-secret-32-bytes-minimum';

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}/api`;
});

after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

describe('1. Decimal-Safe Minor-Unit Money Arithmetic', () => {
  test('Parses and formats minor units accurately without floating-point drift', () => {
    // 0.1 + 0.2 in IEEE 754 float is 0.30000000000000004, but in minor units:
    const a = parseMajorToMinor('0.10', 6);
    const b = parseMajorToMinor('0.20', 6);
    assert.equal(a + b, 300_000n);
    assert.equal(formatMinorToMajor(a + b, 6, 2), '0.30');

    const hundred = parseMajorToMinor('100.25', 6);
    assert.equal(hundred, 100_250_000n);
    assert.equal(formatMinorToMajor(hundred, 6, 2), '100.25');

    assert.throws(() => parseMajorToMinor('-5', 6), /Invalid monetary amount/);
    assert.throws(() => parseMajorToMinor('0', 6), /greater than zero/);
    assert.throws(() => parseMajorToMinor('1.1234567', 6), /exceeds maximum precision/);
  });
});

describe('2. Fake Success Prevention & Unsupported Corridor Fail-Closed', () => {
  test('Legacy /api/remittance/send remains fail-closed with 503', async () => {
    const res = await fetch(`${baseUrl}/remittance/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: USER_A_TOKEN,
      },
      body: JSON.stringify({ sendAmount: 50, targetCurrency: 'tKES', recipient: '+254700000000' }),
    });
    assert.equal(res.status, 503);
  });

  test('Unsupported corridor phone_payout fails closed with 503', async () => {
    const quoteRes = await fetch(`${baseUrl}/remittance/quotes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: USER_A_TOKEN,
      },
      body: JSON.stringify({
        flowType: 'phone_payout',
        corridorCode: 'ZA-ZAR',
        sendAmountUsdt: '25.00',
      }),
    });
    assert.equal(quoteRes.status, 201);
    const { data: quote } = await quoteRes.json();
    assert.equal(quote.fiatPayoutExecutable, false);

    // Attempting to execute direct phone_payout when PayShap partner is unconfigured must fail closed with 503
    const intentRes = await fetch(`${baseUrl}/remittance/transfers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: USER_A_TOKEN,
      },
      body: JSON.stringify({
        quoteId: quote.id,
        idempotencyKey: `idem_unconf_${Date.now()}`,
        recipientName: 'Thabo Mbeki',
        recipientPhone: '+27821234567',
      }),
    });
    assert.equal(intentRes.status, 503);
  });

  test('Approving a transfer transitions to pending (never paid) and rejects fabricated txHash', async () => {
    // 1. Resolve @nomsa on testnet
    const resolveRes = await fetch(`${baseUrl}/remittance/resolve-user?username=@nomsa`, {
      headers: { Authorization: USER_A_TOKEN },
    });
    assert.equal(resolveRes.status, 200);
    const { data: recipient } = await resolveRes.json();
    assert.equal(recipient.verified, true);
    assert.equal(recipient.username, '@nomsa');

    // 2. Create quote
    const quoteRes = await fetch(`${baseUrl}/remittance/quotes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: USER_A_TOKEN,
      },
      body: JSON.stringify({
        flowType: 'app_to_app',
        corridorCode: 'APP-USDT',
        sendAmountUsdt: '15.00',
      }),
    });
    assert.equal(quoteRes.status, 201);
    const { data: quote } = await quoteRes.json();

    // 3. Create transfer intent
    const intentRes = await fetch(`${baseUrl}/remittance/transfers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: USER_A_TOKEN,
      },
      body: JSON.stringify({
        quoteId: quote.id,
        idempotencyKey: `idem_app_${Date.now()}`,
        recipientUsername: '@nomsa',
      }),
    });
    assert.equal(intentRes.status, 201);
    const { data: intentData } = await intentRes.json();
    assert.equal(intentData.transfer.status, 'awaiting_sender_approval');
    assert.equal(intentData.transfer.fundingTxHash, null);

    // 4. Approve transfer (requires riskAcknowledged because @nomsa is a new recipient)
    const approveWithoutRisk = await fetch(
      `${baseUrl}/remittance/transfers/${intentData.transfer.id}/approve`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: USER_A_TOKEN,
        },
        body: JSON.stringify({ riskAcknowledged: false }),
      }
    );
    assert.equal(approveWithoutRisk.status, 400);

    const approveRes = await fetch(
      `${baseUrl}/remittance/transfers/${intentData.transfer.id}/approve`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: USER_A_TOKEN,
        },
        body: JSON.stringify({ riskAcknowledged: true }),
      }
    );
    assert.equal(approveRes.status, 200);
    const { data: approvedData } = await approveRes.json();
    assert.equal(approvedData.transfer.status, 'pending', 'Must be pending, NEVER completed/paid without on-chain verification');

    // 5. Submit a fabricated 32-byte txHash that does not exist on-chain
    const fakeHash = `0x${'a'.repeat(64)}`;
    const confirmRes = await fetch(
      `${baseUrl}/remittance/transfers/${intentData.transfer.id}/confirm-funding`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: USER_A_TOKEN,
        },
        body: JSON.stringify({ txHash: fakeHash }),
      }
    );
    assert.equal(confirmRes.status, 422, 'Fabricated on-chain hash must be rejected with 422');
  });
});

describe('3. Authorization, Ownership, Idempotency & Quote Expiry', () => {
  test('Rejects forged senderUserId and cross-user access with 403', async () => {
    const res = await fetch(`${baseUrl}/remittance/quotes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: USER_A_TOKEN,
      },
      body: JSON.stringify({
        senderUserId: 'forged-other-user-id',
        flowType: 'app_to_app',
        corridorCode: 'APP-USDT',
        sendAmountUsdt: '10.00',
      }),
    });
    assert.equal(res.status, 403);
  });

  test('Enforces idempotency on duplicate requests and rejects conflicting reuse with 409', async () => {
    const quoteRes = await fetch(`${baseUrl}/remittance/quotes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: USER_A_TOKEN,
      },
      body: JSON.stringify({
        flowType: 'app_to_app',
        corridorCode: 'APP-USDT',
        sendAmountUsdt: '20.00',
      }),
    });
    const { data: quote } = await quoteRes.json();
    const idemKey = `idem_replay_test_${Date.now()}`;

    // First call
    const res1 = await fetch(`${baseUrl}/remittance/transfers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: USER_A_TOKEN,
      },
      body: JSON.stringify({
        quoteId: quote.id,
        idempotencyKey: idemKey,
        recipientUsername: '@nomsa',
      }),
    });
    assert.equal(res1.status, 201);
    const body1 = await res1.json();

    // Second call with identical parameters -> idempotent replay
    const res2 = await fetch(`${baseUrl}/remittance/transfers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: USER_A_TOKEN,
      },
      body: JSON.stringify({
        quoteId: quote.id,
        idempotencyKey: idemKey,
        recipientUsername: '@nomsa',
      }),
    });
    assert.equal(res2.status, 200);
    const body2 = await res2.json();
    assert.equal(body2.data.idempotentReplay, true);
    assert.equal(body2.data.transfer.id, body1.data.transfer.id);

    // Third call with same idempotencyKey but different recipient -> 409 Conflict
    const res3 = await fetch(`${baseUrl}/remittance/transfers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: USER_A_TOKEN,
      },
      body: JSON.stringify({
        quoteId: quote.id,
        idempotencyKey: idemKey,
        recipientUsername: '@sipho',
      }),
    });
    assert.equal(res3.status, 409);

    // User B cannot view or cancel User A's transfer
    const forbiddenGet = await fetch(
      `${baseUrl}/remittance/transfers/${body1.data.transfer.id}`,
      { headers: { Authorization: USER_B_TOKEN } }
    );
    assert.equal(forbiddenGet.status, 403);
  });

  test('Rejects expired quotes with 409 QUOTE_EXPIRED', async () => {
    const quoteRes = await fetch(`${baseUrl}/remittance/quotes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: USER_A_TOKEN,
      },
      body: JSON.stringify({
        flowType: 'app_to_app',
        corridorCode: 'APP-USDT',
        sendAmountUsdt: '12.00',
      }),
    });
    const { data: quote } = await quoteRes.json();

    // Force quote expiration in memory store
    const storedQuote = remittanceService.quotesMem.get(quote.id);
    storedQuote.expiresAt = new Date(Date.now() - 10_000).toISOString();

    const intentRes = await fetch(`${baseUrl}/remittance/transfers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: USER_A_TOKEN,
      },
      body: JSON.stringify({
        quoteId: quote.id,
        idempotencyKey: `idem_exp_${Date.now()}`,
        recipientUsername: '@nomsa',
      }),
    });
    assert.equal(intentRes.status, 409);
    const errBody = await intentRes.json();
    assert.match(errBody.message, /expired/i);
  });
});

describe('4. Gogo Claim Flow: High-Entropy Tokens, OTP Limits, Demo OTP Rejection & Refund', () => {
  test('Full Gogo claim lifecycle: secret hashing, URL safety, demo OTP rejection, expiry, attempt limits, and refund', async () => {
    // 1. Create Quote for Gogo Claim
    const quoteRes = await fetch(`${baseUrl}/remittance/quotes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: USER_A_TOKEN,
      },
      body: JSON.stringify({
        flowType: 'gogo_claim',
        corridorCode: 'ZA-ZAR',
        payoutRail: 'za_gogo_claim',
        sendAmountUsdt: '30.00',
      }),
    });
    assert.equal(quoteRes.status, 201);
    const { data: quote } = await quoteRes.json();

    // 2. Create Gogo Claim Link
    const createRes = await fetch(`${baseUrl}/claims/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: USER_A_TOKEN,
      },
      body: JSON.stringify({
        quoteId: quote.id,
        idempotencyKey: `idem_gogo_${Date.now()}`,
        recipientName: 'Gogo Dlamini',
        recipientPhone: '+27 82 555 0192',
        note: 'Monthly groceries',
        riskAcknowledged: true,
      }),
    });
    assert.equal(createRes.status, 201);
    const { data: created } = await createRes.json();
    const { claim } = created;

    assert.ok(claim.id.startsWith('clm_'));
    assert.ok(claim.oneTimeClaimCode.length >= 32, 'Claim code must be high entropy');
    assert.equal(
      claim.safeClaimUrl.includes(claim.oneTimeClaimCode),
      false,
      'Secret claim code must NEVER appear in the URL'
    );

    // 3. Public GET summary never leaks secrets or raw phone
    const pubRes = await fetch(`${baseUrl}/claims/public/${claim.id}?lang=zu`);
    assert.equal(pubRes.status, 200);
    const { data: pubSummary } = await pubRes.json();
    assert.equal(pubSummary.oneTimeClaimCode, undefined);
    assert.equal(pubSummary.claimTokenHash, undefined);
    assert.equal(pubSummary.recipientPhoneMasked, '+27 ••• ••• 0192');
    assert.equal(pubSummary.aiGuidance.language, 'zu');

    // 4. Request OTP with wrong phone -> 403
    const wrongPhoneRes = await fetch(`${baseUrl}/claims/public/${claim.id}/request-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        claimToken: claim.oneTimeClaimCode,
        phoneNumber: '+27 82 999 9999',
      }),
    });
    assert.equal(wrongPhoneRes.status, 403);

    // 5. Request OTP with correct token & phone -> 200
    const otpReqRes = await fetch(`${baseUrl}/claims/public/${claim.id}/request-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        claimToken: claim.oneTimeClaimCode,
        phoneNumber: '082 555 0192', // Normalized to +27825550192
      }),
    });
    assert.equal(otpReqRes.status, 200);
    const { data: otpReqData } = await otpReqRes.json();
    const issuedOtp = otpReqData._devTestOtpOnly;
    assert.ok(issuedOtp && issuedOtp.length === 6 && issuedOtp !== '123456');

    // 6. Demo OTP '123456' is strictly rejected with 401
    const demoOtpRes = await fetch(`${baseUrl}/claims/public/${claim.id}/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ otpCode: '123456' }),
    });
    assert.equal(demoOtpRes.status, 401);

    // 7. Correct OTP succeeds
    const validOtpRes = await fetch(`${baseUrl}/claims/public/${claim.id}/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ otpCode: issuedOtp }),
    });
    assert.equal(validOtpRes.status, 200);
    const { data: verifiedData } = await validOtpRes.json();
    assert.ok(verifiedData.verificationSessionToken);

    // 8. Attempting payout before on-chain funding fails with 409 AWAITING_ONCHAIN_FUNDING
    const prematurePayout = await fetch(`${baseUrl}/claims/public/${claim.id}/confirm-payout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        verificationSessionToken: verifiedData.verificationSessionToken,
        payoutMethod: 'za_payshap_proxy',
      }),
    });
    assert.equal(prematurePayout.status, 409);

    // 9. User B cannot refund User A's claim -> 403
    const forbiddenRefund = await fetch(`${baseUrl}/claims/${claim.id}/refund`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: USER_B_TOKEN,
      },
    });
    assert.equal(forbiddenRefund.status, 403);

    // 10. User A cancels/refunds the unclaimed link -> 200
    const refundRes = await fetch(`${baseUrl}/claims/${claim.id}/refund`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: USER_A_TOKEN,
      },
    });
    assert.equal(refundRes.status, 200);
  });

  test('Locks Gogo claim after 5 wrong OTP attempts', async () => {
    const quoteRes = await fetch(`${baseUrl}/remittance/quotes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: USER_A_TOKEN,
      },
      body: JSON.stringify({
        flowType: 'gogo_claim',
        corridorCode: 'ZA-ZAR',
        sendAmountUsdt: '15.00',
      }),
    });
    const { data: quote } = await quoteRes.json();

    const createRes = await fetch(`${baseUrl}/claims/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: USER_A_TOKEN,
      },
      body: JSON.stringify({
        quoteId: quote.id,
        idempotencyKey: `idem_lock_${Date.now()}`,
        recipientName: 'Gogo LockTest',
        recipientPhone: '+27821112222',
        riskAcknowledged: true,
      }),
    });
    const { data: created } = await createRes.json();
    const claimId = created.claim.id;

    await fetch(`${baseUrl}/claims/public/${claimId}/request-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        claimToken: created.claim.oneTimeClaimCode,
        phoneNumber: '+27821112222',
      }),
    });

    // Submit 5 wrong OTPs
    for (let i = 0; i < 5; i++) {
      await fetch(`${baseUrl}/claims/public/${claimId}/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otpCode: '000000' }),
      });
    }

    // 6th attempt must be locked with 429
    const lockedRes = await fetch(`${baseUrl}/claims/public/${claimId}/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ otpCode: '000000' }),
    });
    assert.equal(lockedRes.status, 429);
    assert.equal(claimService.claimsMem.get(claimId).status, 'locked');
  });
});

describe('5. Webhook Signature Verification, Idempotency & Payout Failure Refund Recovery', () => {
  test('Rejects invalid webhook signatures, processes payout failure into refund_pending, and recovers refund', async () => {
    const quoteRes = await fetch(`${baseUrl}/remittance/quotes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: USER_A_TOKEN,
      },
      body: JSON.stringify({
        flowType: 'gogo_claim',
        corridorCode: 'ZA-ZAR',
        sendAmountUsdt: '40.00',
      }),
    });
    const { data: quote } = await quoteRes.json();

    const intentRes = await fetch(`${baseUrl}/remittance/transfers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: USER_A_TOKEN,
      },
      body: JSON.stringify({
        quoteId: quote.id,
        idempotencyKey: `idem_wh_${Date.now()}`,
        recipientName: 'Sipho',
        recipientPhone: '+27823334444',
      }),
    });
    const { data: intentData } = await intentRes.json();
    const transferId = intentData.transfer.id;

    // Transition transfer in memory to `funded` -> `payout_pending` to test webhook failure recovery
    const rawTransfer = remittanceService.transfersMem.get(transferId);
    remittanceService.transitionTransferState(rawTransfer, 'funded', 'Test on-chain funded state');
    remittanceService.transitionTransferState(rawTransfer, 'payout_pending', 'Dispatched to payout partner');

    const payload = {
      eventId: `evt_${Date.now()}`,
      eventType: 'payout.failed',
      transferId,
      providerReference: 'payshap_ref_001',
      reason: 'Recipient ShapID proxy unregistered at receiving bank',
    };
    const rawBody = JSON.stringify(payload);

    // 1. Forged signature -> 401
    const badSigRes = await fetch(`${baseUrl}/remittance/webhooks/payout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-signature': 'sha256=0000000000000000000000000000000000000000000000000000000000000000',
      },
      body: rawBody,
    });
    assert.equal(badSigRes.status, 401);

    // 2. Valid HMAC-SHA256 signature -> transitions to `refund_pending`
    const validHmac = crypto
      .createHmac('sha256', process.env.PAYOUT_WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');

    const goodWhRes = await fetch(`${baseUrl}/remittance/webhooks/payout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-signature': `sha256=${validHmac}`,
      },
      body: rawBody,
    });
    assert.equal(goodWhRes.status, 200);
    const whBody = await goodWhRes.json();
    assert.equal(whBody.data.transfer.status, 'refund_pending');

    // 3. Duplicate webhook retry with same eventId -> idempotent replay
    const retryWhRes = await fetch(`${baseUrl}/remittance/webhooks/payout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-signature': `sha256=${validHmac}`,
      },
      body: rawBody,
    });
    assert.equal(retryWhRes.status, 200);
    const retryBody = await retryWhRes.json();
    assert.equal(retryBody.data.idempotentReplay, true);

    // 4. Sender recovers funds from `refund_pending` -> `refunded`
    const refundRes = await fetch(`${baseUrl}/remittance/transfers/${transferId}/refund`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: USER_A_TOKEN,
      },
      body: JSON.stringify({ reason: 'Recover after partner payout failure' }),
    });
    assert.equal(refundRes.status, 200);
    const refundBody = await refundRes.json();
    assert.equal(refundBody.data.transfer.status, 'refunded');
  });
});

