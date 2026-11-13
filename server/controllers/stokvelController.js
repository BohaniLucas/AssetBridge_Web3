import { stokvelService } from '../services/stokvelService.js';
import { successResponse, errorResponse } from '../utils/responseHelper.js';

const getUserId = (req) => req.user?.id || req.user?.sub || req.user?.email;

export const listDiscoverableStokvels = async (req, res) => {
  try {
    const list = await stokvelService.listDiscoverableStokvels();
    return successResponse(res, list, 'Discoverable stokvels retrieved successfully');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
};

export const listMyStokvels = async (req, res) => {
  try {
    const userId = getUserId(req);
    const list = await stokvelService.listUserStokvels(userId);
    return successResponse(res, list, 'Your enrolled stokvels retrieved successfully');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
};

export const getStokvel = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = getUserId(req);
    const stokvel = await stokvelService.getStokvelDetails(id, userId);
    return successResponse(res, stokvel, 'Stokvel retrieved successfully');
  } catch (err) {
    const status = err.message.includes('not found') ? 404 : err.message.includes('Access denied') ? 403 : 500;
    return errorResponse(res, err.message, status);
  }
};

export const createStokvel = async (req, res) => {
  try {
    const userId = getUserId(req);
    const created = await stokvelService.createStokvel(req.body, userId);
    return successResponse(res, created, 'Stokvel created successfully', 201);
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
};

export const closeJoining = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = getUserId(req);
    const result = await stokvelService.closeJoining(id, userId);
    return successResponse(res, result, 'Stokvel membership closed');
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
};

export const createInvite = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = getUserId(req);
    const result = await stokvelService.generateInvite(id, userId, req.body);
    return successResponse(res, result, 'Invitation token generated', 201);
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
};

export const previewInvite = async (req, res) => {
  try {
    const { token } = req.params;
    const preview = await stokvelService.previewInvite(token);
    return successResponse(res, preview, 'Invitation details retrieved');
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
};

export const acceptInvite = async (req, res) => {
  try {
    const { token } = req.params;
    const userId = getUserId(req);
    const { acceptedTermsVersion } = req.body;
    const result = await stokvelService.acceptInvite(token, userId, acceptedTermsVersion);
    return successResponse(res, result, result.message);
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
};

export const requestToJoin = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = getUserId(req);
    const { note } = req.body;
    const result = await stokvelService.requestToJoin(id, userId, note);
    return successResponse(res, result, 'Join application submitted successfully', 201);
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
};

export const reviewJoinRequest = async (req, res) => {
  try {
    const { id, reqId } = req.params;
    const userId = getUserId(req);
    const { status } = req.body;
    const result = await stokvelService.reviewJoinRequest(id, reqId, status, userId);
    return successResponse(res, result, `Application ${status}`);
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
};

export const acceptApprovedTerms = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = getUserId(req);
    const { acceptedTermsVersion } = req.body;
    const result = await stokvelService.acceptApprovedTerms(id, userId, acceptedTermsVersion);
    return successResponse(res, result, result.message);
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
};

export const manageRole = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = getUserId(req);
    const { targetUserId, role, action, reason } = req.body;
    const result = await stokvelService.manageRole(id, targetUserId, role, userId, action, reason);
    return successResponse(res, result, `Role successfully ${action}`);
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
};

export const raiseDispute = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = getUserId(req);
    const result = await stokvelService.raiseDispute(id, userId, req.body);
    return successResponse(res, result, 'Dispute recorded for administrative review', 201);
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
};

export const getAuditTrail = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = getUserId(req);
    const logs = await stokvelService.getAuditTrail(id, userId);
    return successResponse(res, logs, 'Audit trail retrieved');
  } catch (err) {
    return errorResponse(res, err.message, 403);
  }
};

