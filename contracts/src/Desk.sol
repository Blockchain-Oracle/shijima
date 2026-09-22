// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {ReentrancyGuardTransient} from "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";
import {ISwapRouter02, IUniswapV3Factory, IUniswapV3Pool, IAggregatorV3, IStockToken} from "./interfaces/External.sol";

/// @title Desk
/// @notice One owner's account. An off-chain agent (the operator) may trade inside it. It can never send
///         funds anywhere else. Only the owner can take money out, and the owner never changes.
///
///         The promise, in words a non-expert can check against this file:
///           1. No function sends any token to any address except `owner`.
///           2. The two counterparties that pull tokens, the router and the vault, are constants.
///           3. The operator's trades are capped per action and per day, may only use the pool the OWNER
///              pinned for that token, and must land within BAND_BPS of the Chainlink price.
///           4. The owner is never blocked from taking money out: not by pause, caps, the band, a dead feed or a
///              revoked operator. (The owner's own `buy` of a token they disallowed still reverts.)
///           5. The owner may grant ONE browser key (a session) for at most seven days. It can pay the owner
///              (`withdraw`), stop the desk, fire the agent, lower the caps, and sell under the operator's own
///              guards. It can never buy, raise a limit, add a token, change the operator or extend itself.
///
///         So the worst a stolen operator key can do is make bad trades, costing at most BAND_BPS of the
///         daily cap per 24-hour spending window plus pool fees, until the owner calls `revokeOperator`. The
///         window is fixed, not rolling, so across a window boundary that can be twice the cap inside one
///         calendar day. A stolen session key can do no more than that, and only until it expires or the
///         owner calls `revokeSession`.
///
/// @dev    No upgrade path, no admin, no fee switch, no ownership transfer. Deployed as EIP-1167 clones.
contract Desk is Initializable, ReentrancyGuardTransient {
    using SafeERC20 for IERC20;

    // ------------------------------------------------------------------ constants (same for every clone)
    address public constant USDG = 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168; // 6 decimals
    address public constant ROUTER = 0xCaf681a66D020601342297493863E78C959E5cb2; // Uniswap v3 SwapRouter02
    address public constant V3_FACTORY = 0x1f7d7550B1b028f7571E69A784071F0205FD2EfA;
    address public constant VAULT = 0xBeEff033F34C046626B8D0A041844C5d1A5409dd; // Steakhouse USDG, ERC-4626

    /// @notice How far from the Chainlink price an operator trade may land. 8%.
    /// @dev    Wide on purpose. The feed is frozen all weekend, and a protective sell must still pass when
    ///         the pool is several percent below Friday. The cost of this choice is the worst-case sentence
    ///         above. A tighter guard (pool TWAP) is planned and is additive.
    uint256 public constant BAND_BPS = 800;
    /// @notice A "the feed is dead" detector only. It must exceed the longest gap a live feed shows. The price
    ///         log (22 Aug to 21 Sep 2026, Labor Day weekend included) showed gaps up to 96 hours, exactly four
    ///         days, so four days would have refused a real feed. Six days clears it and still catches a dead one.
    uint256 public constant MAX_FEED_AGE = 6 days;
    uint256 public constant MAX_TOKENS = 16;
    /// @notice The longest a session key may live. The owner grants again after that.
    uint256 public constant MAX_SESSION = 7 days;
    /// @dev tokens(18) + feed(8) - usdg(6). Enforced at allowlist time, so the maths below is exact.
    uint256 private constant PRICE_SCALE = 1e20;
    uint256 private constant BPS = 10_000;

    // ------------------------------------------------------------------ storage
    address public owner; // set once, never changes
    address public operator; // address(0) means revoked
    bool public paused;
    uint64 public seq; // +1 on every recorded action, gap free
    bytes32 public head; // keccak256(abi.encode(head, seq, decisionHash)): a hash chain over the record

    uint128 public perActionCapUsdg;
    uint128 public dailyCapUsdg;
    uint128 public spentInWindow;
    uint40 public windowStart;

    struct TokenCfg {
        uint24 fee; // pinned by the owner. NEVER an operator argument: an empty pool can be seeded.
        address feed;
        bool enabled; // false blocks buys. Sells stay allowed so the desk can always exit.
    }

    mapping(address token => TokenCfg) public tokenCfg;
    address[] public tokens;

    /// @notice The owner's browser key, for one-click actions that cannot hurt the owner. address(0) means none.
    address public session;
    uint40 public sessionExpiresAt;

    struct Config {
        address operator;
        uint128 perActionCapUsdg;
        uint128 dailyCapUsdg;
        address[] tokens;
        uint24[] fees;
        address[] feeds;
    }

    // ------------------------------------------------------------------ events
    event Bought(uint64 indexed seq, address indexed token, uint256 usdgIn, uint256 tokenOut, int256 feedPrice, bytes32 indexed decisionHash);
    event Sold(uint64 indexed seq, address indexed token, uint256 amountIn, uint256 usdgOut, int256 feedPrice, uint256 countedUsdg, bytes32 indexed decisionHash);
    event Swept(uint64 indexed seq, uint256 usdgIn, uint256 shares, bytes32 indexed decisionHash);
    event Redeemed(uint64 indexed seq, uint256 shares, uint256 usdgOut, bytes32 indexed decisionHash);
    event Checkpoint(uint64 indexed seq, bytes32 indexed decisionHash);
    event Paused(address indexed by);
    event Unpaused();
    event OperatorSet(address indexed operator);
    event OperatorRevoked();
    event LimitsSet(uint128 perActionCapUsdg, uint128 dailyCapUsdg);
    event TokenAllowed(address indexed token, uint24 fee, address feed);
    event TokenDisallowed(address indexed token);
    event Withdrawn(address indexed token, uint256 amount);
    event SessionGranted(address indexed key, uint40 expiresAt);
    event SessionRevoked(address indexed key);

    // ------------------------------------------------------------------ errors
    error NotOwner();
    error NotOwnerOrOperator();
    error IsPaused();
    error ZeroHash();
    error DeadlinePassed();
    error TokenNotConfigured();
    error TokenNotEnabled();
    error OverPerActionCap();
    error OverDailyCap();
    error FeedUnhealthy();
    error OraclePaused();
    error BelowMinOut();
    error BelowOracleFloor();
    error UnexpectedSpend();
    error BadConfig();
    error BadToken();
    error BadPool();
    error BadFeed();
    error TooManyTokens();
    error BadOperator();
    error NothingReceived();
    error NotOwnerOrSession();
    error BadSession();
    error NotLower();

    /// @dev The implementation itself can never be initialised or used.
    constructor() {
        _disableInitializers();
    }

    // ------------------------------------------------------------------ setup
    function initialize(address owner_, Config calldata cfg) external initializer {
        if (owner_ == address(0)) revert BadConfig();
        if (cfg.tokens.length != cfg.fees.length || cfg.tokens.length != cfg.feeds.length) revert BadConfig();
        owner = owner_;
        _setOperator(cfg.operator);
        _setLimits(cfg.perActionCapUsdg, cfg.dailyCapUsdg);
        for (uint256 i; i < cfg.tokens.length; ++i) {
            _allowToken(cfg.tokens[i], cfg.fees[i], cfg.feeds[i]);
        }
    }

    // ------------------------------------------------------------------ modifiers
    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    /// @dev The owner, or the owner's live session key. Only for actions that pay the owner or protect them.
    modifier onlyOwnerOrSession() {
        if (msg.sender != owner && !_isLiveSession()) revert NotOwnerOrSession();
        _;
    }

    /// @dev Returns true when the caller is the operator, so the body can apply the operator-only guards.
    ///      A session key is neither owner nor operator here, so it can never buy, sweep or checkpoint.
    function _auth() private view returns (bool isOperator) {
        if (msg.sender == owner) return false;
        if (msg.sender != operator || operator == address(0)) revert NotOwnerOrOperator();
        return true;
    }

    function _isLiveSession() private view returns (bool) {
        return session != address(0) && msg.sender == session && block.timestamp <= sessionExpiresAt;
    }

    /// @dev Who is selling. The operator and the session key are both GUARDED: the per-action cap, the daily cap,
    ///      the oracle floor and a healthy feed. Only the operator is stopped by pause, because pause exists to stop
    ///      the agent; the session key acts for the owner. The owner is never guarded.
    function _sellAuth() private view returns (bool guarded) {
        if (msg.sender == owner) return false;
        if ((msg.sender == operator && operator != address(0)) || _isLiveSession()) return true;
        revert NotOwnerOrOperator();
    }

    // ------------------------------------------------------------------ operator OR owner
    /// @notice Buy `token` with `usdgIn` USDG through the pool the owner pinned. Output lands in this desk.
    function buy(address token, uint256 usdgIn, uint256 minOut, uint40 deadline, bytes32 decisionHash)
        external
        nonReentrant
        returns (uint256 tokenOut)
    {
        bool isOperator = _auth();
        _checkCommon(decisionHash, deadline);
        TokenCfg memory cfg = tokenCfg[token];
        if (cfg.fee == 0) revert TokenNotConfigured();
        if (!cfg.enabled) revert TokenNotEnabled();

        int256 price;
        if (isOperator) {
            if (paused) revert IsPaused();
            _spend(usdgIn);
            price = _healthyPrice(token, cfg.feed);
            // Multiply before dividing. Cannot overflow: 2^128 * 1e20 * 1e4 is far below 2^256.
            // forge-lint: disable-next-line(unsafe-typecast)
            uint256 floor = usdgIn * PRICE_SCALE * (BPS - BAND_BPS) / (uint256(price) * BPS); // price > 0 checked
            if (floor > minOut) minOut = floor;
        } else {
            price = _priceOrZero(cfg.feed);
        }

        uint256 usdgBefore = IERC20(USDG).balanceOf(address(this));
        uint256 tokenBefore = IERC20(token).balanceOf(address(this));

        IERC20(USDG).forceApprove(ROUTER, usdgIn);
        ISwapRouter02(ROUTER).exactInputSingle(
            ISwapRouter02.ExactInputSingleParams({
                tokenIn: USDG,
                tokenOut: token,
                fee: cfg.fee,
                recipient: address(this),
                amountIn: usdgIn,
                amountOutMinimum: minOut,
                sqrtPriceLimitX96: 0
            })
        );
        IERC20(USDG).forceApprove(ROUTER, 0);

        // Trust balances, not return values.
        if (usdgBefore - IERC20(USDG).balanceOf(address(this)) != usdgIn) revert UnexpectedSpend();
        tokenOut = IERC20(token).balanceOf(address(this)) - tokenBefore;
        if (tokenOut < minOut) _revertBelow(isOperator);

        emit Bought(_record(decisionHash), token, usdgIn, tokenOut, price, decisionHash);
    }

    /// @notice Sell `amountIn` of `token` for USDG through the pinned pool. Output lands in this desk.
    /// @dev    A disallowed token can still be sold, so the desk can always exit a position.
    function sell(address token, uint256 amountIn, uint256 minUsdgOut, uint40 deadline, bytes32 decisionHash)
        external
        nonReentrant
        returns (uint256 usdgOut)
    {
        bool guarded = _sellAuth();
        _checkCommon(decisionHash, deadline);
        TokenCfg memory cfg = tokenCfg[token];
        if (cfg.fee == 0) revert TokenNotConfigured();

        int256 price;
        uint256 oracleValue;
        if (guarded) {
            if (paused && msg.sender == operator) revert IsPaused(); // pause stops the agent, not the owner's key
            price = _healthyPrice(token, cfg.feed);
            // forge-lint: disable-next-line(unsafe-typecast)
            uint256 p = uint256(price); // price > 0 checked in _healthyPrice
            oracleValue = amountIn * p / PRICE_SCALE;
            if (oracleValue > perActionCapUsdg) revert OverPerActionCap(); // fail early, before the swap
            uint256 floor = amountIn * p * (BPS - BAND_BPS) / (PRICE_SCALE * BPS);
            if (floor > minUsdgOut) minUsdgOut = floor;
        } else {
            price = _priceOrZero(cfg.feed);
        }

        uint256 usdgBefore = IERC20(USDG).balanceOf(address(this));
        uint256 tokenBefore = IERC20(token).balanceOf(address(this));

        IERC20(token).forceApprove(ROUTER, amountIn);
        ISwapRouter02(ROUTER).exactInputSingle(
            ISwapRouter02.ExactInputSingleParams({
                tokenIn: token,
                tokenOut: USDG,
                fee: cfg.fee,
                recipient: address(this),
                amountIn: amountIn,
                amountOutMinimum: minUsdgOut,
                sqrtPriceLimitX96: 0
            })
        );
        IERC20(token).forceApprove(ROUTER, 0);

        if (tokenBefore - IERC20(token).balanceOf(address(this)) != amountIn) revert UnexpectedSpend();
        usdgOut = IERC20(USDG).balanceOf(address(this)) - usdgBefore;
        if (usdgOut < minUsdgOut) _revertBelow(guarded);

        // Count the LARGER of what came back and what the oracle says was sold. In the attack case the
        // attacker arranges for little USDG to come back, so counting only receipts would make the cap
        // weakest exactly when it matters. The oracle value is the one number the operator cannot move.
        // The session key shares the operator's daily window: together they can never spend more than the cap.
        uint256 counted;
        if (guarded) {
            counted = usdgOut > oracleValue ? usdgOut : oracleValue;
            _spend(counted);
        }

        emit Sold(_record(decisionHash), token, amountIn, usdgOut, price, counted, decisionHash);
    }

    /// @notice Park idle USDG in the vault. Shares land in this desk. Does not count against the caps:
    ///         value does not leave, the vault has no fees, and a round trip loses about 1 wei.
    /// @dev    `deadline` is here for the same reason as on buy and sell: once it has passed with no receipt,
    ///         this transaction can never land. That makes "it never landed" a fact, not a guess, which is
    ///         what lets the desk safely send the next one after a crash.
    function sweepToVault(uint256 usdgAmount, uint40 deadline, bytes32 decisionHash)
        external
        nonReentrant
        returns (uint256 shares)
    {
        if (_auth() && paused) revert IsPaused();
        _checkCommon(decisionHash, deadline);

        uint256 sharesBefore = IERC20(VAULT).balanceOf(address(this));
        IERC20(USDG).forceApprove(VAULT, usdgAmount);
        IERC4626(VAULT).deposit(usdgAmount, address(this));
        IERC20(USDG).forceApprove(VAULT, 0);
        shares = IERC20(VAULT).balanceOf(address(this)) - sharesBefore;
        if (shares == 0) revert NothingReceived();

        emit Swept(_record(decisionHash), usdgAmount, shares, decisionHash);
    }

    /// @notice Take USDG back out of the vault. It lands in this desk. Reverts if the vault is short of cash.
    function redeemFromVault(uint256 shares, uint40 deadline, bytes32 decisionHash)
        external
        nonReentrant
        returns (uint256 usdgOut)
    {
        if (_auth() && paused) revert IsPaused();
        _checkCommon(decisionHash, deadline);

        uint256 usdgBefore = IERC20(USDG).balanceOf(address(this));
        IERC4626(VAULT).redeem(shares, address(this), address(this));
        usdgOut = IERC20(USDG).balanceOf(address(this)) - usdgBefore;
        if (usdgOut == 0) revert NothingReceived();

        emit Redeemed(_record(decisionHash), shares, usdgOut, decisionHash);
    }

    /// @notice Seal non-actions into the chain. Allowed while paused: "paused, did nothing" is a record too.
    function checkpoint(uint40 deadline, bytes32 decisionHash) external {
        _auth();
        _checkCommon(decisionHash, deadline);
        emit Checkpoint(_record(decisionHash), decisionHash);
    }

    /// @notice The owner, the operator or the owner's session key may stop the desk. Only the owner may start
    ///         it again.
    function pause() external {
        if (!_isLiveSession()) _auth();
        paused = true;
        emit Paused(msg.sender);
    }

    // ------------------------------------------------------------------ owner only. Never blocked.
    /// @notice The ONLY way value leaves the desk, and it can only go to `owner`. Works for any ERC-20,
    ///         including vault shares and anything sent here by mistake. One token per call, so a frozen
    ///         token can never trap the others.
    ///         The session key may call it too: it still pays only `owner`.
    ///         `type(uint256).max` means the whole balance at that moment, so "sell everything, then send me
    ///         all of it" fits in one `batch` even though the sale's exact proceeds are not known in advance.
    function withdraw(address token, uint256 amount) external onlyOwnerOrSession nonReentrant {
        if (amount == type(uint256).max) amount = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransfer(owner, amount);
        emit Withdrawn(token, amount);
    }

    function unpause() external onlyOwner {
        paused = false;
        emit Unpaused();
    }

    function setOperator(address newOperator) external onlyOwner {
        if (newOperator == address(0)) revert BadOperator(); // use revokeOperator
        _setOperator(newOperator);
    }

    /// @notice Fire the agent. One transaction. It loses all access immediately and the desk is paused.
    ///         The session key may do this too: it can only take power away.
    function revokeOperator() external onlyOwnerOrSession {
        operator = address(0);
        paused = true;
        emit OperatorRevoked();
        emit Paused(msg.sender);
    }

    /// @notice The owner sets the caps freely. The session key may only lower them.
    function setLimits(uint128 perActionCapUsdg_, uint128 dailyCapUsdg_) external onlyOwnerOrSession {
        if (msg.sender != owner && (perActionCapUsdg_ > perActionCapUsdg || dailyCapUsdg_ > dailyCapUsdg)) {
            revert NotLower();
        }
        _setLimits(perActionCapUsdg_, dailyCapUsdg_);
    }

    /// @notice Give one browser key the session powers listed at the top of this file, until `expiresAt`, at most
    ///         MAX_SESSION from now. Replaces any earlier key. The key pays its own gas: fund it with a plain
    ///         transfer from the owner's wallet. This desk never receives ETH.
    function grantSession(address key, uint40 expiresAt) external onlyOwner {
        if (key == address(0) || key == owner || key == operator) revert BadSession();
        if (expiresAt <= block.timestamp || expiresAt > block.timestamp + MAX_SESSION) revert BadSession();
        session = key;
        sessionExpiresAt = expiresAt;
        emit SessionGranted(key, expiresAt);
    }

    /// @notice End the session key's powers now. The owner or the key itself may call it.
    function revokeSession() external {
        address key = session;
        if (msg.sender != owner && (key == address(0) || msg.sender != key)) revert NotOwnerOrSession();
        session = address(0);
        sessionExpiresAt = 0;
        emit SessionRevoked(key);
    }

    function allowToken(address token, uint24 fee, address feed) external onlyOwner {
        _allowToken(token, fee, feed);
    }

    function disallowToken(address token) external onlyOwner {
        if (tokenCfg[token].fee == 0) revert TokenNotConfigured();
        tokenCfg[token].enabled = false;
        emit TokenDisallowed(token);
    }

    /// @notice Several actions in ONE confirmation: "sell everything", "withdraw all", "close the desk". Each
    ///         inner call runs with its OWN guards, so the session key's batch can reach only what the key itself
    ///         may call: an owner-only call inside it reverts the whole batch.
    /// @dev    Self-delegatecall keeps msg.sender as the caller. Not nonReentrant, because the inner calls are.
    function batch(bytes[] calldata calls) external onlyOwnerOrSession returns (bytes[] memory results) {
        results = new bytes[](calls.length);
        for (uint256 i; i < calls.length; ++i) {
            (bool ok, bytes memory ret) = address(this).delegatecall(calls[i]);
            if (!ok) {
                assembly {
                    revert(add(ret, 0x20), mload(ret))
                }
            }
            results[i] = ret;
        }
    }

    // ------------------------------------------------------------------ views for the agent and the UI
    function tokenCount() external view returns (uint256) {
        return tokens.length;
    }

    function allTokens() external view returns (address[] memory) {
        return tokens;
    }

    /// @notice How much the operator may still spend in the current window.
    function remainingDailyCap() external view returns (uint256) {
        if (block.timestamp >= uint256(windowStart) + 1 days) return dailyCapUsdg;
        return spentInWindow >= dailyCapUsdg ? 0 : dailyCapUsdg - spentInWindow;
    }

    // ------------------------------------------------------------------ internals
    function _checkCommon(bytes32 decisionHash, uint40 deadline) private view {
        if (decisionHash == bytes32(0)) revert ZeroHash();
        if (block.timestamp > deadline) revert DeadlinePassed();
    }

    /// @dev Fixed 24 hour window. Known and accepted: spending at the end of one window and the start of
    ///      the next allows up to twice the cap inside 24 hours. A rolling window is not worth the code.
    function _spend(uint256 amount) private {
        if (amount > perActionCapUsdg) revert OverPerActionCap();
        if (block.timestamp >= uint256(windowStart) + 1 days) {
            // forge-lint: disable-next-line(unsafe-typecast)
            windowStart = uint40(block.timestamp); // safe until the year 36812
            spentInWindow = 0;
        }
        uint256 total = uint256(spentInWindow) + amount;
        if (total > dailyCapUsdg) revert OverDailyCap();
        // forge-lint: disable-next-line(unsafe-typecast)
        spentInWindow = uint128(total); // total <= dailyCapUsdg, which is a uint128
    }

    /// @dev For a guarded caller, `minOut` was raised to the oracle floor, so a shortfall means the floor failed.
    function _revertBelow(bool guarded) private pure {
        if (guarded) revert BelowOracleFloor();
        revert BelowMinOut();
    }

    function _record(bytes32 decisionHash) private returns (uint64 newSeq) {
        newSeq = ++seq;
        head = keccak256(abi.encode(head, newSeq, decisionHash));
    }

    /// @dev For the operator. Reverts unless the feed is alive and the issuer has not paused the oracle.
    ///      Feed age is wall-clock here and MAX_FEED_AGE is long, because the feed is frozen all weekend
    ///      by design. Halts cannot be checked on-chain: no such flag exists. The off-chain gate does that.
    function _healthyPrice(address token, address feed) private view returns (int256 price) {
        uint256 updatedAt;
        (, price,, updatedAt,) = IAggregatorV3(feed).latestRoundData();
        if (price <= 0 || updatedAt == 0 || block.timestamp - updatedAt > MAX_FEED_AGE) revert FeedUnhealthy();
        try IStockToken(token).oraclePaused() returns (bool isPaused) {
            if (isPaused) revert OraclePaused();
        } catch {}
    }

    /// @dev For the owner. Only used to put a price in the event. Never allowed to block the owner.
    function _priceOrZero(address feed) private view returns (int256 price) {
        try IAggregatorV3(feed).latestRoundData() returns (uint80, int256 answer, uint256, uint256, uint80) {
            price = answer;
        } catch {}
    }

    function _setOperator(address newOperator) private {
        if (newOperator == owner) revert BadOperator(); // keep the roles distinct
        if (session != address(0) && newOperator == session) revert BadOperator();
        operator = newOperator;
        emit OperatorSet(newOperator);
    }

    function _setLimits(uint128 perAction, uint128 daily) private {
        if (perAction > daily) revert BadConfig();
        perActionCapUsdg = perAction;
        dailyCapUsdg = daily;
        emit LimitsSet(perAction, daily);
    }

    /// @dev Checks that make PRICE_SCALE exact and the pinned pool real. `getPool != 0` alone is NOT a
    ///      safety check: an initialised empty pool exists for NVDA at the 1% tier and could be seeded.
    function _allowToken(address token, uint24 fee, address feed) private {
        if (token == address(0) || token == USDG || token == VAULT) revert BadToken();
        if (IERC20Metadata(token).decimals() != 18) revert BadToken();
        address pool = IUniswapV3Factory(V3_FACTORY).getPool(USDG, token, fee);
        if (fee == 0 || pool == address(0) || IUniswapV3Pool(pool).liquidity() == 0) revert BadPool();
        if (IAggregatorV3(feed).decimals() != 8) revert BadFeed();
        (, int256 answer,, uint256 updatedAt,) = IAggregatorV3(feed).latestRoundData();
        if (answer <= 0 || updatedAt == 0) revert BadFeed();

        if (tokenCfg[token].fee == 0) {
            if (tokens.length >= MAX_TOKENS) revert TooManyTokens();
            tokens.push(token);
        }
        tokenCfg[token] = TokenCfg({fee: fee, feed: feed, enabled: true});
        emit TokenAllowed(token, fee, feed);
    }
}
