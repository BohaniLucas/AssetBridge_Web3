import { API_BASE_URL } from '../config/api';
import { mobileAuthService } from './authService';

const authHeaders = async () => {
  const token = await mobileAuthService.getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/**
 * Single shared wallet & QR configuration for Ethereum Sepolia USDT.
 * Never treat the ERC-20 token contract address as a user's personal wallet.
 */
export const SUPPORTED_WALLET_CONFIG = {
  networkKey: 'ethereum-sepolia',
  networkName: 'Ethereum Sepolia',
  networkLabel: 'Ethereum Sepolia (Chain ID: 11155111)',
  chainId: 11155111,
  tokenSymbol: 'USDT',
  tokenName: 'Tether USD (Sepolia Testnet)',
  tokenDecimals: 6,
  tokenContractAddress: '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06',
  forbiddenNonUserAddresses: [
    '0x7169d38820dfd117c3fa1f22a697dba58d90ba06', // Sepolia USDT token contract
    '0xd077a400968890eacc75cdc901f0356c943e4fdb', // Candide Sepolia USDT token contract
    '0x0000000000000000000000000000000000000000', // Zero address
  ],
};

const HEX_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

/**
 * Checks if a raw string is a syntactically valid Ethereum address AND not a known token contract or burn address.
 */
export function isSafePersonalEvmAddress(address) {
  if (!address || typeof address !== 'string') return false;
  const trimmed = address.trim();
  if (!HEX_ADDRESS_REGEX.test(trimmed)) return false;
  const lower = trimmed.toLowerCase();
  if (SUPPORTED_WALLET_CONFIG.forbiddenNonUserAddresses.includes(lower)) {
    return false;
  }
  return true;
}

/**
 * Verifies that a wallet object contains a genuine, user-controlled personal wallet address
 * owned by the currently signed-in account (never the Sepolia USDT token contract).
 */
export function isVerifiedUserWallet(wallet, currentUserId) {
  if (!wallet || typeof wallet !== 'object') return false;
  if (wallet.walletSetupRequired === true || wallet.isVerifiedUserWallet === false) {
    return false;
  }
  if (currentUserId && wallet.userId && String(wallet.userId).toLowerCase() !== String(currentUserId).toLowerCase()) {
    return false;
  }
  return isSafePersonalEvmAddress(wallet.address);
}

/**
 * Converts integer base units (BigInt or string) to major decimal string (up to 6 decimals).
 */
export function formatBaseUnitsToUsdt(baseUnitsStr, decimals = SUPPORTED_WALLET_CONFIG.tokenDecimals) {
  const raw = BigInt(baseUnitsStr);
  if (raw <= 0n) throw new Error('QR payment amount must be greater than zero.');
  const s = raw.toString().padStart(decimals + 1, '0');
  const whole = s.slice(0, s.length - decimals) || '0';
  const frac = s.slice(s.length - decimals).replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : whole;
}

/**
 * Converts major decimal string (e.g. "25.5") to integer base units string.
 */
export function parseUsdtToBaseUnits(amountStr, decimals = SUPPORTED_WALLET_CONFIG.tokenDecimals) {
  const clean = String(amountStr || '').trim();
  if (!/^\d+(\.\d+)?$/.test(clean)) {
    throw new Error('Invalid USDT amount format.');
  }
  const [whole, frac = ''] = clean.split('.');
  if (frac.length > decimals) {
    throw new Error(`USDT supports at most ${decimals} decimal places.`);
  }
  const paddedFrac = frac.padEnd(decimals, '0');
  const base = BigInt(`${whole}${paddedFrac}`);
  if (base <= 0n) {
    throw new Error('Amount must be greater than zero.');
  }
  return base.toString();
}

/**
 * Builds a canonical EIP-681 payment request payload for a verified user-owned wallet address.
 * Never encodes a token contract address or unverified wallet.
 */
export function buildReceiveQrPayload(wallet, currentUserId, optionalAmountUsdt = '') {
  if (!isVerifiedUserWallet(wallet, currentUserId)) {
    throw new Error(
      'Wallet setup required: Cannot generate a receive QR without a verified user-controlled wallet address.'
    );
  }
  const userAddress = wallet.address.trim();
  const baseUri = `ethereum:${SUPPORTED_WALLET_CONFIG.tokenContractAddress}@${SUPPORTED_WALLET_CONFIG.chainId}/transfer`;
  const params = [`address=${userAddress}`];

  if (optionalAmountUsdt && String(optionalAmountUsdt).trim() !== '') {
    const uint256 = parseUsdtToBaseUnits(optionalAmountUsdt, SUPPORTED_WALLET_CONFIG.tokenDecimals);
    params.push(`uint256=${uint256}`);
  }

  return `${baseUri}?${params.join('&')}`;
}

function safeDecodeURIComponent(value) {
  try {
    return decodeURIComponent(String(value).replace(/\+/g, '%20'));
  } catch {
    throw new Error('Malformed URL encoding in QR code payload.');
  }
}

function parseQueryString(queryStr) {
  const out = {};
  if (!queryStr) return out;
  for (const part of queryStr.split('&')) {
    if (!part) continue;
    const idx = part.indexOf('=');
    if (idx === -1) {
      out[safeDecodeURIComponent(part).trim()] = '';
    } else {
      const k = safeDecodeURIComponent(part.slice(0, idx)).trim();
      const v = safeDecodeURIComponent(part.slice(idx + 1)).trim();
      out[k] = v;
    }
  }
  return out;
}

const SUPPORTED_QR_BARCODE_TYPES = new Set([
  'qr',
  'org.iso.qrcode',
  '256',
  'qr_code',
  'com.google.zxing.client.android.qr_code',
]);

/**
 * Strictly parses and validates scanned QR codes for Ethereum Sepolia USDT transfers.
 * Accepts either a raw string or an expo-camera BarcodeScanningResult object ({ type, data, raw }).
 *
 * Supported formats:
 * 1. EIP-681 ERC-20 transfer: ethereum:0x7169...@11155111/transfer?address=0xRecipient&uint256=50000000
 * 2. EIP-681 address URI:     ethereum:0xRecipient@11155111?amount=50&token=USDT
 * 3. AssetBridge JSON / URI:  assetbridge://pay?address=0xRecipient&chainId=11155111&token=USDT&amount=50&expiresAt=...
 * 4. Plain Ethereum address:  0xRecipient (40 hex chars)
 *
 * Rejects non-QR barcode types, malformed QRs, unsupported networks/chain IDs,
 * unsupported tokens/contracts, expired requests, and the Sepolia USDT token contract address itself.
 */
export function parseAndValidateUsdtQr(scanInput) {
  if (!scanInput) {
    return { valid: false, error: 'Scanned QR code is empty or unreadable.' };
  }

  let rawPayload = scanInput;
  if (typeof scanInput === 'object') {
    if (scanInput.type != null && String(scanInput.type).trim() !== '') {
      const normalizedType = String(scanInput.type).trim().toLowerCase();
      if (!SUPPORTED_QR_BARCODE_TYPES.has(normalizedType)) {
        return {
          valid: false,
          error: `Unsupported barcode type "${scanInput.type}". Only QR codes are supported.`,
        };
      }
    }
    rawPayload =
      typeof scanInput.data === 'string' && scanInput.data.trim() !== ''
        ? scanInput.data
        : typeof scanInput.raw === 'string'
        ? scanInput.raw
        : '';
  }

  if (!rawPayload || typeof rawPayload !== 'string') {
    return { valid: false, error: 'Scanned QR code is empty or unreadable.' };
  }

  const trimmed = rawPayload.trim();
  if (!trimmed || trimmed.length > 1024) {
    return { valid: false, error: 'Malformed QR code payload.' };
  }

  let recipientAddress = null;
  let chainId = SUPPORTED_WALLET_CONFIG.chainId;
  let tokenSymbol = SUPPORTED_WALLET_CONFIG.tokenSymbol;
  let contractAddress = SUPPORTED_WALLET_CONFIG.tokenContractAddress;
  let amountUsdt = null;
  let expiresAt = null;
  let note = '';

  // Case 1: Plain 0x address
  if (HEX_ADDRESS_REGEX.test(trimmed)) {
    recipientAddress = trimmed;
  }
  // Case 2: JSON payload (including malformed JSON starting with '{')
  else if (trimmed.startsWith('{')) {
    let parsedJson;
    try {
      parsedJson = JSON.parse(trimmed);
    } catch {
      return { valid: false, error: 'Malformed JSON QR code.' };
    }
    if (!parsedJson || typeof parsedJson !== 'object' || Array.isArray(parsedJson)) {
      return { valid: false, error: 'Malformed JSON QR code.' };
    }
    recipientAddress = parsedJson.address || parsedJson.recipient || parsedJson.to || null;
    if (parsedJson.chainId != null) chainId = Number(parsedJson.chainId);
    if (parsedJson.token || parsedJson.symbol) {
      tokenSymbol = String(parsedJson.token || parsedJson.symbol).toUpperCase();
    }
    if (parsedJson.contractAddress || parsedJson.tokenContract || parsedJson.contract) {
      contractAddress = String(
        parsedJson.contractAddress || parsedJson.tokenContract || parsedJson.contract
      );
    }
    if (parsedJson.amount != null && String(parsedJson.amount).trim() !== '') {
      amountUsdt = String(parsedJson.amount).trim();
    }
    if (parsedJson.expiresAt || parsedJson.exp) {
      expiresAt = parsedJson.expiresAt || parsedJson.exp;
    }
    if (parsedJson.note) {
      note = String(parsedJson.note).slice(0, 140);
    }
  }
  // Case 3: EIP-681 `ethereum:` URI
  else if (trimmed.toLowerCase().startsWith('ethereum:')) {
    const withoutScheme = trimmed.slice('ethereum:'.length).replace(/^pay-/i, '');
    const qIdx = withoutScheme.indexOf('?');
    const pathPart = qIdx !== -1 ? withoutScheme.slice(0, qIdx) : withoutScheme;
    const queryPart = qIdx !== -1 ? withoutScheme.slice(qIdx + 1) : '';
    let query;
    try {
      query = parseQueryString(queryPart);
    } catch (err) {
      return { valid: false, error: err.message || 'Malformed URL encoding in QR code payload.' };
    }

    const isTransferCall = /\/transfer$/i.test(pathPart);
    const targetPart = pathPart.replace(/\/transfer$/i, '');
    const [targetAddressRaw, chainIdRaw] = targetPart.split('@');

    if (chainIdRaw !== undefined && chainIdRaw !== '') {
      chainId = Number(chainIdRaw);
    } else if (query.chainId) {
      chainId = Number(query.chainId);
    }

    if (isTransferCall) {
      contractAddress = targetAddressRaw;
      if (query.token || query.symbol) {
        tokenSymbol = String(query.token || query.symbol).toUpperCase();
      }
      recipientAddress = query.address || query.to || null;
      if (query.uint256) {
        try {
          amountUsdt = formatBaseUnitsToUsdt(query.uint256, SUPPORTED_WALLET_CONFIG.tokenDecimals);
        } catch (err) {
          return { valid: false, error: err.message || 'Invalid uint256 token amount in QR code.' };
        }
      } else if (query.amount) {
        amountUsdt = query.amount;
      }
    } else {
      recipientAddress = targetAddressRaw;
      if (query.token || query.symbol) {
        tokenSymbol = String(query.token || query.symbol).toUpperCase();
      }
      if (query.contract || query.tokenAddress || query.contractAddress) {
        contractAddress = query.contract || query.tokenAddress || query.contractAddress;
      }
      if (query.amount || query.value) {
        amountUsdt = query.amount || query.value;
      }
    }

    if (query.expiresAt || query.exp) {
      expiresAt = query.expiresAt || query.exp;
    }
    if (query.note || query.message) {
      note = String(query.note || query.message).slice(0, 140);
    }
  }
  // Case 4: `assetbridge:` URI
  else if (trimmed.toLowerCase().startsWith('assetbridge://')) {
    const qIdx = trimmed.indexOf('?');
    const queryPart = qIdx !== -1 ? trimmed.slice(qIdx + 1) : '';
    let query;
    try {
      query = parseQueryString(queryPart);
    } catch (err) {
      return { valid: false, error: err.message || 'Malformed URL encoding in QR code payload.' };
    }
    recipientAddress = query.address || query.recipient || query.to || null;
    if (query.chainId) chainId = Number(query.chainId);
    if (query.token || query.symbol) tokenSymbol = String(query.token || query.symbol).toUpperCase();
    if (query.contract || query.contractAddress || query.tokenContract) {
      contractAddress = query.contract || query.contractAddress || query.tokenContract;
    }
    if (query.amount) amountUsdt = query.amount;
    if (query.expiresAt || query.exp) expiresAt = query.expiresAt || query.exp;
    if (query.note) note = String(query.note).slice(0, 140);
  } else {
    return {
      valid: false,
      error:
        'Unsupported QR code format. Scan an Ethereum Sepolia USDT payment request or a valid 0x wallet address.',
    };
  }

  // 1. Validate Chain ID (must be Ethereum Sepolia 11155111)
  if (!Number.isInteger(chainId) || chainId !== SUPPORTED_WALLET_CONFIG.chainId) {
    return {
      valid: false,
      error: `Unsupported network (Chain ID: ${chainId}). Only ${SUPPORTED_WALLET_CONFIG.networkName} (Chain ID: ${SUPPORTED_WALLET_CONFIG.chainId}) is supported.`,
    };
  }

  // 2. Validate Token Symbol & Contract Address
  if (tokenSymbol !== SUPPORTED_WALLET_CONFIG.tokenSymbol) {
    return {
      valid: false,
      error: `Unsupported token "${tokenSymbol}". Only ${SUPPORTED_WALLET_CONFIG.tokenSymbol} on ${SUPPORTED_WALLET_CONFIG.networkName} is supported.`,
    };
  }

  if (
    !contractAddress ||
    contractAddress.toLowerCase() !== SUPPORTED_WALLET_CONFIG.tokenContractAddress.toLowerCase()
  ) {
    return {
      valid: false,
      error: `Unsupported token contract (${contractAddress || 'none'}). Expected Sepolia USDT (${SUPPORTED_WALLET_CONFIG.tokenContractAddress}).`,
    };
  }

  // 3. Validate Recipient Address (must be valid 0x address and NOT the token contract or zero address)
  if (!recipientAddress || !HEX_ADDRESS_REGEX.test(recipientAddress.trim())) {
    return {
      valid: false,
      error: 'QR code does not contain a valid 0x recipient wallet address.',
    };
  }

  const normalizedRecipient = recipientAddress.trim();
  if (
    normalizedRecipient.toLowerCase() ===
    SUPPORTED_WALLET_CONFIG.tokenContractAddress.toLowerCase()
  ) {
    return {
      valid: false,
      error:
        'Invalid QR recipient: The scanned address is the Sepolia USDT token contract itself (0x7169...BA06), not a user wallet. Sending tokens to the token contract address is blocked.',
    };
  }

  if (!isSafePersonalEvmAddress(normalizedRecipient)) {
    return {
      valid: false,
      error:
        'Invalid QR recipient: The scanned address is a restricted contract or burn address and cannot receive user transfers.',
    };
  }

  // 4. Validate Optional Amount
  let normalizedAmount = null;
  if (amountUsdt !== null && amountUsdt !== undefined && String(amountUsdt).trim() !== '') {
    try {
      const baseUnits = parseUsdtToBaseUnits(String(amountUsdt), SUPPORTED_WALLET_CONFIG.tokenDecimals);
      normalizedAmount = formatBaseUnitsToUsdt(baseUnits, SUPPORTED_WALLET_CONFIG.tokenDecimals);
    } catch (err) {
      return {
        valid: false,
        error: err.message || 'QR code contains an invalid transfer amount.',
      };
    }
  }

  // 5. Validate Optional Request Expiry
  if (expiresAt) {
    const expMs = typeof expiresAt === 'number' || /^\d+$/.test(String(expiresAt))
      ? Number(expiresAt) < 1e12
        ? Number(expiresAt) * 1000
        : Number(expiresAt)
      : Date.parse(String(expiresAt));

    if (!Number.isFinite(expMs)) {
      return { valid: false, error: 'QR payment request contains a malformed expiry timestamp.' };
    }
    if (expMs <= Date.now()) {
      return {
        valid: false,
        error: 'This QR payment request has expired. Ask the recipient for a fresh payment request.',
      };
    }
  }

  return {
    valid: true,
    recipientAddress: normalizedRecipient,
    amountUsdt: normalizedAmount,
    networkName: SUPPORTED_WALLET_CONFIG.networkName,
    networkLabel: SUPPORTED_WALLET_CONFIG.networkLabel,
    chainId: SUPPORTED_WALLET_CONFIG.chainId,
    tokenSymbol: SUPPORTED_WALLET_CONFIG.tokenSymbol,
    tokenName: SUPPORTED_WALLET_CONFIG.tokenName,
    tokenContractAddress: SUPPORTED_WALLET_CONFIG.tokenContractAddress,
    note,
    expiresAt: expiresAt || null,
  };
}

class MobileWalletService {
  constructor() {
    this.memoryCache = {};
    this.pendingIdempotencyKeys = new Set();
  }

  sanitizeWalletRecord(raw, requestedUserId) {
    if (!raw || typeof raw !== 'object') return null;
    const validPersonalAddress = isVerifiedUserWallet(raw, requestedUserId);
    return {
      ...raw,
      userId: raw.userId || requestedUserId,
      address: validPersonalAddress ? raw.address.trim() : null,
      walletSetupRequired: !validPersonalAddress,
      isVerifiedUserWallet: validPersonalAddress,
      balanceUsdt: validPersonalAddress ? raw.balanceUsdt : null,
      currency: SUPPORTED_WALLET_CONFIG.tokenSymbol,
      tokenContractAddress: SUPPORTED_WALLET_CONFIG.tokenContractAddress,
      chainId: SUPPORTED_WALLET_CONFIG.chainId,
      decimals: SUPPORTED_WALLET_CONFIG.tokenDecimals,
      network: raw.network || SUPPORTED_WALLET_CONFIG.networkLabel,
      setupReason: validPersonalAddress
        ? null
        : raw.setupReason ||
          'Wallet setup required — No verified user-controlled wallet address is linked to this account yet.',
    };
  }

  getSavedRecipients() {
    return [];
  }

  async getFeeQuote() {
    try {
      const res = await fetch(`${API_BASE_URL}/wallet/fee-quote`, { headers: await authHeaders() });
      const json = await res.json();
      if (res.ok && json.data) return json.data;
      throw new Error(json.message || 'Fee quote request failed.');
    } catch (error) {
      throw new Error(`Unable to retrieve a live fee quote. ${error.message}`);
    }
  }

  async getOrCreateWallet(userId) {
    if (!userId) throw new Error('Sign in to load your wallet.');
    try {
      const res = await fetch(`${API_BASE_URL}/wallet/${encodeURIComponent(userId)}`, {
        headers: await authHeaders(),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.data) {
        const sanitized = this.sanitizeWalletRecord(json.data, userId);
        this.memoryCache[userId] = sanitized;
        return sanitized;
      }
      // Even on 404 (no WDK wallet linked yet), return structured setup-required state
      const fallback = this.sanitizeWalletRecord(
        {
          userId,
          address: null,
          walletSetupRequired: true,
          isVerifiedUserWallet: false,
          setupReason: json.message || 'Wallet setup required',
        },
        userId
      );
      this.memoryCache[userId] = fallback;
      return fallback;
    } catch {
      const fallback = this.sanitizeWalletRecord(
        {
          userId,
          address: null,
          walletSetupRequired: true,
          isVerifiedUserWallet: false,
          setupReason: 'Wallet setup required — Unable to verify user-owned wallet address.',
        },
        userId
      );
      return fallback;
    }
  }

  generateIdempotencyKey() {
    return `idemp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  async transfer({ senderUserId, recipientAddressOrUsername, amountUsdt, note = '', idempotencyKey = '' }) {
    const numAmount = Number(amountUsdt);
    const key = idempotencyKey || this.generateIdempotencyKey();

    try {
      const res = await fetch(`${API_BASE_URL}/wallet/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({
          senderUserId,
          recipientIdentifier: recipientAddressOrUsername,
          recipientAddressOrUsername,
          amountUsdt: numAmount,
          note,
          idempotencyKey: key,
        }),
      });
      const json = await res.json();
      if (res.ok && json.data) {
        this.pendingIdempotencyKeys.delete(key);
        return json.data;
      }
      throw new Error(
        json.message ||
          'Wallet signing is unavailable until an Expo SDK 58-compatible WDK release is integrated. No funds were moved.'
      );
    } catch (err) {
      throw new Error(
        `Wallet signing is unavailable: On-device WDK signing is not yet integrated for Expo SDK 58, and backend transfers remain fail-closed. No funds were debited. (${err.message})`
      );
    }
  }

  async transferUsdt({ recipient, amount, note = '' }) {
    return this.transfer({
      senderUserId: 'current_user',
      recipientAddressOrUsername: recipient,
      amountUsdt: amount,
      note,
    });
  }

  async claimFaucet(userId) {
    try {
      const res = await fetch(`${API_BASE_URL}/wallet/faucet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ userId, amountUsdt: 250 }),
      });
      const json = await res.json();
      if (res.ok && json.data) return json.data;
      throw new Error(json.message || 'Faucet request failed.');
    } catch (error) {
      throw new Error(`Test token faucet unavailable. No balance was added. ${error.message}`);
    }
  }

  async getWallet(userId = 'demo_user') {
    return this.getOrCreateWallet(userId).catch(() => null);
  }

  async getTransactions(userId) {
    if (!userId) return [];
    try {
      const res = await fetch(`${API_BASE_URL}/wallet/${encodeURIComponent(userId)}/transactions`, {
        headers: await authHeaders(),
      });
      const json = await res.json();
      if (res.ok && Array.isArray(json.data)) return json.data;
      return [];
    } catch {
      return [];
    }
  }
}

export const mobileWalletService = new MobileWalletService();
export const walletService = mobileWalletService;
