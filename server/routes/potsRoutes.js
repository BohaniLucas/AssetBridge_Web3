import express from 'express';
import { requireAuth } from '../middlewares/authMiddleware.js';
import { financialFeatureUnavailable } from '../middlewares/featureUnavailable.js';
import * as stokvelController from '../controllers/stokvelController.js';

const router = express.Router();

// Require authenticated session for all stokvel operations
router.use(requireAuth);

// 1. Group discovery & membership lists
router.get('/discoverable', stokvelController.listDiscoverableStokvels);
router.get('/my-stokvels', stokvelController.listMyStokvels);
router.get('/', stokvelController.listMyStokvels); // default listing for backward compatibility

// 2. Creation wizard & group details
router.post('/', stokvelController.createStokvel);
router.get('/:id', stokvelController.getStokvel);
router.post('/:id/close-joining', stokvelController.closeJoining);

// 3. High-entropy invite links & QR codes
router.post('/:id/invites', stokvelController.createInvite);
router.get('/invites/:token/preview', stokvelController.previewInvite);
router.post('/invites/:token/accept', stokvelController.acceptInvite);

// 4. Discoverable group applications (request to join)
router.post('/:id/request-join', stokvelController.requestToJoin);
router.patch('/:id/requests/:reqId', stokvelController.reviewJoinRequest);
router.post('/:id/accept-terms', stokvelController.acceptApprovedTerms);

// 5. Administration & Role management
router.patch('/:id/roles', stokvelController.manageRole);
router.post('/:id/disputes', stokvelController.raiseDispute);
router.get('/:id/audit-trail', stokvelController.getAuditTrail);

// 6. FINANCIAL TRANSACTION WRITES: STRICTLY DISABLED
// Real funds flow & on-chain contributions/payouts remain blocked until real WDK
// wallet signature and network confirmation thresholds are integrated.
router.post('/:id/contribute', financialFeatureUnavailable);
router.post('/:id/payout', financialFeatureUnavailable);
router.post('/contribute', financialFeatureUnavailable);

export default router;
