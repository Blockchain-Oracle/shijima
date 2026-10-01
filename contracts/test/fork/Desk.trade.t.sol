// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Desk} from "../../src/Desk.sol";
import {ForkBase} from "./Base.t.sol";

contract DeskTradeForkTest is ForkBase {
    // ---------------------------------------------------------------- setup and access
    function test_factory_setsCallerAsOwner_andPredictsAddress() public {
        assertEq(desk.owner(), owner);
        assertEq(desk.operator(), operator);
        assertEq(factory.predictDesk(owner, bytes32(0)), address(desk));
        assertEq(factory.desksOf(owner).length, 1);
        assertEq(desk.tokenCount(), 2);
    }

    function test_implementation_cannotBeInitialised_andCloneOnlyOnce() public {
        Desk impl = Desk(factory.implementation());
        vm.expectRevert();
        impl.initialize(stranger, _config(1, 1));
        vm.expectRevert();
        desk.initialize(stranger, _config(1, 1));
    }

    function test_stranger_canDoNothing() public {
        vm.startPrank(stranger);
        vm.expectRevert(Desk.NotOwnerOrOperator.selector);
        desk.buy(NVDA, 10e6, 0, _deadline(), H1);
        vm.expectRevert(Desk.NotOwnerOrOperator.selector);
        desk.pause();
        vm.expectRevert(Desk.NotOwnerOrSession.selector); // owner or the owner's session key only
        desk.withdraw(USDG, 1);
        vm.expectRevert(Desk.NotOwnerOrSession.selector);
        desk.revokeSession();
        vm.stopPrank();
    }

    function test_operator_cannotUseOwnerPowers() public {
        vm.startPrank(operator);
        vm.expectRevert(Desk.NotOwnerOrSession.selector);
        desk.withdraw(USDG, 1);
        vm.expectRevert(Desk.NotOwner.selector);
        desk.unpause();
        vm.expectRevert(Desk.NotOwnerOrSession.selector);
        desk.setLimits(1e12, 1e12);
        vm.expectRevert(Desk.NotOwner.selector);
        desk.allowToken(NVDA, 500, NVDA_FEED);
        vm.expectRevert(Desk.NotOwner.selector);
        desk.setOperator(stranger);
        vm.expectRevert(Desk.NotOwnerOrSession.selector);
        desk.batch(new bytes[](0));
        vm.expectRevert(Desk.NotOwner.selector);
        desk.grantSession(operator, uint40(block.timestamp + 1 hours));
        vm.stopPrank();
    }

    // ---------------------------------------------------------------- buy and sell
    function test_operatorBuy_landsInDesk_recordsHash_leavesNoAllowance() public {
        uint256 usdgBefore = _bal(USDG, address(desk));

        vm.prank(operator);
        uint256 out = desk.buy(NVDA, 100e6, 0, _deadline(), H1);

        assertGt(out, 0);
        assertEq(_bal(NVDA, address(desk)), out, "tokens are in the desk");
        assertEq(usdgBefore - _bal(USDG, address(desk)), 100e6, "exactly the stated USDG was spent");
        assertEq(IERC20(USDG).allowance(address(desk), ROUTER), 0, "no standing allowance");
        assertEq(desk.seq(), 1);
        assertEq(desk.head(), keccak256(abi.encode(bytes32(0), uint64(1), H1)), "hash chain advanced");
        assertEq(desk.spentInWindow(), 100e6);
        assertEq(desk.remainingDailyCap(), 200e6);
    }

    function test_roundTrip_costsOnlyPoolFees_andSellCountsAgainstCap() public {
        // Half the cap, so the test holds whether the pool sits above or below the frozen feed.
        vm.startPrank(operator);
        uint256 out = desk.buy(NVDA, 50e6, 0, _deadline(), H1);
        uint256 back = desk.sell(NVDA, out, 0, _deadline(), H2);
        vm.stopPrank();

        assertGt(back, 49.5e6, "round trip on the deep pool loses well under 1%");
        assertLt(back, 50e6);
        assertEq(_bal(NVDA, address(desk)), 0);
        assertEq(IERC20(NVDA).allowance(address(desk), ROUTER), 0);
        assertEq(desk.seq(), 2);
        assertEq(desk.head(), keccak256(abi.encode(keccak256(abi.encode(bytes32(0), uint64(1), H1)), uint64(2), H2)));
        // the sell counted at the larger of received and oracle value, so at least what came back
        assertGe(desk.spentInWindow(), 50e6 + back);
    }

    /// @dev Found on Sunday 20 Sep 2026: NVDA had drifted 65 bps BELOW the frozen feed, so 100 USDG bought
    ///      tokens the oracle valued at 100.66, and selling them was refused against a 100 cap. That is the
    ///      design working. Sells count at the LARGER of USDG received and oracle value, so on a discount
    ///      weekend the cap binds on oracle value. The off-chain gate must size sells the same way, or a
    ///      protective sell would be refused on-chain exactly when it is needed.
    function test_discountWeekend_sellCountsAtOracleValue_notAtWhatCameBack() public {
        vm.prank(operator);
        uint256 out = desk.buy(NVDA, 100e6, 0, _deadline(), H1);

        // Put the feed 5% above what the pool just paid, as on a weekend where the pool has fallen.
        uint256 poolPrice = 100e6 * 1e20 / out; // 8 decimals
        int256 feedAbove = int256(poolPrice * 105 / 100);
        vm.mockCall(
            NVDA_FEED,
            abi.encodeWithSignature("latestRoundData()"),
            abi.encode(uint80(1), feedAbove, uint256(1), block.timestamp, uint80(1))
        );

        vm.startPrank(operator);
        vm.expectRevert(Desk.OverPerActionCap.selector); // oracle says these tokens are worth about 105
        desk.sell(NVDA, out, 0, _deadline(), H2);

        uint256 spentBefore = desk.spentInWindow();
        uint256 half = out / 2;
        uint256 back = desk.sell(NVDA, half, 0, _deadline(), H2); // about 52.5 by the oracle: allowed
        vm.stopPrank();

        uint256 counted = desk.spentInWindow() - spentBefore;
        assertGt(counted, back, "counted the oracle value, which is higher than the USDG received");
        assertApproxEqRel(counted, half * uint256(feedAbove) / 1e20, 1e12);
        vm.clearMockedCalls();
    }

    function test_reverts_zeroHash_deadline_unknownToken() public {
        vm.startPrank(operator);
        vm.expectRevert(Desk.ZeroHash.selector);
        desk.buy(NVDA, 10e6, 0, _deadline(), bytes32(0));
        vm.expectRevert(Desk.DeadlinePassed.selector);
        desk.buy(NVDA, 10e6, 0, uint40(block.timestamp - 1), H1);
        vm.expectRevert(Desk.TokenNotConfigured.selector);
        desk.buy(address(0xBEEF), 10e6, 0, _deadline(), H1);
        vm.stopPrank();
    }

    function test_operatorMinOut_isRespected() public {
        vm.prank(operator);
        vm.expectRevert(); // the router refuses with "Too little received"
        desk.buy(NVDA, 100e6, type(uint128).max, _deadline(), H1);
    }

    // ---------------------------------------------------------------- caps
    function test_perActionCap_blocksOperator_notOwner() public {
        vm.prank(operator);
        vm.expectRevert(Desk.OverPerActionCap.selector);
        desk.buy(NVDA, 100e6 + 1, 0, _deadline(), H1);

        vm.prank(owner); // the owner is never subject to caps
        desk.buy(NVDA, 250e6, 0, _deadline(), H1);
        assertEq(desk.spentInWindow(), 0, "owner trades do not consume the agent's allowance");
    }

    function test_dailyCap_blocks_thenResetsAfter24h() public {
        vm.startPrank(operator);
        desk.buy(NVDA, 100e6, 0, _deadline(), H1);
        desk.buy(NVDA, 100e6, 0, _deadline(), H1);
        desk.buy(AAPL, 100e6, 0, _deadline(), H1);
        vm.expectRevert(Desk.OverDailyCap.selector);
        desk.buy(NVDA, 1e6, 0, _deadline(), H1);
        assertEq(desk.remainingDailyCap(), 0);

        vm.warp(block.timestamp + 1 days);
        assertEq(desk.remainingDailyCap(), 300e6);
        desk.buy(NVDA, 50e6, 0, _deadline(), H1);
        assertEq(desk.spentInWindow(), 50e6);
        vm.stopPrank();
    }

    function test_sell_overPerActionCap_failsBeforeSwapping() public {
        vm.prank(owner);
        uint256 out = desk.buy(NVDA, 500e6, 0, _deadline(), H1); // owner builds a position above the cap
        vm.prank(operator);
        vm.expectRevert(Desk.OverPerActionCap.selector);
        desk.sell(NVDA, out, 0, _deadline(), H2);
    }

    // ---------------------------------------------------------------- the pinned pool and the oracle floor
    function test_owner_cannotPinAnEmptyPool() public {
        // Liquidity on the live chain changes. Make this existing, initialised pool empty explicitly:
        // getPool != 0 must not be enough to admit it.
        vm.mockCall(NVDA_POOL_500, abi.encodeWithSignature("liquidity()"), abi.encode(uint128(0)));
        vm.prank(owner);
        vm.expectRevert(Desk.BadPool.selector);
        desk.allowToken(NVDA, 500, NVDA_FEED);
    }

    function test_oracleFloor_blocksOperator_whenPoolIsPushedFarFromFeed() public {
        // A whale buys enough NVDA to push the pool far above the Chainlink price.
        address whale = makeAddr("whale");
        uint256 size = _bal(USDG, NVDA_POOL_500); // as much USDG again as the pool holds
        deal(USDG, whale, size);
        vm.startPrank(whale);
        IERC20(USDG).approve(ROUTER, size);
        (bool ok,) = ROUTER.call(
            abi.encodeWithSignature(
                "exactInputSingle((address,address,uint24,address,uint256,uint256,uint160))",
                USDG, NVDA, uint24(500), whale, size, uint256(0), uint160(0)
            )
        );
        vm.stopPrank();
        assertTrue(ok, "whale swap");

        vm.prank(operator);
        vm.expectRevert(); // router "Too little received": minOut was raised to the oracle floor
        desk.buy(NVDA, 100e6, 0, _deadline(), H1);

        vm.prank(owner); // the owner may still trade at any price: it is their money
        desk.buy(NVDA, 100e6, 0, _deadline(), H1);
    }

    function test_feedFailures_blockOperator_neverOwner() public {
        bytes memory call = abi.encodeWithSignature("latestRoundData()");
        vm.mockCall(NVDA_FEED, call, abi.encode(uint80(1), int256(0), uint256(1), block.timestamp, uint80(1)));
        vm.prank(operator);
        vm.expectRevert(Desk.FeedUnhealthy.selector);
        desk.buy(NVDA, 10e6, 0, _deadline(), H1);

        vm.mockCall(NVDA_FEED, call, abi.encode(uint80(1), int256(222e8), uint256(1), block.timestamp - 7 days, uint80(1)));
        vm.prank(operator);
        vm.expectRevert(Desk.FeedUnhealthy.selector);
        desk.buy(NVDA, 10e6, 0, _deadline(), H1);

        vm.prank(owner); // a dead feed must never trap the owner
        desk.buy(NVDA, 10e6, 0, _deadline(), H1);
        vm.clearMockedCalls();
    }

    function test_weekendStaleFeed_stillAllowsOperator() public {
        // The feed is frozen all weekend by design. 60 hours old must still trade.
        (, int256 answer,,,) = _latest(NVDA_FEED);
        vm.mockCall(
            NVDA_FEED,
            abi.encodeWithSignature("latestRoundData()"),
            abi.encode(uint80(1), answer, uint256(1), block.timestamp - 60 hours, uint80(1))
        );
        vm.prank(operator);
        assertGt(desk.buy(NVDA, 10e6, 0, _deadline(), H1), 0);
        vm.clearMockedCalls();
    }

    function test_oraclePaused_blocksOperator_butARevertingFlagIsIgnored() public {
        bytes memory call = abi.encodeWithSignature("oraclePaused()");
        vm.mockCall(NVDA, call, abi.encode(true));
        vm.prank(operator);
        vm.expectRevert(Desk.OraclePaused.selector);
        desk.buy(NVDA, 10e6, 0, _deadline(), H1);

        // The token is upgradeable. If the issuer removes this function, the desk must keep working.
        vm.mockCallRevert(NVDA, call, "gone");
        vm.prank(operator);
        assertGt(desk.buy(NVDA, 10e6, 0, _deadline(), H1), 0);
        vm.clearMockedCalls();
    }

    function _latest(address feed) private view returns (uint80, int256, uint256, uint256, uint80) {
        (bool ok, bytes memory ret) = feed.staticcall(abi.encodeWithSignature("latestRoundData()"));
        require(ok, "feed");
        return abi.decode(ret, (uint80, int256, uint256, uint256, uint80));
    }
}
