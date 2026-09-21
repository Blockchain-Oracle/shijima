/** Minimal ABIs. Only what we call. */
import { parseAbi } from 'viem'

export const erc20Abi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
])

export const stockTokenAbi = parseAbi([
  'function uiMultiplier() view returns (uint256)',
  'function newUIMultiplier() view returns (uint256)',
  'function effectiveAt() view returns (uint256)',
  'function oraclePaused() view returns (bool)',
  'event UIMultiplierUpdated(uint256 oldMultiplier, uint256 newMultiplier, uint256 effectiveAtTimestamp)',
])

/** The savings vault is ERC-4626. Never read maxDeposit or maxWithdraw: they return 0 by design. */
export const vaultAbi = parseAbi([
  'function convertToAssets(uint256 shares) view returns (uint256)',
  'function previewWithdraw(uint256 assets) view returns (uint256 shares)',
])

export const v3FactoryAbi = parseAbi(['function getPool(address, address, uint24) view returns (address)'])

export const v3PoolAbi = parseAbi([
  'function liquidity() view returns (uint128)',
  'function token0() view returns (address)',
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
  'function observe(uint32[] secondsAgos) view returns (int56[] tickCumulatives, uint160[] secondsPerLiquidityCumulativeX128s)',
])

/**
 * QuoterV2 quotes by reverting internally, so it is declared nonpayable on-chain. We only ever call it
 * through eth_call, so it is declared `view` here. That lets viem batch it through Multicall3.
 */
export const quoterV2Abi = parseAbi([
  'struct QuoteExactInputSingleParams { address tokenIn; address tokenOut; uint256 amountIn; uint24 fee; uint160 sqrtPriceLimitX96; }',
  'function quoteExactInputSingle(QuoteExactInputSingleParams params) view returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)',
])

export const aggregatorV3Abi = parseAbi([
  'function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
  'function decimals() view returns (uint8)',
  'function description() view returns (string)',
])
