// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Desk} from "../../src/Desk.sol";
import {DeskFactory} from "../../src/DeskFactory.sol";

/// @dev Fork tests run UNPINNED against live Robinhood Chain state, because the public RPC keeps only about
///      ten minutes of history. So every assertion is relative: deltas and bounds, never an absolute price.
abstract contract ForkBase is Test {
    address constant USDG = 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168;
    address constant ROUTER = 0xCaf681a66D020601342297493863E78C959E5cb2;
    address constant VAULT = 0xBeEff033F34C046626B8D0A041844C5d1A5409dd;

    address constant NVDA = 0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC;
    address constant NVDA_FEED = 0x379EC4f7C378F34a1B47E4F3cbeBCbAC3E8E9F15;
    address constant NVDA_POOL_500 = 0xd4EB21209C4D6093f80B5b84f5C45cc093EA14a3; // deep
    address constant AAPL = 0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9;
    address constant AAPL_FEED = 0x6B22A786bAa607d76728168703a39Ea9C99f2cD0;

    address owner = makeAddr("owner");
    address operator = makeAddr("operator");
    address stranger = makeAddr("stranger");

    DeskFactory factory;
    Desk desk;

    bytes32 constant H1 = keccak256("decision-1");
    bytes32 constant H2 = keccak256("decision-2");

    function setUp() public virtual {
        factory = new DeskFactory();
        vm.prank(owner);
        desk = Desk(factory.createDesk(_config(100e6, 300e6), bytes32(0)));
        _fund(address(desk), 1_000e6);
    }

    function _config(uint128 perAction, uint128 daily) internal view returns (Desk.Config memory cfg) {
        cfg.operator = operator;
        cfg.perActionCapUsdg = perAction;
        cfg.dailyCapUsdg = daily;
        cfg.tokens = new address[](2);
        cfg.fees = new uint24[](2);
        cfg.feeds = new address[](2);
        (cfg.tokens[0], cfg.fees[0], cfg.feeds[0]) = (NVDA, 500, NVDA_FEED);
        (cfg.tokens[1], cfg.fees[1], cfg.feeds[1]) = (AAPL, 500, AAPL_FEED);
    }

    /// @dev Real USDG, moved from the deep NVDA pool. More robust than guessing a Paxos storage slot.
    function _fund(address to, uint256 amount) internal {
        vm.prank(NVDA_POOL_500);
        IERC20(USDG).transfer(to, amount);
    }

    function _deadline() internal view returns (uint40) {
        return uint40(block.timestamp + 120);
    }

    function _bal(address token, address who) internal view returns (uint256) {
        return IERC20(token).balanceOf(who);
    }
}
