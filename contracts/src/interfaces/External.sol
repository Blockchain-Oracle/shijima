// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @dev Only the functions the Desk calls. Interfaces were confirmed against deployed bytecode on
///      Robinhood Chain (4663). See docs/research/architecture/03-desk-account.md section 3.

interface ISwapRouter02 {
    /// @dev SwapRouter02 has NO deadline in this struct. The Desk enforces its own.
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}

interface IUniswapV3Factory {
    function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool);
}

interface IUniswapV3Pool {
    function liquidity() external view returns (uint128);
}

interface IAggregatorV3 {
    function decimals() external view returns (uint8);
    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}

interface IStockToken {
    /// @dev Set by the issuer around company events. The token is upgradeable, so this call is always
    ///      wrapped in try/catch: a removed function must never brick the desk.
    function oraclePaused() external view returns (bool);
}
