import { API_BASE_URL } from '../config/api';

class MobileClaimService {
  constructor() {
    this.localClaims = [
      {
        id: 'clm_gogo_demo',
        senderName: 'Nomsa (Lucas)',
        amountZar: 400.0,
        amountUsdt: 20.0,
        recipientName: 'Gogo',
        recipientPhone: '+27 82 555 0192',
        secretCode: 'GOGO400',
        status: 'waiting', // 'waiting' | 'claimed' | 'refunded'
        whatsappMessage: 'Nomsa sent you R400.00!\nTap the link to claim your money in 30 seconds (no app or password needed):\nhttps://assetbridge.africa/claim/clm_gogo_demo?code=GOGO400',
        createdAt: new Date().toISOString(),
      },
    ];
  }

  async createClaimLink({ senderUserId, senderName, amountZar, amountUsdt, recipientName, recipientPhone, note }) {
    try {
      const res = await fetch(`${API_BASE_URL}/claims/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderUserId,
          senderName,
          amountZar,
          amountUsdt,
          recipientName,
          recipientPhone,
          note,
        }),
      });
      const data = await res.json();
      if (res.ok && data.data) {
        this.localClaims.unshift(data.data);
        return data.data;
      }
    } catch {
      // offline fallback
    }

    const claimId = `clm_${Date.now()}`;
    const secretCode = `GOGO${Math.floor(1000 + Math.random() * 9000)}`;
    const newClaim = {
      id: claimId,
      senderUserId,
      senderName: senderName || 'Nomsa (Lucas)',
      amountZar: Number(amountZar) || 400.0,
      amountUsdt: Number(amountUsdt) || 20.0,
      recipientName: recipientName || 'Gogo',
      recipientPhone: recipientPhone || '+27 82 555 0192',
      secretCode,
      status: 'waiting',
      whatsappMessage: `${senderName || 'Nomsa'} sent you R${Number(amountZar).toFixed(2)}!\nTap the link to claim your money (no app or password needed):\nhttps://assetbridge.africa/claim/${claimId}?code=${secretCode}`,
      createdAt: new Date().toISOString(),
    };
    this.localClaims.unshift(newClaim);
    return newClaim;
  }

  async getSenderClaims(userId) {
    try {
      const res = await fetch(`${API_BASE_URL}/claims/sender/${encodeURIComponent(userId)}`);
      const data = await res.json();
      if (res.ok && Array.isArray(data.data)) {
        return data.data;
      }
    } catch {
      // fallback
    }
    return [...this.localClaims];
  }

  async refundClaimLink({ claimId, senderUserId }) {
    try {
      const res = await fetch(`${API_BASE_URL}/claims/${encodeURIComponent(claimId)}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senderUserId }),
      });
      const data = await res.json();
      if (res.ok) return data.data;
    } catch {
      // fallback
    }

    const claim = this.localClaims.find((c) => c.id === claimId);
    if (claim) claim.status = 'refunded';
    return { success: true, message: 'Funds returned to your wallet' };
  }

  // Demo simulator for the 40-second hackathon presentation
  async simulateGogoClaim(claimId) {
    try {
      const res = await fetch(`${API_BASE_URL}/claims/${encodeURIComponent(claimId)}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: '+27 82 555 0192',
          smsCode: '123456',
          pin: '2468',
        }),
      });
      const data = await res.json();
      if (res.ok) return data.data;
    } catch {
      // fallback
    }

    const claim = this.localClaims.find((c) => c.id === claimId);
    if (claim) {
      claim.status = 'claimed';
      claim.claimedAt = new Date().toISOString();
      claim.claimedTxHash = `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`;
    }
    return {
      success: true,
      amountZar: claim ? claim.amountZar : 400.0,
      claimedTxHash: claim?.claimedTxHash || '0x8ba1f109551bD432803012645Ac136ddd64DBA72',
    };
  }
}

export const mobileClaimService = new MobileClaimService();

