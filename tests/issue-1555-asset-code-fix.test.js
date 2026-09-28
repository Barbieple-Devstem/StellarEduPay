'use strict';

/**
 * Tests for issue #1555 — verifyTransaction and syncPaymentsForSchool were
 * passing `asset?.code` (always undefined) to validatePaymentAmount instead of
 * `asset?.assetCode`. This caused per-USDC limits to be silently ignored and
 * all payments to be validated against XLM limits.
 *
 * Fix: use asset?.assetCode everywhere detectAsset() results are used with
 * validatePaymentAmount.
 */

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Student = require('../backend/src/models/studentModel');
const Payment = require('../backend/src/models/paymentModel');
const School = require('../backend/src/models/schoolModel');

let mongoServer;

const schoolId = 'SCH-ASSET-CODE-001';
const walletAddress = 'GSCHOOLASSET1234567890ABCDE';
const USDC_ISSUER = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';

const TEST_DB = 'asset_code_fix_test';
const USE_EXTERNAL_MONGO = !!process.env.MONGO_URI;

beforeAll(async () => {
  if (USE_EXTERNAL_MONGO) {
    const baseUri = process.env.MONGO_URI.replace(/\/[^/?]+(\?|$)/, `/${TEST_DB}$1`);
    await mongoose.connect(baseUri);
  } else {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  }

  // Ensure the USDC issuer is recognised as accepted
  process.env.USDC_ISSUER = process.env.USDC_ISSUER || USDC_ISSUER;
});

afterAll(async () => {
  await mongoose.connection.db.dropDatabase();
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

beforeEach(async () => {
  await Student.deleteMany({});
  await Payment.deleteMany({});
  await School.deleteMany({});

  await School.create({
    schoolId,
    name: 'Asset Code Test School',
    slug: 'asset-code-test',
    stellarAddress: walletAddress,
  });

  await Student.create({
    schoolId,
    studentId: 'STU-AC-001',
    name: 'Bob Smith',
    class: 'Grade 1',
    feeAmount: 100,
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeUsdcTx({ hash = 'USDC_TX_HASH', memo = 'STU-AC-001', amount = '100.0000000' } = {}) {
  return {
    hash,
    successful: true,
    memo_type: 'text',
    memo,
    operations: async () => ({
      records: [
        {
          type: 'payment',
          to: walletAddress,
          from: 'GSENDER123',
          asset_type: 'credit_alphanum4',
          asset_code: 'USDC',
          asset_issuer: process.env.USDC_ISSUER || USDC_ISSUER,
          amount,
        },
      ],
    }),
    created_at: new Date().toISOString(),
    ledger_attr: 60000,
    fee_paid: '100',
  };
}

function makeXlmTx({ hash = 'XLM_TX_HASH', memo = 'STU-AC-001', amount = '100.0000000' } = {}) {
  return {
    hash,
    successful: true,
    memo_type: 'text',
    memo,
    operations: async () => ({
      records: [
        {
          type: 'payment',
          to: walletAddress,
          from: 'GSENDER123',
          asset_type: 'native',
          amount,
        },
      ],
    }),
    created_at: new Date().toISOString(),
    ledger_attr: 60001,
    fee_paid: '100',
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Asset code fix (issue #1555) — validatePaymentAmount receives correct asset', () => {
  test('detectAsset returns assetCode property (not code)', () => {
    const { detectAsset } = require('../backend/src/services/stellarService');

    const xlmOp = { asset_type: 'native', amount: '100.0000000' };
    const result = detectAsset(xlmOp);

    // Must have assetCode, not code — callers use assetCode
    expect(result).toHaveProperty('assetCode', 'XLM');
    expect(result).not.toHaveProperty('code');
  });

  test('verifyTransaction passes assetCode (USDC) to validatePaymentAmount', async () => {
    const stellarService = require('../backend/src/services/stellarService');
    const paymentLimits = require('../backend/src/utils/paymentLimits');
    const stellarConfig = require('../backend/src/config/stellarConfig');

    const tx = makeUsdcTx({ hash: 'USDC_VERIFY_HASH', memo: 'STU-AC-001', amount: '100.0000000' });

    jest.spyOn(stellarConfig, 'server', 'get').mockReturnValue({
      transactions: () => ({
        transaction: () => ({ call: async () => tx }),
      }),
      ledgers: () => ({
        order: () => ({
          limit: () => ({
            call: async () => ({ records: [{ sequence: 60100 }] }),
          }),
        }),
      }),
    });

    // Spy on validatePaymentAmount to capture the asset argument
    const validateSpy = jest.spyOn(paymentLimits, 'validatePaymentAmount').mockResolvedValue({ valid: true });

    await stellarService.verifyTransaction('USDC_VERIFY_HASH', walletAddress, schoolId);

    // Should have been called with assetCode = 'USDC', not undefined
    expect(validateSpy).toHaveBeenCalledWith(
      expect.any(Number),
      expect.objectContaining({ asset: 'USDC' }),
    );
  });

  test('verifyTransaction passes assetCode (XLM) to validatePaymentAmount', async () => {
    const stellarService = require('../backend/src/services/stellarService');
    const paymentLimits = require('../backend/src/utils/paymentLimits');
    const stellarConfig = require('../backend/src/config/stellarConfig');

    const tx = makeXlmTx({ hash: 'XLM_VERIFY_HASH', memo: 'STU-AC-001', amount: '100.0000000' });

    jest.spyOn(stellarConfig, 'server', 'get').mockReturnValue({
      transactions: () => ({
        transaction: () => ({ call: async () => tx }),
      }),
      ledgers: () => ({
        order: () => ({
          limit: () => ({
            call: async () => ({ records: [{ sequence: 60100 }] }),
          }),
        }),
      }),
    });

    const validateSpy = jest.spyOn(paymentLimits, 'validatePaymentAmount').mockResolvedValue({ valid: true });

    await stellarService.verifyTransaction('XLM_VERIFY_HASH', walletAddress, schoolId);

    expect(validateSpy).toHaveBeenCalledWith(
      expect.any(Number),
      expect.objectContaining({ asset: 'XLM' }),
    );
  });

  test('USDC payment exceeding USDC-specific max limit is rejected (not XLM limit)', async () => {
    const paymentLimits = require('../backend/src/utils/paymentLimits');

    // USDC has a lower max than XLM in this scenario
    const validateSpy = jest.spyOn(paymentLimits, 'validatePaymentAmount')
      .mockImplementation(async (amount, { asset }) => {
        if (asset === 'USDC' && amount > 500) {
          return { valid: false, error: 'Amount too high for USDC', code: 'AMOUNT_TOO_HIGH' };
        }
        if (asset === 'XLM' && amount > 10000) {
          return { valid: false, error: 'Amount too high for XLM', code: 'AMOUNT_TOO_HIGH' };
        }
        return { valid: true };
      });

    const stellarService = require('../backend/src/services/stellarService');
    const stellarConfig = require('../backend/src/config/stellarConfig');

    // 600 USDC — exceeds USDC max (500) but below XLM max (10000)
    const tx = makeUsdcTx({ hash: 'USDC_HIGH_HASH', memo: 'STU-AC-001', amount: '600.0000000' });

    jest.spyOn(stellarConfig, 'server', 'get').mockReturnValue({
      transactions: () => ({
        transaction: () => ({ call: async () => tx }),
      }),
      ledgers: () => ({
        order: () => ({
          limit: () => ({
            call: async () => ({ records: [{ sequence: 60100 }] }),
          }),
        }),
      }),
    });

    await expect(
      stellarService.verifyTransaction('USDC_HIGH_HASH', walletAddress, schoolId)
    ).rejects.toMatchObject({ code: 'AMOUNT_TOO_HIGH' });

    // Confirm the limit was checked as USDC (not XLM)
    expect(validateSpy).toHaveBeenCalledWith(
      600,
      expect.objectContaining({ asset: 'USDC' }),
    );
  });
});
