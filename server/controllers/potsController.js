import { potService } from '../services/potService.js';
import { successResponse, errorResponse } from '../utils/responseHelper.js';

export const listPots = (req, res) => {
  try {
    const pots = potService.getAllPots();
    return successResponse(res, pots, 'Pots retrieved successfully');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
};

export const getPot = (req, res) => {
  try {
    const { id } = req.params;
    const pot = potService.getPotById(id);
    if (!pot) {
      return errorResponse(res, 'Pot not found', 404);
    }
    return successResponse(res, pot, 'Pot retrieved successfully');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
};

export const createPot = (req, res) => {
  try {
    const creatorUserId = req.user?.id || req.user?.email || req.body.creatorUserId || 'demo_user';
    const newPot = potService.createPot(req.body, creatorUserId);
    return successResponse(res, newPot, 'Stokvel pot created successfully', 201);
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
};

export const contributeToPot = async (req, res) => {
  try {
    const { id } = req.params;
    const contributingUserId = req.user?.id || req.user?.email || req.body.userId || 'demo_user';
    const result = await potService.contribute(id, contributingUserId);
    return successResponse(res, result, result.message || 'Contribution processed');
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
};

export const joinPot = (req, res) => {
  try {
    const { inviteCode } = req.body;
    const userId = req.user?.id || req.user?.email || req.body.userId || 'demo_user';
    if (!inviteCode) return errorResponse(res, 'inviteCode is required', 400);
    const pot = potService.joinPotByInviteCode(inviteCode, userId);
    return successResponse(res, pot, `Successfully joined ${pot.name}`);
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
};

export const voteInvestment = (req, res) => {
  try {
    const { id } = req.params;
    const { approved } = req.body;
    const userId = req.user?.id || req.user?.email || req.body.userId || 'demo_user';
    const result = potService.voteInvestment(id, userId, approved);
    return successResponse(res, result, 'Investment vote recorded');
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
};
