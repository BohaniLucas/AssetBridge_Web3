/**
 * Authoritative Gogo Claim Service (Flow B: Non-App Recipient Claim Flow)
 *
 * Security & Money-Safety Guarantees:
 * - High-entropy 256-bit claim tokens generated via crypto.randomBytes(32).
 * - Only SHA-256 hashes of claim tokens, phone numbers, and OTPs are stored.
 * - Never embeds claim secrets in URLs, query parameters, logs, or referrers.
 * - Never accepts demo OTP '123456' or arbitrary 6-digit codes.
 * - Enforces strict attempt limits (5 attempts max) and OTP expiry (5 minutes).
 * - Never creates unreviewed custodial wallets or asks for seed phrases/private keys/bank passwords.
 * - Keeps fiat cash-out fail-closed unless a licensed payout partner is configured and verified.
 */

import crypto from 'crypto';
import { remittanceService } from './remittanceService.js';
import { walletService } from './walletService.js';
import { isDevTestAccountEnabled } from '../middlewares/authMiddleware.js';

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const CLAIM_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function sha256Hex(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function hmacSha256Hex(secret, value) {
  return crypto.createHmac('sha256', String(secret)).update(String(value)).digest('hex');
}

function timingSafeHexEqual(hexA, hexB) {
  if (!hexA || !hexB || typeof hexA !== 'string' || typeof hexB !== 'string') return false;
  try {
    const bufA = Buffer.from(hexA, 'hex');
    const bufB = Buffer.from(hexB, 'hex');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/**
 * Deterministic Plain-Language & Multilingual Gogo Assistant Dictionary.
 * AI assistant strictly explains steps, translates, summarizes fees/rates, and warns against scams.
 * It NEVER decides eligibility, overrides checks, invents status, or asks for secrets.
 */
const GOGO_LANGUAGE_PACKS = {
  en: {
    languageName: 'English',
    greeting: 'Hello! Here is a simple summary of your money transfer.',
    steps: [
      '1. Enter your mobile phone number and the one-time claim code shared by your family member.',
      '2. Enter the 6-digit verification code sent to your phone via SMS to prove it is you.',
      '3. Review the sender name, exchange rate, fees, and exact Rand amount before confirming.',
    ],
    scamWarnings: [
      'Never share your bank password, ATM PIN, or wallet recovery phrase with anyone.',
      'AssetBridge will NEVER ask you to pay a fee to unlock or receive your money.',
      'If a stranger asked you to claim this link and forward the money to them, stop immediately — it may be a scam.',
    ],
    noAppNeededNote:
      'You do not need to install an app to view or verify this claim. However, direct bank or PayShap cash-out is only available when a licensed South African payout partner is active.',
  },
  zu: {
    languageName: 'isiZulu',
    greeting: 'Sawubona Gogo! Nansi imininingwane elulangemali oyithumelelwe.',
    steps: [
      '1. Faka inombolo yakho yocingo kanye nekhowudi eyimfihlo oyithumelelwe ilungu lomndeni.',
      '2. Faka izinombholo eziyisithupha (6-digit OTP) ezithunyelwe nge-SMS ocingweni lwakho.',
      '3. Bheka igama lomthumeli, inanioshintsho, kanye nemali ozoyithola ngaphambi kokuba uqinisekise.',
    ],
    scamWarnings: [
      'Ungalokothi unikeze iphasiwedi yakho yasebhange noma i-PIN yekhadi lakho muntu.',
      'I-AssetBridge ayisoze yakucela ukuthi ukhokhe imali ukuze uthole imali yakho.',
      'Uma umuntu ongamazi ekucela ukuthi udlulisele le mali kuye, yima khona manjalo — kungaba ubugebengu.',
    ],
    noAppNeededNote:
      'Awudingi ukufaka i-app ocingweni lwakho. Imali ingakhishwa kuphela ngeziteshi ezisemthethweni ezivunyelwe.',
  },
  st: {
    languageName: 'Sesotho',
    greeting: 'Dumela Nkgono! Ena ke kakaretso e bonolo ya tjhelete eo o e rometsweng.',
    steps: [
      '1. Kenya nomoro ya hao ya mohala le khoutu ya lekunutu eo o e filweng ke lelapa.',
      '2. Kenya dinomoro tse 6 tsa SMS (OTP) ho netefatsa hore ke wena.',
      '3. Hlahloba lebitso la moromelli, sekgahla sa phapanyetsano, le tjhelete pele oamohela.',
    ],
    scamWarnings: [
      'Le ka mohla o se ke wa fana ka PIN ya hao ya banka kapa phasewete.',
      'AssetBridge ha e na ho kopa hore o lefe tjhelete pele o fumana tjhelete ya hao.',
      'Haeba motho eo o sa mo tsebeng a kopa hore o mo fetisetse tjhelete ena, emisa hang-hang.',
    ],
    noAppNeededNote:
      'Ha o hloke ho jarolla app mohaleng wa hao ho netefatsa tjhelete ena.',
  },
  af: {
    languageName: 'Afrikaans',
    greeting: 'Hallo! Hier is ’n eenvoudige opsomming van u geldoorplasing.',
    steps: [
      '1. Voer u selfoonnommer en die eenmalige eiskode in wat deur u familielid gestuur is.',
      '2. Voer die 6-syfer SMS-kode in om u identiteit te bevestig.',
      '3. Kontroleer die sender, wisselkoers, fooie en Rand-bedrag voordat u bevestig.',
    ],
    scamWarnings: [
      'Moet nooit u bankwagwoord, kitsbank-PIN of herstelfrase met enige iemand deel nie.',
      'AssetBridge sal u NOOIT vra om ’n fooi te betaal om u geld te ontsluit nie.',
      'As ’n vreemdeling u gevra het om hierdie geld te eis en aan te stuur, stop dadelik — dit kan bedrog wees.',
    ],
    noAppNeededNote:
      'U hoef geen toepassing af te laai om hierdie eis te verifieer nie.',
  },
};

class ClaimService {
  constructor() {
    this.claimsMem = new Map(); // claimId -> claimRecord
  }

  getOtpSecret() {
    return process.env.QUOTE_SIGNING_SECRET || 'assetbridge-dev-otp-hmac-secret';
  }

  /**
   * Create a Gogo claim link backed by an authenticated sender's remittance quote/intent.
   * Returns the one-time raw `claimToken` ONLY once to the sender so they can share it directly;
   * stores only `claimTokenHash` on the server.
   */
  async createClaimLink({
    senderUser,
    quoteId,
    idempotencyKey,
    recipientName,
    recipientPhone,
    note = '',
    riskAcknowledged = false,
    originUrl = 'http://localhost:5173',
  }) {
    if (!senderUser || !senderUser.id) {
      const err = new Error('Authenticated sender identity is required.');
      err.status = 401;
      throw err;
    }

    // 1. Create or retrieve the underlying remittance transfer via remittanceService
    const { transfer, idempotentReplay } = await remittanceService.createTransferIntent({
      senderUser,
      quoteId,
      idempotencyKey,
      recipientName,
      recipientPhone,
      note,
    });

    // If idempotent replay, return existing claim metadata (without regenerating secret if already created)
    for (const existingClaim of this.claimsMem.values()) {
      if (existingClaim.transferId === transfer.id) {
        return {
          claim: this.sanitizeClaimForSender(existingClaim, originUrl),
          transfer,
          idempotentReplay: true,
        };
      }
    }

    // If sender also acknowledged risk immediately, approve the transfer to `pending` (awaiting on-chain funding)
    let currentTransfer = transfer;
    if (riskAcknowledged || transfer.riskFlags.length === 0) {
      const approved = await remittanceService.approveTransfer({
        transferId: transfer.id,
        senderUser,
        riskAcknowledged: true,
      });
      currentTransfer = approved.transfer;
    }

    // 2. Generate high-entropy 256-bit claim token (base64url, 43 chars)
    const rawClaimToken = crypto.randomBytes(32).toString('base64url');
    const claimTokenHash = sha256Hex(rawClaimToken);
    const claimId = `clm_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;

    const normalizedPhone = remittanceService.normalizePhoneE164(
      recipientPhone,
      currentTransfer.corridorCode
    );
    const phoneHash = sha256Hex(normalizedPhone);
    const phoneMasked = remittanceService.maskPhone(normalizedPhone);

    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + CLAIM_TTL_MS).toISOString();

    const claimRecord = {
      id: claimId,
      transferId: currentTransfer.id,
      senderUserId: senderUser.id,
      senderDisplayName:
        senderUser.fullName || (senderUser.email ? senderUser.email.split('@')[0] : 'Family Member'),
      recipientName: String(recipientName).trim(),
      recipientPhoneE164Hash: phoneHash,
      recipientPhoneMasked: phoneMasked,
      claimTokenHash,
      otpCodeHash: null,
      otpExpiresAt: null,
      otpAttempts: 0,
      maxOtpAttempts: 5,
      claimAttempts: 0,
      maxClaimAttempts: 5,
      otpVerifiedAt: null,
      otpSessionTokenHash: null,
      selectedPayoutMethod: null,
      payoutDestinationMasked: null,
      status: currentTransfer.status === 'funded' ? 'claimable' : 'awaiting_funding',
      expiresAt,
      claimedAt: null,
      refundedAt: null,
      createdAt: now,
      updatedAt: now,
      auditTrail: [
        {
          event: 'CLAIM_CREATED',
          timestamp: now,
          detail: 'High-entropy one-time claim reference created (awaiting on-chain funding verification)',
        },
      ],
    };

    this.claimsMem.set(claimId, claimRecord);

    walletService.logAudit('GOGO_CLAIM_CREATED', senderUser.id, {
      claimId,
      transferId: currentTransfer.id,
      recipientPhoneMasked: phoneMasked,
      status: claimRecord.status,
    });

    // Safe share URL NEVER contains the secret token in query parameters or referrer-leaking paths!
    const cleanOrigin = String(originUrl || 'http://localhost:5173').replace(/\/$/, '');
    const safeClaimUrl = `${cleanOrigin}/#/claim/${claimId}`;

    return {
      claim: {
        ...this.sanitizeClaimForSender(claimRecord, cleanOrigin),
        // Returned ONE TIME ONLY on creation so sender can share with recipient out-of-band:
        oneTimeClaimCode: rawClaimToken,
        safeClaimUrl,
        securityWarning:
          'Save or share this one-time claim code directly with the intended recipient. For your security, the secret code is not embedded in the URL and cannot be retrieved again.',
      },
      transfer: currentTransfer,
      idempotentReplay: false,
    };
  }

  /**
   * Synchronize claim state with its underlying transfer state (e.g., when transfer is funded or refunded).
   */
  syncClaimWithTransfer(claimRecord) {
    if (!claimRecord) return null;
    const rawTransfer = remittanceService.transfersMem.get(claimRecord.transferId);
    if (!rawTransfer) return claimRecord;

    if (
      new Date() > new Date(claimRecord.expiresAt) &&
      !['claimed', 'refunded', 'cancelled', 'expired'].includes(claimRecord.status)
    ) {
      claimRecord.status = 'expired';
      claimRecord.updatedAt = new Date().toISOString();
    }

    if (rawTransfer.status === 'funded' && claimRecord.status === 'awaiting_funding') {
      claimRecord.status = 'claimable';
      claimRecord.updatedAt = new Date().toISOString();
      claimRecord.auditTrail.push({
        event: 'CLAIM_FUNDED_ON_CHAIN',
        timestamp: claimRecord.updatedAt,
        detail: `Verified on-chain funding tx ${rawTransfer.fundingTxHash}`,
      });
    } else if (rawTransfer.status === 'cancelled' && claimRecord.status !== 'cancelled') {
      claimRecord.status = 'cancelled';
      claimRecord.updatedAt = new Date().toISOString();
    } else if (rawTransfer.status === 'refunded' && claimRecord.status !== 'refunded') {
      claimRecord.status = 'refunded';
      claimRecord.refundedAt = rawTransfer.refundedAt || new Date().toISOString();
      claimRecord.updatedAt = new Date().toISOString();
    } else if (rawTransfer.status === 'paid' && claimRecord.status !== 'claimed') {
      claimRecord.status = 'claimed';
      claimRecord.claimedAt = rawTransfer.completedAt || new Date().toISOString();
      claimRecord.updatedAt = new Date().toISOString();
    }

    return claimRecord;
  }

  /**
   * Public endpoint helper: Get limited, sanitized claim information for the non-app recipient.
   * Never leaks sender userId, phone numbers, hashes, or secrets.
   */
  getPublicClaimSummary(claimId, lang = 'en') {
    const claimRecord = this.claimsMem.get(claimId);
    if (!claimRecord) {
      const err = new Error('Claim reference not found or invalid.');
      err.status = 404;
      throw err;
    }

    this.syncClaimWithTransfer(claimRecord);
    const rawTransfer = remittanceService.transfersMem.get(claimRecord.transferId);

    const payShapAvailable = remittanceService.isPayShapProviderConfigured();
    const otpProviderAvailable = remittanceService.isOtpProviderConfigured() || isDevTestAccountEnabled();

    return {
      id: claimRecord.id,
      status: claimRecord.status,
      senderDisplayName: claimRecord.senderDisplayName,
      recipientName: claimRecord.recipientName,
      recipientPhoneMasked: claimRecord.recipientPhoneMasked,
      destinationCountry: rawTransfer?.destinationCountry || 'South Africa',
      sendAmountFormatted: rawTransfer?.sendAmountFormatted || '0.00',
      sendCurrency: rawTransfer?.sendCurrency || 'USDT',
      feeAmountFormatted: rawTransfer?.feeAmountFormatted || '0.20',
      netSendAmountFormatted: rawTransfer?.netSendAmountFormatted || '0.00',
      fxRateDisplay: rawTransfer?.fxRateDisplay || null,
      rateSource: rawTransfer?.rateSource || 'Open Exchange Rates (Daily Reference)',
      rateType: rawTransfer?.rateType || 'reference_only',
      receiveAmountFormatted: rawTransfer?.receiveAmountFormatted || '0.00',
      receiveCurrency: rawTransfer?.receiveCurrency || 'ZAR',
      receiveSymbol: rawTransfer?.receiveSymbol || 'R',
      note: rawTransfer?.note || '',
      blockchainNetwork: rawTransfer?.blockchainNetwork || 'Sepolia Testnet',
      fundingVerified: Boolean(rawTransfer?.fundingTxHash),
      fundingTxHash: rawTransfer?.fundingTxHash || null,
      expiresAt: claimRecord.expiresAt,
      createdAt: claimRecord.createdAt,
      supportedPayoutMethods: [
        {
          id: 'za_payshap_proxy',
          name: 'South Africa PayShap (Registered ShapID Mobile Proxy)',
          available: payShapAvailable,
          statusLabel: payShapAvailable ? 'Available' : 'Not available yet — Partner onboarding required',
          description:
            'Direct payout to a South African bank account where your mobile number is registered as a PayShap ShapID.',
        },
        {
          id: 'non_custodial_wallet',
          name: 'Self-Custody Sepolia Testnet Wallet (0x...)',
          available: true,
          statusLabel: 'Available (Sepolia Testnet)',
          description:
            'Receive the escrowed testnet USDT directly to your own non-custodial ERC-20 wallet address.',
        },
      ],
      verificationRequirements: {
        requiresClaimToken: true,
        requiresRecipientPhoneMatch: true,
        requiresOtpVerification: true,
        otpProviderConfigured: otpProviderAvailable,
        remainingAttempts: Math.max(0, claimRecord.maxClaimAttempts - claimRecord.claimAttempts),
      },
      aiGuidance: this.getAiGogoGuidance(claimRecord, rawTransfer, lang),
    };
  }

  /**
   * Deterministic AI-Assisted Gogo Helper.
   * Explains each step in plain language, translates instructions, summarizes the payment,
   * and highlights scam warnings without ever making eligibility decisions or asking for secrets.
   */
  getAiGogoGuidance(claimRecord, rawTransfer, lang = 'en') {
    const pack = GOGO_LANGUAGE_PACKS[lang] || GOGO_LANGUAGE_PACKS.en;
    const receiveDisplay = rawTransfer
      ? `${rawTransfer.receiveSymbol || 'R'}${rawTransfer.receiveAmountFormatted} ${rawTransfer.receiveCurrency}`
      : 'the quoted amount';

    return {
      language: lang,
      languageName: pack.languageName,
      availableLanguages: Object.entries(GOGO_LANGUAGE_PACKS).map(([code, p]) => ({
        code,
        name: p.languageName,
      })),
      greeting: pack.greeting,
      plainLanguageSummary: `${claimRecord.senderDisplayName} prepared a transfer of $${rawTransfer?.sendAmountFormatted || '0.00'} USDT (platform fee $${rawTransfer?.feeAmountFormatted || '0.20'} USDT, reference exchange rate 1 USDT = ${rawTransfer?.fxRateDisplay || '—'} ${rawTransfer?.receiveCurrency || 'ZAR'}) for ${claimRecord.recipientName}, estimated at ${receiveDisplay}. Current deterministic backend status: "${claimRecord.status.toUpperCase()}".`,
      steps: pack.steps,
      scamWarnings: pack.scamWarnings,
      noAppNeededNote: pack.noAppNeededNote,
      aiSafetyBoundary:
        'AI Assistant Notice: This assistant only explains steps and translates instructions. It cannot approve claims, bypass OTP verification, or ask for your PIN, password, or recovery phrase.',
    };
  }

  /**
   * Public Receiver Step 1: Verify claim token + recipient phone number and issue an SMS OTP.
   * Enforces strict attempt limits and never accepts demo OTPs in production.
   */
  requestClaimOtp({ claimId, claimToken, phoneNumber }) {
    const claimRecord = this.claimsMem.get(claimId);
    if (!claimRecord) {
      const err = new Error('Claim reference not found.');
      err.status = 404;
      throw err;
    }

    this.syncClaimWithTransfer(claimRecord);

    if (claimRecord.status === 'locked') {
      const err = new Error(
        'This claim link has been locked due to too many failed verification attempts. Contact the sender to refund or issue a new link.'
      );
      err.status = 429;
      throw err;
    }
    if (claimRecord.status === 'claimed') {
      const err = new Error('This transfer has already been claimed.');
      err.status = 409;
      throw err;
    }
    if (claimRecord.status === 'cancelled' || claimRecord.status === 'refunded') {
      const err = new Error('This claim link was cancelled or refunded to the sender.');
      err.status = 409;
      throw err;
    }
    if (claimRecord.status === 'expired') {
      const err = new Error('This claim link has expired.');
      err.status = 410;
      throw err;
    }

    const rawTransfer = remittanceService.transfersMem.get(claimRecord.transferId);

    // Increment claim attempt counter before checking secret
    claimRecord.claimAttempts += 1;
    claimRecord.updatedAt = new Date().toISOString();

    if (claimRecord.claimAttempts > claimRecord.maxClaimAttempts) {
      claimRecord.status = 'locked';
      const err = new Error(
        'Maximum verification attempts exceeded. This claim link is now locked for security.'
      );
      err.status = 429;
      throw err;
    }

    if (!claimToken || typeof claimToken !== 'string' || claimToken.trim().length < 16) {
      const err = new Error(
        `Invalid one-time claim code. (${claimRecord.maxClaimAttempts - claimRecord.claimAttempts} attempts remaining)`
      );
      err.status = 401;
      throw err;
    }

    const providedTokenHash = sha256Hex(claimToken.trim());
    if (!timingSafeHexEqual(providedTokenHash, claimRecord.claimTokenHash)) {
      const err = new Error(
        `Invalid one-time claim code. (${claimRecord.maxClaimAttempts - claimRecord.claimAttempts} attempts remaining)`
      );
      err.status = 401;
      throw err;
    }

    // Validate phone number matches the intended recipient phone hash
    let normalizedPhone;
    try {
      normalizedPhone = remittanceService.normalizePhoneE164(
        phoneNumber,
        rawTransfer?.corridorCode || 'ZA-ZAR'
      );
    } catch (e) {
      const err = new Error(e.message);
      err.status = 400;
      throw err;
    }

    const providedPhoneHash = sha256Hex(normalizedPhone);
    if (!timingSafeHexEqual(providedPhoneHash, claimRecord.recipientPhoneE164Hash)) {
      const err = new Error(
        'The phone number entered does not match the intended recipient number specified by the sender.'
      );
      err.status = 403;
      throw err;
    }

    // Check OTP provider availability in production
    const realOtpConfigured = remittanceService.isOtpProviderConfigured();
    if (!realOtpConfigured && !isDevTestAccountEnabled()) {
      const err = new Error(
        'SMS OTP verification is unavailable because no production SMS OTP provider (OTP_PROVIDER_API_KEY) is configured. Demo OTPs are strictly disabled.'
      );
      err.status = 503;
      throw err;
    }

    // Generate cryptographically random 6-digit OTP (never '123456')
    let randomOtp = String(crypto.randomInt(100000, 1000000));
    if (randomOtp === '123456') {
      randomOtp = '654321';
    }

    const otpExpiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();
    claimRecord.otpCodeHash = hmacSha256Hex(this.getOtpSecret(), `${claimId}:${randomOtp}`);
    claimRecord.otpExpiresAt = otpExpiresAt;
    claimRecord.otpAttempts = 0;
    if (claimRecord.status === 'claimable' || claimRecord.status === 'awaiting_funding') {
      claimRecord.status = 'otp_sent';
    }

    claimRecord.auditTrail.push({
      event: 'OTP_ISSUED',
      timestamp: new Date().toISOString(),
      detail: `One-time verification code generated for ${claimRecord.recipientPhoneMasked}`,
    });

    const response = {
      claimId: claimRecord.id,
      recipientPhoneMasked: claimRecord.recipientPhoneMasked,
      otpExpiresAt,
      message: realOtpConfigured
        ? `A 6-digit verification code has been dispatched to ${claimRecord.recipientPhoneMasked}.`
        : `[Testnet Dev Mode] Verification code generated for ${claimRecord.recipientPhoneMasked}.`,
    };

    // Expose test OTP in non-production when dev test mode is explicitly enabled so local testing works
    if (process.env.NODE_ENV !== 'production' && isDevTestAccountEnabled()) {
      response._devTestOtpOnly = randomOtp;
    }

    return response;
  }

  /**
   * Public Receiver Step 2: Verify the 6-digit OTP code.
   * Rejects '123456', expired OTPs, and locks after maxOtpAttempts (5).
   */
  verifyClaimOtp({ claimId, otpCode }) {
    const claimRecord = this.claimsMem.get(claimId);
    if (!claimRecord) {
      const err = new Error('Claim reference not found.');
      err.status = 404;
      throw err;
    }

    this.syncClaimWithTransfer(claimRecord);

    if (claimRecord.status === 'locked') {
      const err = new Error('This claim link is locked due to excessive failed attempts.');
      err.status = 429;
      throw err;
    }

    const cleanOtp = String(otpCode || '').trim();

    // Explicitly reject legacy demo code '123456'
    if (cleanOtp === '123456') {
      claimRecord.otpAttempts += 1;
      if (claimRecord.otpAttempts >= claimRecord.maxOtpAttempts) {
        claimRecord.status = 'locked';
      }
      const err = new Error('Demo OTP codes (123456) are rejected. Enter the real verification code issued for this session.');
      err.status = 401;
      throw err;
    }

    if (!claimRecord.otpCodeHash || !claimRecord.otpExpiresAt) {
      const err = new Error('No active OTP session found. Please request a verification code first.');
      err.status = 400;
      throw err;
    }

    if (new Date() > new Date(claimRecord.otpExpiresAt)) {
      claimRecord.otpCodeHash = null;
      const err = new Error('Verification code has expired. Please request a new code.');
      err.status = 410;
      err.code = 'OTP_EXPIRED';
      throw err;
    }

    claimRecord.otpAttempts += 1;
    if (claimRecord.otpAttempts > claimRecord.maxOtpAttempts) {
      claimRecord.status = 'locked';
      claimRecord.otpCodeHash = null;
      const err = new Error('Maximum OTP attempts exceeded. This claim link has been locked for security.');
      err.status = 429;
      throw err;
    }

    const candidateHash = hmacSha256Hex(this.getOtpSecret(), `${claimId}:${cleanOtp}`);
    if (!timingSafeHexEqual(candidateHash, claimRecord.otpCodeHash)) {
      const remaining = Math.max(0, claimRecord.maxOtpAttempts - claimRecord.otpAttempts);
      if (remaining === 0) {
        claimRecord.status = 'locked';
        claimRecord.otpCodeHash = null;
      }
      const err = new Error(`Invalid verification code. (${remaining} attempts remaining)`);
      err.status = 401;
      throw err;
    }

    // OTP verified! Clear single-use OTP hash and issue short-lived verification session token
    claimRecord.otpCodeHash = null;
    claimRecord.otpVerifiedAt = new Date().toISOString();
    claimRecord.status = 'verified';

    const verificationSessionToken = crypto.randomBytes(24).toString('base64url');
    claimRecord.otpSessionTokenHash = sha256Hex(verificationSessionToken);

    claimRecord.auditTrail.push({
      event: 'OTP_VERIFIED',
      timestamp: claimRecord.otpVerifiedAt,
      detail: 'Recipient phone ownership verified via OTP',
    });

    return {
      verified: true,
      claimId: claimRecord.id,
      status: claimRecord.status,
      verificationSessionToken,
      message: 'Recipient identity verified. Please review the transfer summary and choose a supported payout method.',
    };
  }

  /**
   * Public Receiver Step 3: Confirm Payout Method after OTP Verification.
   * Enforces funding verification and provider availability:
   * - Cannot disburse if the underlying transfer has not been funded on-chain (`fundingTxHash` verified).
   * - Cannot fabricate a PayShap fiat bank payout if `isPayShapProviderConfigured()` is false!
   */
  confirmClaimPayout({
    claimId,
    verificationSessionToken,
    payoutMethod,
    recipientWalletAddress,
  }) {
    const claimRecord = this.claimsMem.get(claimId);
    if (!claimRecord) {
      const err = new Error('Claim reference not found.');
      err.status = 404;
      throw err;
    }

    this.syncClaimWithTransfer(claimRecord);

    if (claimRecord.status === 'claimed') {
      const err = new Error('This claim has already been completed.');
      err.status = 409;
      throw err;
    }
    if (claimRecord.status === 'locked') {
      const err = new Error('This claim is locked.');
      err.status = 429;
      throw err;
    }
    if (!claimRecord.otpVerifiedAt || !claimRecord.otpSessionTokenHash) {
      const err = new Error('Recipient OTP verification is required before confirming payout.');
      err.status = 403;
      throw err;
    }

    const providedSessionHash = sha256Hex(verificationSessionToken || '');
    if (!timingSafeHexEqual(providedSessionHash, claimRecord.otpSessionTokenHash)) {
      const err = new Error('Invalid or expired verification session token.');
      err.status = 401;
      throw err;
    }

    const rawTransfer = remittanceService.transfersMem.get(claimRecord.transferId);
    if (!rawTransfer) {
      const err = new Error('Underlying remittance transfer record not found.');
      err.status = 404;
      throw err;
    }

    // Must be funded on-chain before any payout can execute!
    if (rawTransfer.status !== 'funded' && rawTransfer.status !== 'payout_pending') {
      const err = new Error(
        `Cannot execute payout because the sender's transfer is currently "${rawTransfer.status}" (on-chain funding has not yet been confirmed on Sepolia).`
      );
      err.status = 409;
      err.code = 'AWAITING_ONCHAIN_FUNDING';
      throw err;
    }

    if (payoutMethod === 'za_payshap_proxy') {
      if (!remittanceService.isPayShapProviderConfigured()) {
        const err = new Error(
          'South Africa PayShap bank payout is not available yet because no licensed PayShap payout partner is configured on this server. Your verified claim remains safely reserved in escrow; you may either wait for partner activation, ask the sender to refund, or receive testnet USDT to a self-custody wallet.'
        );
        err.status = 503;
        err.code = 'PAYOUT_PROVIDER_UNCONFIGURED';
        throw err;
      }

      claimRecord.selectedPayoutMethod = 'za_payshap_proxy';
      claimRecord.status = 'payout_pending';
      remittanceService.transitionTransferState(
        rawTransfer,
        'payout_pending',
        'Recipient verified OTP and requested PayShap ShapID payout; awaiting provider webhook confirmation'
      );

      return {
        claimId: claimRecord.id,
        status: claimRecord.status,
        transferStatus: rawTransfer.status,
        message: 'Payout submitted to PayShap provider; awaiting final bank settlement confirmation.',
      };
    }

    const err = new Error(
      `Unsupported or unconfigured payout method "${payoutMethod}". Fiat payouts require an active licensed payout partner.`
    );
    err.status = 503;
    throw err;
  }

  /**
   * Authenticated Sender Action: Cancel or Refund an unclaimed Gogo Claim link.
   */
  refundClaimLink({ claimId, senderUser }) {
    if (!senderUser || !senderUser.id) {
      const err = new Error('Authentication required.');
      err.status = 401;
      throw err;
    }

    const claimRecord = this.claimsMem.get(claimId);
    if (!claimRecord) {
      const err = new Error('Claim link not found.');
      err.status = 404;
      throw err;
    }

    if (String(claimRecord.senderUserId).toLowerCase() !== String(senderUser.id).toLowerCase()) {
      const err = new Error('Forbidden: Only the authenticated sender who created this claim can cancel or refund it.');
      err.status = 403;
      throw err;
    }

    this.syncClaimWithTransfer(claimRecord);

    if (claimRecord.status === 'claimed') {
      const err = new Error('Cannot refund: this claim has already been paid out to the recipient.');
      err.status = 409;
      throw err;
    }

    if (claimRecord.status === 'refunded' || claimRecord.status === 'cancelled') {
      return {
        claim: this.sanitizeClaimForSender(claimRecord),
        idempotentReplay: true,
        message: `Claim is already ${claimRecord.status}.`,
      };
    }

    const rawTransfer = remittanceService.transfersMem.get(claimRecord.transferId);
    let updatedTransfer = null;

    if (rawTransfer) {
      if (['funded', 'failed', 'refund_pending'].includes(rawTransfer.status)) {
        const refundRes = remittanceService.requestOrCompleteRefund({
          transferId: rawTransfer.id,
          senderUser,
          reason: 'Sender cancelled unclaimed Gogo link and reclaimed escrow funds',
        });
        updatedTransfer = refundRes.transfer;
        claimRecord.status = 'refunded';
        claimRecord.refundedAt = new Date().toISOString();
      } else {
        const cancelRes = remittanceService.cancelTransfer({
          transferId: rawTransfer.id,
          senderUser,
        });
        updatedTransfer = cancelRes.transfer;
        claimRecord.status = 'cancelled';
      }
    } else {
      claimRecord.status = 'cancelled';
    }

    claimRecord.updatedAt = new Date().toISOString();
    claimRecord.otpCodeHash = null;
    claimRecord.otpSessionTokenHash = null;
    claimRecord.auditTrail.push({
      event: claimRecord.status === 'refunded' ? 'CLAIM_REFUNDED' : 'CLAIM_CANCELLED',
      timestamp: claimRecord.updatedAt,
      detail: `Action by sender ${senderUser.id}`,
    });

    return {
      claim: this.sanitizeClaimForSender(claimRecord),
      transfer: updatedTransfer,
      message:
        claimRecord.status === 'refunded'
          ? 'Unclaimed escrow funds have been marked as refunded to your wallet.'
          : 'Unfunded claim link has been cancelled.',
    };
  }

  /**
   * Authenticated Sender Action: List all claims created by the authenticated sender.
   */
  getSenderClaims(senderUserId, originUrl = 'http://localhost:5173') {
    if (!senderUserId) return [];
    const results = [];
    for (const claimRecord of this.claimsMem.values()) {
      if (String(claimRecord.senderUserId).toLowerCase() === String(senderUserId).toLowerCase()) {
        this.syncClaimWithTransfer(claimRecord);
        results.push(this.sanitizeClaimForSender(claimRecord, originUrl));
      }
    }
    return results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  sanitizeClaimForSender(claimRecord, originUrl = 'http://localhost:5173') {
    const rawTransfer = remittanceService.transfersMem.get(claimRecord.transferId);
    const cleanOrigin = String(originUrl || 'http://localhost:5173').replace(/\/$/, '');
    return {
      id: claimRecord.id,
      transferId: claimRecord.transferId,
      senderUserId: claimRecord.senderUserId,
      senderDisplayName: claimRecord.senderDisplayName,
      recipientName: claimRecord.recipientName,
      recipientPhoneMasked: claimRecord.recipientPhoneMasked,
      status: claimRecord.status,
      transferStatus: rawTransfer?.status || 'unknown',
      sendAmountFormatted: rawTransfer?.sendAmountFormatted || '0.00',
      sendCurrency: rawTransfer?.sendCurrency || 'USDT',
      feeAmountFormatted: rawTransfer?.feeAmountFormatted || '0.20',
      receiveAmountFormatted: rawTransfer?.receiveAmountFormatted || '0.00',
      receiveCurrency: rawTransfer?.receiveCurrency || 'ZAR',
      receiveSymbol: rawTransfer?.receiveSymbol || 'R',
      fxRateDisplay: rawTransfer?.fxRateDisplay || null,
      fundingTxHash: rawTransfer?.fundingTxHash || null,
      safeClaimUrl: `${cleanOrigin}/#/claim/${claimRecord.id}`,
      otpAttempts: claimRecord.otpAttempts,
      claimAttempts: claimRecord.claimAttempts,
      expiresAt: claimRecord.expiresAt,
      createdAt: claimRecord.createdAt,
      claimedAt: claimRecord.claimedAt,
      refundedAt: claimRecord.refundedAt,
      auditTrail: claimRecord.auditTrail,
    };
  }
}

export const claimService = new ClaimService();
