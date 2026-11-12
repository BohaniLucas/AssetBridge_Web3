import { errorResponse } from '../utils/responseHelper.js';

/** Fail closed for financial features until they are backed by a real contract and chain receipt checks. */
export const financialFeatureUnavailable = (_req, res) => errorResponse(
  res,
  'This financial feature is disabled until on-chain execution and network verification are integrated. No funds were moved.',
  503,
);
