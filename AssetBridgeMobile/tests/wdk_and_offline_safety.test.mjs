import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

registerHooks({
  load(url, context, nextLoad) {
    if (url.includes('node_modules/react-native/index.js')) {
      return {
        format: 'module',
        shortCircuit: true,
        source: `
          export const Platform = { OS: 'android' };
          export const NativeModules = { SourceCode: { scriptURL: 'http://127.0.0.1:8081/index.bundle' } };
          export default { Platform, NativeModules };
        `,
      };
    }
    return nextLoad(url, context);
  },
});

const {
  WDK_SEPOLIA_CHAIN_ID,
  WDK_SEPOLIA_USDT_ADDRESS,
  OFFLINE_SIGNING_ENABLED,
  OFFLINE_SIGNING_DISABLED_REASON,
  assertSupportedWdkConfig,
  isValidPersonalEvmRecipient,
  walletIdForUser,
} = await import('../src/config/wdkConstants.js');

const {
  setPaymentStorageAdapter,
  createPaymentRequestId,
  estimateUsdtTransferFee,
  recheckLiveBalanceAndFeeBeforeSend,
  submitOrCheckUsdtTransfer,
  checkUsdtTransferReceipt,
  savePaymentRecord,
  listPaymentJournal,
  saveOfflinePaymentDraft,
  listOfflinePaymentDrafts,
  deleteOfflinePaymentDraft,
  saveCachedWalletSnapshot,
  loadCachedWalletSnapshot,
  getPaymentStatusPresentation,
  parseTokenUnits,
} = await import('../src/services/wdkPaymentService.js');

const { walletService: backendWalletService } = await import(
  '../../server/services/walletService.js'
);
const {
  buildReceiveQrPayload,
  parseAndValidateUsdtQr,
} = await import('../src/services/walletService.js');
const {
  mobileAuthService,
  setAuthStorageAdapter,
  setAuthFetchAdapter,
} = await import('../src/services/authService.js');
const { sessionLockService, setSessionLockStorageAdapter } = await import(
  '../src/services/sessionLockService.js'
);

function createMemoryStorage() {
  const map = new Map();
  return {
    map,
    async isAvailableAsync() {
      return true;
    },
    async getItemAsync(key) {
      return map.has(key) ? map.get(key) : null;
    },
    async setItemAsync(key, value) {
      map.set(key, String(value));
    },
    async deleteItemAsync(key) {
      map.delete(key);
    },
  };
}

const VALID_SENDER = '0x1111111111111111111111111111111111111111';
const VALID_RECIPIENT = '0x2222222222222222222222222222222222222222';
const MOCK_USER_OP_HASH =
  '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const MOCK_TX_HASH =
  '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

const mockUsdtAsset = {
  getId: () => 'usdt',
  getContractAddress: () => WDK_SEPOLIA_USDT_ADDRESS,
};
const mockEthAsset = {
  getId: () => 'eth',
};

test('Stage 1: WDK config fails closed on wrong chainId, token address, decimals, or recipient', () => {
  assert.doesNotThrow(() => assertSupportedWdkConfig());

  assert.throws(
    () => assertSupportedWdkConfig({ chainId: 1 }),
    /Unsupported chain ID/
  );
  assert.throws(
    () =>
      assertSupportedWdkConfig({
        tokenAddress: '0x0000000000000000000000000000000000000001',
      }),
    /Unsupported token contract/
  );
  assert.throws(
    () => assertSupportedWdkConfig({ decimals: 18 }),
    /Unsupported token decimals/
  );

  // Sepolia USDT contract address and burn address must never be accepted as personal recipients
  assert.equal(isValidPersonalEvmRecipient(WDK_SEPOLIA_USDT_ADDRESS), false);
  assert.equal(
    isValidPersonalEvmRecipient('0x0000000000000000000000000000000000000000'),
    false
  );
  assert.equal(isValidPersonalEvmRecipient(VALID_RECIPIENT), true);
  assert.equal(walletIdForUser('user-42'), 'assetbridge_user-42');
});

test('Stage 1: Idempotent submission — same requestId never invokes account.send twice and separates userOperationHash from transactionHash', async () => {
  const storage = createMemoryStorage();
  setPaymentStorageAdapter(storage);

  let sendCallCount = 0;
  let receiptCallCount = 0;

  const mockAccount = {
    account: { accountIndex: 0, network: 'ethereum' },
    address: VALID_SENDER,
    async getBalance() {
      return [
        { assetId: 'usdt', success: true, balance: '100000000' }, // 100 USDT
        { assetId: 'eth', success: true, balance: '100000000000000000' }, // 0.1 ETH
      ];
    },
    async estimateFee() {
      return { success: true, fee: '100000000000000' }; // 0.0001 ETH
    },
    async send() {
      sendCallCount += 1;
      return {
        success: true,
        hash: MOCK_USER_OP_HASH,
        fee: '100000000000000',
      };
    },
    extension() {
      return {
        async getTransaction() {
          return {
            finality: receiptCallCount === 0 ? 'pending' : 'confirmed',
            confirmations: receiptCallCount === 0 ? 0 : 1,
          };
        },
        async getUserOperationReceipt(hash) {
          receiptCallCount += 1;
          assert.equal(hash, MOCK_USER_OP_HASH);
          if (receiptCallCount === 1) {
            // First check: still pending in bundler mempool
            return null;
          }
          // Second check: confirmed on-chain with distinct transactionHash
          return {
            success: true,
            actualGasCost: '100000000000000',
            receipt: {
              transactionHash: MOCK_TX_HASH,
              blockNumber: 54321,
            },
          };
        },
      };
    },
  };

  const requestId = createPaymentRequestId();
  const feeQuote = await estimateUsdtTransferFee({
    account: mockAccount,
    to: VALID_RECIPIENT,
    amountUsdt: '12.50',
    asset: mockUsdtAsset,
  });

  // First submission: broadcasts UserOperation, pending confirmation
  const firstResult = await submitOrCheckUsdtTransfer({
    account: mockAccount,
    requestId,
    to: VALID_RECIPIENT,
    amountUsdt: '12.50',
    asset: mockUsdtAsset,
    ethAsset: mockEthAsset,
    reviewedFeeQuote: feeQuote,
    scopeKey: 'user-1',
  });

  assert.equal(sendCallCount, 1);
  assert.equal(firstResult.status, 'pending');
  assert.equal(firstResult.confirmed, false);
  assert.equal(firstResult.userOperationHash, MOCK_USER_OP_HASH);
  // CRITICAL: userOperationHash must NEVER be copied into transactionHash
  assert.equal(firstResult.transactionHash, null);

  // Second call with the same requestId: reconciles receipt WITHOUT calling account.send again
  const secondResult = await submitOrCheckUsdtTransfer({
    account: mockAccount,
    requestId,
    to: VALID_RECIPIENT,
    amountUsdt: '12.50',
    asset: mockUsdtAsset,
    ethAsset: mockEthAsset,
    reviewedFeeQuote: feeQuote,
    scopeKey: 'user-1',
  });

  assert.equal(sendCallCount, 1, 'account.send must not be called a second time');
  assert.equal(secondResult.status, 'successful');
  assert.equal(secondResult.confirmed, true);
  assert.equal(secondResult.userOperationHash, MOCK_USER_OP_HASH);
  assert.equal(secondResult.transactionHash, MOCK_TX_HASH);
  assert.notEqual(secondResult.userOperationHash, secondResult.transactionHash);

  // Third call with altered amount on same requestId must fail closed
  await assert.rejects(
    () =>
      submitOrCheckUsdtTransfer({
        account: mockAccount,
        requestId,
        to: VALID_RECIPIENT,
        amountUsdt: '99.00',
        asset: mockUsdtAsset,
        ethAsset: mockEthAsset,
        reviewedFeeQuote: feeQuote,
        scopeKey: 'user-1',
      }),
    /already bound to different payment parameters/
  );
});

test('Stage 1: Concurrent approval taps are blocked by in-memory concurrency lock', async () => {
  const storage = createMemoryStorage();
  setPaymentStorageAdapter(storage);

  let sendCalls = 0;
  const mockAccount = {
    account: { accountIndex: 0, network: 'ethereum' },
    address: VALID_SENDER,
    async getBalance() {
      return [
        { assetId: 'usdt', success: true, balance: '50000000' },
        { assetId: 'eth', success: true, balance: '100000000000000000' },
      ];
    },
    async estimateFee() {
      return { success: true, fee: '100000000000000' };
    },
    async send() {
      sendCalls += 1;
      await new Promise((r) => setTimeout(r, 40));
      return { success: true, hash: MOCK_USER_OP_HASH, fee: '100000000000000' };
    },
    extension() {
      return {
        async getUserOperationReceipt() {
          return {
            success: true,
            receipt: { transactionHash: MOCK_TX_HASH, blockNumber: 100 },
          };
        },
      };
    },
  };

  const requestId = createPaymentRequestId();
  const [first, second] = await Promise.all([
    submitOrCheckUsdtTransfer({
      account: mockAccount,
      requestId,
      to: VALID_RECIPIENT,
      amountUsdt: '5.00',
      asset: mockUsdtAsset,
      ethAsset: mockEthAsset,
      scopeKey: 'user-concurrent',
    }),
    submitOrCheckUsdtTransfer({
      account: mockAccount,
      requestId,
      to: VALID_RECIPIENT,
      amountUsdt: '5.00',
      asset: mockUsdtAsset,
      ethAsset: mockEthAsset,
      scopeKey: 'user-concurrent',
    }),
  ]);

  assert.equal(sendCalls, 1, 'Concurrent taps must invoke account.send only once');
  const statuses = [first.status, second.status];
  assert.ok(statuses.includes('successful'));
  assert.ok(statuses.includes('submitting'));
});

test('Stage 1: Crash/restart recovery marks interrupted submissions without hash as outcome-unknown and blocks retry', async () => {
  const storage = createMemoryStorage();
  setPaymentStorageAdapter(storage);

  const interruptedRequestId = 'wdk_crashed_before_hash_1';
  await savePaymentRecord(
    interruptedRequestId,
    {
      requestId: interruptedRequestId,
      senderAddress: VALID_SENDER,
      recipient: VALID_RECIPIENT,
      amountUsdt: '25.00',
      amountBaseUnits: parseTokenUnits('25.00', 6),
      tokenSymbol: 'USDT',
      tokenAddress: WDK_SEPOLIA_USDT_ADDRESS,
      chainId: WDK_SEPOLIA_CHAIN_ID,
      status: 'submitting',
      userOperationHash: null,
      transactionHash: null,
      createdAt: new Date().toISOString(),
    },
    'user-crash'
  );

  // Listing the journal after app restart transitions interrupted 'submitting' record to 'outcome-unknown'
  const journal = await listPaymentJournal('user-crash');
  assert.equal(journal.length, 1);
  assert.equal(journal[0].status, 'outcome-unknown');

  const pres = getPaymentStatusPresentation(journal[0], false);
  assert.equal(pres.badge, 'Outcome unknown');
  assert.match(pres.headline, /Outcome unknown — do not retry/);

  let sendCalled = false;
  const mockAccount = {
    account: { accountIndex: 0, network: 'ethereum' },
    async send() {
      sendCalled = true;
      return { success: true, hash: MOCK_USER_OP_HASH };
    },
  };

  // Attempting to submit again with the same requestId returns outcome-unknown without calling send()
  const res = await submitOrCheckUsdtTransfer({
    account: mockAccount,
    requestId: interruptedRequestId,
    to: VALID_RECIPIENT,
    amountUsdt: '25.00',
    asset: mockUsdtAsset,
    scopeKey: 'user-crash',
  });

  assert.equal(sendCalled, false);
  assert.equal(res.status, 'outcome-unknown');
  assert.equal(res.confirmed, false);
});

test('Stage 1: Reverted UserOperation (userOpReceipt.success === false) is marked failed, never successful', async () => {
  const storage = createMemoryStorage();
  setPaymentStorageAdapter(storage);

  const mockAccount = {
    extension() {
      return {
        async getUserOperationReceipt() {
          return {
            success: false,
            reason: "AA21 didn't pay prefund",
            receipt: {
              transactionHash: MOCK_TX_HASH,
              blockNumber: 999,
            },
          };
        },
      };
    },
  };

  const receiptStatus = await checkUsdtTransferReceipt({
    account: mockAccount,
    userOperationHash: MOCK_USER_OP_HASH,
  });

  assert.equal(receiptStatus.status, 'failed');
  assert.equal(receiptStatus.confirmed, false);
  assert.equal(receiptStatus.userOperationHash, MOCK_USER_OP_HASH);
  assert.equal(receiptStatus.transactionHash, MOCK_TX_HASH);
});

test('Stage 1: Dropped UserOperation is marked dropped', async () => {
  const storage = createMemoryStorage();
  setPaymentStorageAdapter(storage);

  const mockAccount = {
    extension() {
      return {
        async getTransaction() {
          const err = new Error('No user operation found');
          err.name = 'NoSuchElementError';
          throw err;
        },
        async getUserOperationReceipt() {
          return null;
        },
      };
    },
  };

  const oldSubmittedAt = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const receiptStatus = await checkUsdtTransferReceipt({
    account: mockAccount,
    userOperationHash: MOCK_USER_OP_HASH,
    savedRecord: { submittedAt: oldSubmittedAt },
  });

  assert.equal(receiptStatus.status, 'dropped');
  assert.equal(receiptStatus.confirmed, false);
});

test('Stage 1: Pre-send live balance and fee recheck enforces quote freshness, 15% fee drift cap, and balances', async () => {
  const baseFee = '100000000000000'; // 0.0001 ETH

  // 1. Stale quote (> 2 minutes old)
  const staleAccount = {
    account: { accountIndex: 0, network: 'ethereum' },
    async getBalance() {
      return [
        { assetId: 'usdt', success: true, balance: '100000000' },
        { assetId: 'eth', success: true, balance: '100000000000000000' },
      ];
    },
    async estimateFee() {
      return { success: true, fee: baseFee };
    },
  };

  const staleRes = await recheckLiveBalanceAndFeeBeforeSend({
    account: staleAccount,
    to: VALID_RECIPIENT,
    amountUsdt: '10.00',
    usdtAsset: mockUsdtAsset,
    ethAsset: mockEthAsset,
    reviewedFeeQuote: {
      feeBaseUnits: baseFee,
      feeEth: '0.0001',
      quotedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    },
  });
  assert.equal(staleRes.ok, false);
  assert.equal(staleRes.code, 'STALE_FEE_QUOTE');

  // 2. Fee jumped by 50% (> 15% cap)
  const highFeeAccount = {
    account: { accountIndex: 0, network: 'ethereum' },
    async getBalance() {
      return [
        { assetId: 'usdt', success: true, balance: '100000000' },
        { assetId: 'eth', success: true, balance: '100000000000000000' },
      ];
    },
    async estimateFee() {
      return { success: true, fee: '150000000000000' };
    },
  };

  const driftRes = await recheckLiveBalanceAndFeeBeforeSend({
    account: highFeeAccount,
    to: VALID_RECIPIENT,
    amountUsdt: '10.00',
    usdtAsset: mockUsdtAsset,
    ethAsset: mockEthAsset,
    reviewedFeeQuote: {
      feeBaseUnits: baseFee,
      feeEth: '0.0001',
      quotedAt: new Date().toISOString(),
    },
  });
  assert.equal(driftRes.ok, false);
  assert.equal(driftRes.code, 'FEE_CHANGED_BEYOND_LIMIT');

  // 3. Insufficient live USDT balance
  const lowUsdtAccount = {
    account: { accountIndex: 0, network: 'ethereum' },
    async getBalance() {
      return [
        { assetId: 'usdt', success: true, balance: '2000000' }, // only 2 USDT
        { assetId: 'eth', success: true, balance: '100000000000000000' },
      ];
    },
    async estimateFee() {
      return { success: true, fee: baseFee };
    },
  };

  const lowBalRes = await recheckLiveBalanceAndFeeBeforeSend({
    account: lowUsdtAccount,
    to: VALID_RECIPIENT,
    amountUsdt: '10.00',
    usdtAsset: mockUsdtAsset,
    ethAsset: mockEthAsset,
    reviewedFeeQuote: {
      feeBaseUnits: baseFee,
      feeEth: '0.0001',
      quotedAt: new Date().toISOString(),
    },
  });
  assert.equal(lowBalRes.ok, false);
  assert.equal(lowBalRes.code, 'INSUFFICIENT_USDT_BALANCE');
});

test('Stage 2 & 3: Offline drafts and cached snapshots are clearly labeled and offline signing remains disabled', async () => {
  const storage = createMemoryStorage();
  setPaymentStorageAdapter(storage);

  assert.equal(OFFLINE_SIGNING_ENABLED, false);
  assert.match(OFFLINE_SIGNING_DISABLED_REASON, /EntryPoint v0\.7/);

  const draft = await saveOfflinePaymentDraft({
    scopeKey: 'user-offline',
    to: VALID_RECIPIENT,
    amountUsdt: '15.75',
    note: 'Dinner split',
  });

  assert.equal(draft.status, 'draft');
  assert.equal(draft.statusLabel, 'Draft — not sent');
  assert.equal(draft.offlineSigningEnabled, false);

  const drafts = await listOfflinePaymentDrafts('user-offline');
  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].draftId, draft.draftId);

  await deleteOfflinePaymentDraft(draft.draftId, 'user-offline');
  const afterDelete = await listOfflinePaymentDrafts('user-offline');
  assert.equal(afterDelete.length, 0);

  // Cached wallet snapshot
  await saveCachedWalletSnapshot('user-offline', {
    address: VALID_SENDER,
    usdtBalance: 42.5,
    ethBalance: 0.025,
    transactions: [{ id: 'tx-1', amount: '10.00', status: 'confirmed' }],
  });

  const cached = await loadCachedWalletSnapshot('user-offline');
  assert.equal(cached.address, VALID_SENDER);
  assert.equal(cached.usdtBalance, 42.5);
  assert.equal(cached.ethBalance, 0.025);
  assert.ok(cached.lastUpdatedAt);
});

test('Stage 1 Backend: recordSelfCustodyPaymentStatus is idempotent, enforces distinct hashes, and rejects conflicting mutations', async () => {
  const userId = 'user-backend-test';
  const requestId = createPaymentRequestId();

  const first = await backendWalletService.recordSelfCustodyPaymentStatus(userId, {
    requestId,
    senderAddress: VALID_SENDER,
    recipientAddress: VALID_RECIPIENT,
    amountUsdt: '18.00',
    tokenSymbol: 'USDT',
    tokenContractAddress: WDK_SEPOLIA_USDT_ADDRESS,
    chainId: WDK_SEPOLIA_CHAIN_ID,
    status: 'pending',
    userOperationHash: MOCK_USER_OP_HASH,
    // Even if client mistakenly passes userOperationHash as transactionHash, backend strips it
    transactionHash: MOCK_USER_OP_HASH,
  });

  assert.equal(first.status, 'pending');
  assert.equal(first.userOperationHash, MOCK_USER_OP_HASH);
  assert.equal(first.transactionHash, null);

  // Updating the same requestId with confirmed on-chain transactionHash succeeds idempotently
  const updated = await backendWalletService.recordSelfCustodyPaymentStatus(userId, {
    requestId,
    senderAddress: VALID_SENDER,
    recipientAddress: VALID_RECIPIENT,
    amountUsdt: '18.00',
    tokenSymbol: 'USDT',
    tokenContractAddress: WDK_SEPOLIA_USDT_ADDRESS,
    chainId: WDK_SEPOLIA_CHAIN_ID,
    status: 'successful',
    userOperationHash: MOCK_USER_OP_HASH,
    transactionHash: MOCK_TX_HASH,
  });

  assert.equal(updated.status, 'successful');
  assert.equal(updated.userOperationHash, MOCK_USER_OP_HASH);
  assert.equal(updated.transactionHash, MOCK_TX_HASH);

  // Attempting to reuse requestId with a different amount or recipient throws 409 conflict
  assert.throws(
    () =>
      backendWalletService.recordSelfCustodyPaymentStatus(userId, {
        requestId,
        senderAddress: VALID_SENDER,
        recipientAddress: VALID_RECIPIENT,
        amountUsdt: '999.00',
        status: 'successful',
      }),
    (err) => err.statusCode === 409
  );
});

test('Stage 3 & 5: QR/NFC payment payload parser rejects expired requests, wrong chain, wrong token, and token contract recipient', () => {
  // Valid payload
  const uri = buildReceiveQrPayload(
    {
      userId: 'user-qr',
      address: VALID_RECIPIENT,
      walletSetupRequired: false,
      isVerifiedUserWallet: true,
    },
    'user-qr',
    '14.25'
  );
  const parsed = parseAndValidateUsdtQr(uri);
  assert.equal(parsed.valid, true);
  assert.equal(parsed.recipientAddress.toLowerCase(), VALID_RECIPIENT.toLowerCase());
  assert.equal(parsed.amountUsdt, '14.25');

  // Expired payload
  const expiredJson = JSON.stringify({
    address: VALID_RECIPIENT,
    token: 'USDT',
    contractAddress: WDK_SEPOLIA_USDT_ADDRESS,
    chainId: WDK_SEPOLIA_CHAIN_ID,
    amount: '10.00',
    expiresAt: new Date(Date.now() - 60_000).toISOString(),
  });
  const expiredRes = parseAndValidateUsdtQr(expiredJson);
  assert.equal(expiredRes.valid, false);
  assert.match(expiredRes.error, /expired/i);

  // Wrong chain ID
  const wrongChainJson = JSON.stringify({
    address: VALID_RECIPIENT,
    token: 'USDT',
    contractAddress: WDK_SEPOLIA_USDT_ADDRESS,
    chainId: 1,
    amount: '10.00',
  });
  const wrongChainRes = parseAndValidateUsdtQr(wrongChainJson);
  assert.equal(wrongChainRes.valid, false);
  assert.match(wrongChainRes.error, /Unsupported network/i);

  // Sepolia USDT contract address as recipient
  const contractRecipientRes = parseAndValidateUsdtQr(WDK_SEPOLIA_USDT_ADDRESS);
  assert.equal(contractRecipientRes.valid, false);
  assert.match(contractRecipientRes.error, /token contract/i);
});

test('Stage 2 & 5: Offline startup restores non-expired local session without logging out, enforces session lock, and supports offline password unlock', async () => {
  const storage = createMemoryStorage();
  setAuthStorageAdapter(storage);
  setSessionLockStorageAdapter(storage);

  // Create a synthetic JWT with future exp (e.g. +1 hour)
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      sub: 'user-offline-auth',
      exp: Math.floor(Date.now() / 1000) + 3600,
    })
  ).toString('base64url');
  const fakeToken = `${header}.${payload}.signature`;

  // 1. Online signIn stores session and offline password verifier
  setAuthFetchAdapter(async (url) => {
    if (String(url).endsWith('/auth/login')) {
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            data: {
              token: fakeToken,
              user: {
                id: 'user-offline-auth',
                email: 'offline@interlink.test',
                name: 'Offline Tester',
              },
            },
          };
        },
      };
    }
    throw new Error('Unexpected URL');
  });

  const loginRes = await mobileAuthService.signIn(
    'offline@interlink.test',
    'CorrectHorseBatteryStaple!1'
  );
  assert.equal(loginRes.offline, false);
  assert.equal(loginRes.user.id, 'user-offline-auth');

  // Lock the session before simulating offline restart
  await sessionLockService.lock();
  assert.equal(sessionLockService.memoryIsLocked, true);

  // 2. Simulate app restart while completely offline (fetch throws network error without HTTP status)
  setAuthFetchAdapter(async () => {
    throw new TypeError('Network request failed');
  });

  const restoredOffline = await mobileAuthService.restoreSession();
  assert.ok(restoredOffline, 'Offline startup must not wipe a valid non-expired local session');
  assert.equal(restoredOffline.offline, true);
  assert.equal(restoredOffline.user.id, 'user-offline-auth');
  assert.equal(sessionLockService.memoryIsLocked, true, 'Offline startup must preserve lock state');

  // 3. Offline unlock with wrong password fails; right password unlocks locally
  await assert.rejects(
    () => mobileAuthService.reauthenticate('WrongPassword123'),
    /Offline unlock failed/
  );

  const reauthRes = await mobileAuthService.reauthenticate('CorrectHorseBatteryStaple!1');
  assert.equal(reauthRes.offline, true);
  assert.equal(sessionLockService.memoryIsLocked, false);

  // 4. Server 401 on reconnect clears session
  setAuthFetchAdapter(async () => ({
    ok: false,
    status: 401,
    async json() {
      return { message: 'Token revoked' };
    },
  }));

  const afterRevoke = await mobileAuthService.restoreSession();
  assert.equal(afterRevoke, null);
});
