import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const WALLET_STORE_PATH = path.join(DATA_DIR, 'wallets.json');
const TX_STORE_PATH = path.join(DATA_DIR, 'transactions.json');
const REQUESTS_STORE_PATH = path.join(DATA_DIR, 'paymentRequests.json');
const SPLITS_STORE_PATH = path.join(DATA_DIR, 'splitPayments.json');
const LINKS_STORE_PATH = path.join(DATA_DIR, 'paymentLinks.json');
const NOTIF_STORE_PATH = path.join(DATA_DIR, 'notifications.json');
const AUDIT_STORE_PATH = path.join(DATA_DIR, 'auditLogs.json');
const SELF_CUSTODY_PAYMENTS_PATH = path.join(DATA_DIR, 'selfCustodyPayments.json');

// Helper to load or initialize JSON store
const loadStore = (filePath, defaultVal = {}) => {
  if (fs.existsSync(filePath)) {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
      return defaultVal;
    }
  }
  return defaultVal;
};

const saveStore = (filePath, data) => {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error(`[WalletService] Error saving ${path.basename(filePath)}:`, err.message);
  }
};

// Keep legacy private keys and mnemonics off the server process heap. The legacy file
// is intentionally preserved for a controlled recovery/migration; never write it back.
const loadPublicWalletCache = () => Object.fromEntries(
  Object.entries(loadStore(WALLET_STORE_PATH, {})).map(([userId, record]) => [userId, {
    userId,
    address: record.address,
    publicKey: record.publicKey,
    network: record.network,
    contractAddress: record.contractAddress,
    assetSymbol: record.assetSymbol,
    createdAt: record.createdAt,
  }]),
);
let walletCache = loadPublicWalletCache();
let txCache = loadStore(TX_STORE_PATH, []);
let requestCache = loadStore(REQUESTS_STORE_PATH, []);
let splitCache = loadStore(SPLITS_STORE_PATH, []);
let linkCache = loadStore(LINKS_STORE_PATH, []);
let notifCache = loadStore(NOTIF_STORE_PATH, []);
let auditCache = loadStore(AUDIT_STORE_PATH, []);
let selfCustodyPaymentsCache = loadStore(SELF_CUSTODY_PAYMENTS_PATH, []);
const processedIdempotencyKeys = new Set();

// Standard Tether (ERC-20 USDT) Interface ABI
export const TETHER_ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
];

class WalletService {
  constructor() {
    this.network = process.env.TETHER_NETWORK || 'Sepolia';
    this.rpcUrl = process.env.TETHER_RPC_URL || 'https://rpc.sepolia.org';
    this.contractAddress = process.env.TETHER_USDT_CONTRACT_ADDRESS || '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06';
    this.provider = null;

    try {
      if (this.rpcUrl) {
        const staticSepoliaNetwork = ethers.Network.from(11155111);
        this.provider = new ethers.JsonRpcProvider(this.rpcUrl, staticSepoliaNetwork, {
          staticNetwork: staticSepoliaNetwork,
        });
      }
    } catch (err) {
      console.warn('[WalletService] Could not connect to RPC provider:', err.message);
    }
  }

  logAudit(action, actor, details = {}) {
    const entry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      action,
      actor,
      details,
      timestamp: new Date().toISOString(),
    };
    auditCache.unshift(entry);
    if (auditCache.length > 500) auditCache.pop();
    saveStore(AUDIT_STORE_PATH, auditCache);
  }

  recordAuditLog(action, actor, details = {}) {
    return this.logAudit(action, actor, details);
  }

  readAuditLogs() {
    return auditCache;
  }

  readTransactions() {
    return txCache;
  }

  readWallets() {
    return Object.fromEntries(Object.entries(walletCache).map(([userId, record]) => [userId, this.formatSafeWallet(record)]));
  }

  addNotification(userId, title, message, type = 'info', metadata = {}) {
    const notif = {
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      userId,
      title,
      message,
      type,
      read: false,
      metadata,
      createdAt: new Date().toISOString(),
    };
    notifCache.unshift(notif);
    if (notifCache.length > 300) notifCache.pop();
    saveStore(NOTIF_STORE_PATH, notifCache);
    return notif;
  }

  getNotifications(userId) {
    return notifCache.filter(
      (n) => n.userId === userId || n.userId === 'all'
    );
  }

  markNotificationRead(notifId, userId) {
    const notif = notifCache.find((n) => n.id === notifId && (n.userId === userId || n.userId === 'all'));
    if (notif) {
      notif.read = true;
      saveStore(NOTIF_STORE_PATH, notifCache);
    }
    return notif;
  }

  /** Wallet keys must be generated and held by the user's wallet client. */
  generateUserWallet(userId) {
    throw new Error('Server-side wallet creation is disabled. Create the wallet in the user-controlled WDK client; the server must never receive its recovery phrase or private key.');
  }

  getOrCreateWallet(userId) {
    if (!userId) return null;
    if (walletCache[userId]) {
      return this.formatSafeWallet(walletCache[userId]);
    }
    return null;
  }

  async getTetherBalance(address) {
    try {
      if (this.provider && this.contractAddress && ethers.isAddress(address)) {
        const tetherContract = new ethers.Contract(this.contractAddress, TETHER_ERC20_ABI, this.provider);
        const rawBalance = await tetherContract.balanceOf(address);
        const decimals = await tetherContract.decimals().catch(() => 6);
        const formatted = ethers.formatUnits(rawBalance, decimals);
        return parseFloat(formatted);
      }
    } catch (error) {
      throw new Error(`Blockchain balance lookup failed: ${error.message}`);
    }
    throw new Error('Blockchain RPC or verified token contract is not configured. Balance is unavailable.');
  }

  verifySignature(address, message, signature) {
    try {
      const recoveredAddress = ethers.verifyMessage(message, signature);
      return recoveredAddress.toLowerCase() === address.toLowerCase();
    } catch {
      return false;
    }
  }

  /**
   * Find internal user by address, email, or username
   */
  findUserByIdentifier(identifier) {
    if (!identifier) return null;
    const clean = identifier.trim().toLowerCase().replace(/^@/, '');

    // By userId / email
    if (walletCache[clean]) return walletCache[clean];

    // By address
    const byAddress = Object.values(walletCache).find(
      (w) => w.address.toLowerCase() === clean
    );
    if (byAddress) return byAddress;

    // By partial email username
    const byEmailPrefix = Object.values(walletCache).find(
      (w) => w.userId.toLowerCase().split('@')[0] === clean
    );
    if (byEmailPrefix) return byEmailPrefix;

    return null;
  }

  /**
   * Authoritative P2P Send USDT transaction with double-spend protection & atomic balance update
   */
  async transfer({ senderUserId, recipientIdentifier, amountUsdt, note = '', idempotencyKey = '' }) {
    throw new Error('Transfers are disabled until client-side wallet signing, authenticated ownership, transaction submission, and chain receipt verification are implemented. No ledger transfer was recorded.');
  }

  /**
   * Request money from another user
   */
  createPaymentRequest({ requesterUserId, payerIdentifier, amountUsdt, note = '' }) {
    const num = Number(amountUsdt);
    if (!num || num <= 0) throw new Error('Request amount must be greater than 0 USDT.');

    const requester = walletCache[requesterUserId];
    if (!requester) throw new Error('Requester wallet not found.');

    const payer = this.findUserByIdentifier(payerIdentifier);

    const request = {
      id: `req-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      requesterUserId,
      requesterAddress: requester.address,
      payerIdentifier,
      payerUserId: payer ? payer.userId : null,
      amountUsdt: num,
      note: note || 'Payment requested on AssetBridge',
      status: 'pending', // 'pending' | 'completed' | 'declined' | 'cancelled'
      createdAt: new Date().toISOString(),
    };

    requestCache.unshift(request);
    saveStore(REQUESTS_STORE_PATH, requestCache);

    if (payer) {
      this.addNotification(
        payer.userId,
        'New Payment Request',
        `${requesterUserId} requested $${num.toFixed(2)} USDT: "${note || 'Payment'}"`,
        'warning',
        { requestId: request.id }
      );
    }

    return request;
  }

  /**
   * Fulfill a payment request
   */
  async fulfillPaymentRequest({ requestId, payerUserId }) {
    const req = requestCache.find((r) => r.id === requestId);
    if (!req) throw new Error('Payment request not found.');
    if (req.status !== 'pending') throw new Error(`Request cannot be fulfilled. Current status: ${req.status}`);

    const transferResult = await this.transfer({
      senderUserId: payerUserId,
      recipientIdentifier: req.requesterAddress,
      amountUsdt: req.amountUsdt,
      note: `Fulfilled request: ${req.note}`,
    });

    req.status = 'completed';
    req.fulfilledAt = new Date().toISOString();
    req.txHash = transferResult.txHash;
    saveStore(REQUESTS_STORE_PATH, requestCache);

    return { request: req, transfer: transferResult };
  }

  getPaymentRequests(userId) {
    return requestCache.filter(
      (r) => r.requesterUserId === userId || r.payerUserId === userId || r.payerIdentifier === userId
    );
  }

  /**
   * Shareable Payment Link (WhatsApp / URL)
   */
  createPaymentLink({ creatorUserId, amountUsdt, description = '', expiresInHours = 48 }) {
    const creator = walletCache[creatorUserId];
    if (!creator) throw new Error('Creator wallet not found.');

    const num = Number(amountUsdt);
    if (!num || num <= 0) throw new Error('Amount must be greater than 0 USDT.');

    const linkId = `link_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString();

    const link = {
      id: linkId,
      creatorUserId,
      creatorAddress: creator.address,
      amountUsdt: num,
      description: description || 'AssetBridge Payment Request',
      status: 'active', // 'active' | 'completed' | 'expired'
      expiresAt,
      createdAt: new Date().toISOString(),
    };

    linkCache.unshift(link);
    saveStore(LINKS_STORE_PATH, linkCache);

    this.logAudit('PAYMENT_LINK_CREATED', creatorUserId, { linkId, amount: num });
    return link;
  }

  getPaymentLink(linkId) {
    const link = linkCache.find((l) => l.id === linkId);
    if (!link) return null;
    if (new Date() > new Date(link.expiresAt) && link.status === 'active') {
      link.status = 'expired';
      saveStore(LINKS_STORE_PATH, linkCache);
    }
    return link;
  }

  async payPaymentLink({ linkId, payerUserId }) {
    const link = this.getPaymentLink(linkId);
    if (!link) throw new Error('Payment link not found.');
    if (link.status === 'completed') throw new Error('This payment link has already been paid.');
    if (link.status === 'expired') throw new Error('This payment link has expired.');

    const transfer = await this.transfer({
      senderUserId: payerUserId,
      recipientIdentifier: link.creatorAddress,
      amountUsdt: link.amountUsdt,
      note: `Payment for link: ${link.description}`,
    });

    link.status = 'completed';
    link.paidByUserId = payerUserId;
    link.txHash = transfer.txHash;
    link.paidAt = new Date().toISOString();
    saveStore(LINKS_STORE_PATH, linkCache);

    return { link, transfer };
  }

  /**
   * Group Split Payments (Split bill among multiple friends)
   */
  createSplitPayment({ creatorUserId, title, targetAmountUsdt, participantIdentifiers = [] }) {
    const creator = walletCache[creatorUserId];
    if (!creator) throw new Error('Creator wallet not found.');

    const total = Number(targetAmountUsdt);
    if (!total || total <= 0) throw new Error('Target amount must be greater than 0 USDT.');

    const participants = [
      {
        userId: creatorUserId,
        name: `${creatorUserId.split('@')[0]} (Organizer)`,
        assignedAmount: 0,
        paid: false,
        paidAt: null,
      },
      ...participantIdentifiers.map((id, idx) => ({
        userId: id,
        name: id.includes('@') ? id.split('@')[0] : `Participant ${idx + 2}`,
        assignedAmount: 0,
        paid: false,
        paidAt: null,
      })),
    ];

    // Equal split default
    const share = Math.round((total / participants.length) * 100) / 100;
    participants.forEach((p) => { p.assignedAmount = share; });

    const split = {
      id: `split-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      creatorUserId,
      creatorAddress: creator.address,
      title: title || 'Group Shared Expense',
      targetAmountUsdt: total,
      collectedAmountUsdt: 0,
      status: 'collecting', // 'collecting' | 'completed' | 'cancelled'
      participants,
      createdAt: new Date().toISOString(),
    };

    splitCache.unshift(split);
    saveStore(SPLITS_STORE_PATH, splitCache);

    this.logAudit('SPLIT_PAYMENT_CREATED', creatorUserId, { splitId: split.id, total });
    return split;
  }

  async contributeToSplitPayment({ splitId, contributorUserId, amountUsdt }) {
    const split = splitCache.find((s) => s.id === splitId);
    if (!split) throw new Error('Split payment not found.');
    if (split.status === 'completed') throw new Error('This split payment is already 100% funded.');

    const participant = split.participants.find(
      (p) => p.userId.toLowerCase() === contributorUserId.toLowerCase()
    );
    if (!participant) throw new Error('You are not registered as a participant in this split payment.');
    if (participant.paid) throw new Error('You have already paid your contribution for this shared expense.');

    const num = Number(amountUsdt) || participant.assignedAmount;
    if (num <= 0) throw new Error('Contribution amount must be positive.');

    // Execute transfer to organizer/vault
    const transfer = await this.transfer({
      senderUserId: contributorUserId,
      recipientIdentifier: split.creatorAddress,
      amountUsdt: num,
      note: `Split payment contribution for ${split.title}`,
    });

    participant.paid = true;
    participant.paidAmount = num;
    participant.paidAt = new Date().toISOString();
    participant.txHash = transfer.txHash;

    split.collectedAmountUsdt = Math.round((split.collectedAmountUsdt + num) * 100) / 100;

    const allPaid = split.participants.every((p) => p.paid);
    if (allPaid || split.collectedAmountUsdt >= split.targetAmountUsdt) {
      split.status = 'completed';
      split.completedAt = new Date().toISOString();
      this.addNotification(
        split.creatorUserId,
        'Split Payment Complete!',
        `Your shared expense "${split.title}" has reached its target of $${split.targetAmountUsdt} USDT.`,
        'success'
      );
    }

    saveStore(SPLITS_STORE_PATH, splitCache);
    return { split, transfer };
  }

  getSplitPayments(userId) {
    return splitCache.filter(
      (s) =>
        s.creatorUserId.toLowerCase() === userId.toLowerCase() ||
        s.participants.some((p) => p.userId.toLowerCase() === userId.toLowerCase())
    );
  }

  /**
   * Deposit Faucet for testing
   */
  depositFaucet(userId, amountUsdt = 250) {
    throw new Error('Server-side faucet credits are disabled. Request test tokens from a verified network faucet. No balance was credited.');
  }

  getTransactions(userId) {
    const userWallet = walletCache[userId];
    const userAddr = userWallet?.address?.toLowerCase();

    return txCache.filter(
      (t) =>
        t.senderUserId === userId ||
        t.recipientIdentifier === userId ||
        (userAddr && t.recipientAddress?.toLowerCase() === userAddr) ||
        (userAddr && t.senderAddress?.toLowerCase() === userAddr)
    );
  }

  /**
   * Idempotently records or updates a self-custody WDK payment status record scoped to the authenticated user.
   * The server never signs or moves funds; it only stores status metadata for reconciliation.
   * Never conflates userOperationHash with transactionHash.
   */
  recordSelfCustodyPaymentStatus(userId, payload = {}) {
    if (!userId) throw new Error('Authenticated userId is required.');
    const requestId = String(payload.requestId || '').trim();
    if (!requestId || requestId.length > 128) {
      throw new Error('A valid payment requestId is required.');
    }

    const chainId = Number(payload.chainId ?? 11155111);
    if (chainId !== 11155111) {
      throw new Error(`Unsupported chainId (${chainId}). Only Ethereum Sepolia (11155111) is allowed.`);
    }

    const tokenContract = String(
      payload.tokenContractAddress || this.contractAddress
    ).trim();
    if (tokenContract.toLowerCase() !== this.contractAddress.toLowerCase()) {
      throw new Error(`Unsupported tokenContractAddress (${tokenContract}).`);
    }

    const recipientAddress = String(payload.recipientAddress || '').trim();
    if (!ethers.isAddress(recipientAddress)) {
      throw new Error('A valid 0x recipientAddress is required.');
    }
    if (
      recipientAddress.toLowerCase() === this.contractAddress.toLowerCase() ||
      recipientAddress.toLowerCase() === '0x0000000000000000000000000000000000000000'
    ) {
      throw new Error('Token contract or zero address cannot be used as a recipientAddress.');
    }

    const amountUsdt = String(payload.amountUsdt ?? '').trim();
    if (!amountUsdt || Number(amountUsdt) <= 0) {
      throw new Error('A positive amountUsdt is required.');
    }

    const allowedStatuses = new Set([
      'draft',
      'approved',
      'submitting',
      'submitted',
      'pending',
      'successful',
      'failed',
      'dropped',
      'outcome-unknown',
      'expired',
    ]);
    const status = String(payload.status || 'pending').trim().toLowerCase();
    if (!allowedStatuses.has(status)) {
      throw new Error(`Unsupported payment status "${status}".`);
    }

    const userOperationHash = payload.userOperationHash
      ? String(payload.userOperationHash).trim()
      : null;
    let transactionHash = payload.transactionHash
      ? String(payload.transactionHash).trim()
      : null;

    // Never allow userOperationHash to be stored as transactionHash
    if (
      userOperationHash &&
      transactionHash &&
      userOperationHash.toLowerCase() === transactionHash.toLowerCase()
    ) {
      transactionHash = null;
    }

    const nowIso = new Date().toISOString();
    const existingIdx = selfCustodyPaymentsCache.findIndex(
      (r) => r.userId === userId && r.requestId === requestId
    );

    if (existingIdx !== -1) {
      const existing = selfCustodyPaymentsCache[existingIdx];
      if (
        existing.recipientAddress.toLowerCase() !== recipientAddress.toLowerCase() ||
        String(existing.amountUsdt) !== amountUsdt
      ) {
        const conflictError = new Error(
          'Idempotency conflict: requestId is already registered with different payment parameters.'
        );
        conflictError.statusCode = 409;
        throw conflictError;
      }

      const updated = {
        ...existing,
        status,
        userOperationHash: userOperationHash || existing.userOperationHash || null,
        transactionHash: transactionHash || existing.transactionHash || null,
        feeEth: payload.feeEth ?? existing.feeEth ?? null,
        lastCheckedAt: payload.lastCheckedAt || nowIso,
        updatedAt: nowIso,
      };
      selfCustodyPaymentsCache[existingIdx] = updated;
      saveStore(SELF_CUSTODY_PAYMENTS_PATH, selfCustodyPaymentsCache);
      return updated;
    }

    const created = {
      id: `scpay_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      userId,
      requestId,
      senderAddress: payload.senderAddress || null,
      recipientAddress,
      amountUsdt,
      amountBaseUnits: payload.amountBaseUnits || null,
      chainId,
      tokenContractAddress: this.contractAddress,
      tokenSymbol: 'USDT',
      status,
      userOperationHash,
      transactionHash,
      feeEth: payload.feeEth || null,
      note: String(payload.note || '').slice(0, 140),
      createdAt: nowIso,
      lastCheckedAt: payload.lastCheckedAt || nowIso,
      updatedAt: nowIso,
    };

    selfCustodyPaymentsCache.unshift(created);
    if (selfCustodyPaymentsCache.length > 500) selfCustodyPaymentsCache.pop();
    saveStore(SELF_CUSTODY_PAYMENTS_PATH, selfCustodyPaymentsCache);
    this.logAudit('SELF_CUSTODY_PAYMENT_STATUS_SYNC', userId, {
      requestId,
      status,
      userOperationHash,
      transactionHash,
    });
    return created;
  }

  getSelfCustodyPaymentStatuses(userId) {
    if (!userId) return [];
    return selfCustodyPaymentsCache.filter((r) => r.userId === userId);
  }

  async verifyBlockchainTx(txHash) {
    if (!ethers.isHexString(txHash, 32)) throw new Error('A valid 32-byte transaction hash is required.');
    if (!this.provider) throw new Error('Blockchain RPC is unavailable; transaction status cannot be verified.');
    const onChainReceipt = await this.provider.getTransactionReceipt(txHash);
    if (!onChainReceipt) return { txHash, status: 'pending', confirmed: false, blockNumber: null };
    if (onChainReceipt.status === 0) return { txHash, status: 'failed', confirmed: false, blockNumber: onChainReceipt.blockNumber };
    const latestBlock = await this.provider.getBlockNumber();
    const confirmations = Math.max(0, latestBlock - onChainReceipt.blockNumber + 1);
    const requiredConfirmations = 12;
    return {
      txHash,
      status: confirmations >= requiredConfirmations ? 'successful' : 'pending',
      confirmed: confirmations >= requiredConfirmations,
      confirmations,
      requiredConfirmations,
      blockNumber: onChainReceipt.blockNumber,
    };
  }

  // Admin stats
  getAdminStats() {
    const users = Object.values(walletCache);
    const totalUsdt = users.reduce((acc, u) => acc + (u.balanceUsdt || 0), 0);
    const totalTxs = txCache.length;
    const totalVolume = txCache.reduce((acc, t) => acc + (t.amountUsdt || 0), 0);
    const activeSplits = splitCache.filter((s) => s.status === 'collecting').length;

    return {
      totalUsers: users.length,
      totalUsdtCirculating: Math.round(totalUsdt * 100) / 100,
      totalTransactions: totalTxs,
      totalVolumeUsdt: Math.round(totalVolume * 100) / 100,
      activeSplitPayments: activeSplits,
      recentAuditLogs: auditCache.slice(0, 15),
    };
  }

  getAdminUsers() {
    return Object.values(walletCache).map(this.formatSafeWallet);
  }

  getAdminTransactions() {
    return txCache.slice(0, 100);
  }

  getAdminAuditLogs() {
    return auditCache;
  }

  formatSafeWallet(walletRecord) {
    return {
      userId: walletRecord.userId,
      address: walletRecord.address,
      publicKey: walletRecord.publicKey,
      network: walletRecord.network,
      contractAddress: walletRecord.contractAddress,
      assetSymbol: walletRecord.assetSymbol,
      balanceUsdt: null,
      tokenHoldings: {},
      createdAt: walletRecord.createdAt,
    };
  }
}

export const walletService = new WalletService();
