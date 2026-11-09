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
    const { name, mode, contributionAmount, frequency, description, members } = req.body;
    if (!name) {
      return errorResponse(res, 'Pot name is required', 400);
    }
    const newPot = potService.createPot({ name, mode, contributionAmount, frequency, description, members });
    return successResponse(res, newPot, 'Stokvel pot created successfully', 201);
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
};

export const contributeToPot = (req, res) => {
  try {
    const { id } = req.params;
    const { memberId } = req.body;
    const result = potService.contribute(id, memberId);
    return successResponse(res, result, result.message || 'Contribution processed');
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
};

export const advanceNextRound = (req, res) => {
  try {
    const { id } = req.params;
    const result = potService.advanceNextRound(id);
    return successResponse(res, result, result.message);
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
};

export const resetDemoPot = (req, res) => {
  try {
    const { id } = req.params;
    const result = potService.resetDemoPot(id);
    return successResponse(res, result, 'Demo pot reset to 4/5 paid state');
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
};

