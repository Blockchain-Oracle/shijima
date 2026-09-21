// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Desk} from "../../src/Desk.sol";
import {ForkBase} from "./Base.t.sol";

/// @dev The owner's browser key. It may pay the owner, stop the desk, fire the agent, lower the caps and sell
///      under the operator's own guards. Nothing else, including through `batch`, and only until it expires.
contract DeskSessionForkTest is ForkBase {
    address key = makeAddr("session-key");

    function setUp() public override {
        super.setUp();
        vm.prank(owner);
        desk.grantSession(key, uint40(block.timestamp + 1 days));
    }

    // ---------------------------------------------------------------- granting
    function test_grant_refusesBadKeys_andAnyExpiryBeyondSevenDays() public {
        vm.startPrank(owner);
        vm.expectRevert(Desk.BadSession.selector);
        desk.grantSession(address(0), uint40(block.timestamp + 1 hours));
        vm.expectRevert(Desk.BadSession.selector);
        desk.grantSession(owner, uint40(block.timestamp + 1 hours));
        vm.expectRevert(Desk.BadSession.selector);
        desk.grantSession(operator, uint40(block.timestamp + 1 hours));
        vm.expectRevert(Desk.BadSession.selector);
        desk.grantSession(key, uint40(block.timestamp));
        vm.expectRevert(Desk.BadSession.selector);
        desk.grantSession(key, uint40(block.timestamp + 7 days + 1));
        desk.grantSession(key, uint40(block.timestamp + 7 days)); // the longest allowed
        vm.stopPrank();

        vm.prank(stranger);
        vm.expectRevert(Desk.NotOwner.selector);
        desk.grantSession(stranger, uint40(block.timestamp + 1 hours));

        vm.prank(key); // the key can never extend itself
        vm.expectRevert(Desk.NotOwner.selector);
        desk.grantSession(key, uint40(block.timestamp + 7 days));
    }

    function test_operator_cannotBeSetToTheSessionKey() public {
        vm.prank(owner);
        vm.expectRevert(Desk.BadOperator.selector);
        desk.setOperator(key);
    }

    // ---------------------------------------------------------------- what the key may do
    function test_key_withdraws_onlyToTheOwner() public {
        uint256 before = _bal(USDG, owner);
        vm.prank(key);
        desk.withdraw(USDG, 250e6);
        assertEq(_bal(USDG, owner) - before, 250e6, "the owner received it");
        assertEq(_bal(USDG, key), 0, "the key received nothing");
    }

    function test_key_stopsTheDesk_andFiresTheAgent_butCannotStartIt() public {
        vm.prank(key);
        desk.pause();
        assertTrue(desk.paused());

        vm.prank(key);
        vm.expectRevert(Desk.NotOwner.selector);
        desk.unpause();

        vm.prank(key);
        desk.revokeOperator();
        assertEq(desk.operator(), address(0));
    }

    function test_key_canOnlyLowerTheCaps() public {
        vm.startPrank(key);
        desk.setLimits(50e6, 200e6);
        assertEq(desk.perActionCapUsdg(), 50e6);
        assertEq(desk.dailyCapUsdg(), 200e6);

        vm.expectRevert(Desk.NotLower.selector);
        desk.setLimits(60e6, 200e6);
        vm.expectRevert(Desk.NotLower.selector);
        desk.setLimits(50e6, 250e6);
        vm.stopPrank();

        vm.prank(owner); // the owner is never limited
        desk.setLimits(100e6, 1_000e6);
    }

    function test_keySell_isGuardedLikeTheOperator_butPauseDoesNotStopIt() public {
        vm.prank(owner);
        uint256 nvda = desk.buy(NVDA, 400e6, 0, _deadline(), H1);

        // About $50 of NVDA: under the $100 per-action cap. It counts against the shared daily window.
        vm.prank(key);
        desk.sell(NVDA, nvda / 8, 0, _deadline(), H2);
        assertGt(desk.spentInWindow(), 40e6, "the sale counted against the cap");

        // About $200 of NVDA: over the per-action cap, refused before swapping.
        vm.prank(key);
        vm.expectRevert(Desk.OverPerActionCap.selector);
        desk.sell(NVDA, nvda / 2, 0, _deadline(), H2);

        // Pause stops the agent, not the owner's key.
        vm.prank(owner);
        desk.pause();
        vm.prank(key);
        desk.sell(NVDA, nvda / 8, 0, _deadline(), H2);
        vm.prank(operator);
        vm.expectRevert(Desk.IsPaused.selector);
        desk.sell(NVDA, nvda / 8, 0, _deadline(), H2);
    }

    function test_keyAndOperator_shareOneDailyWindow() public {
        vm.prank(owner);
        uint256 nvda = desk.buy(NVDA, 400e6, 0, _deadline(), H1);

        vm.startPrank(operator);
        desk.buy(NVDA, 100e6, 0, _deadline(), H1);
        desk.buy(NVDA, 100e6, 0, _deadline(), H1);
        desk.buy(NVDA, 95e6, 0, _deadline(), H1); // $295 of the $300 window used
        vm.stopPrank();

        vm.prank(key);
        vm.expectRevert(Desk.OverDailyCap.selector);
        desk.sell(NVDA, nvda / 8, 0, _deadline(), H2);
    }

    function test_keyBatch_reachesOnlyItsOwnPowers() public {
        bytes[] memory ok = new bytes[](2);
        ok[0] = abi.encodeCall(Desk.pause, ());
        ok[1] = abi.encodeCall(Desk.withdraw, (USDG, 100e6));
        vm.prank(key);
        desk.batch(ok);
        assertTrue(desk.paused());

        bytes[][] memory bad = new bytes[][](6);
        bad[0] = _one(abi.encodeCall(Desk.unpause, ()));
        bad[1] = _one(abi.encodeCall(Desk.setOperator, (stranger)));
        bad[2] = _one(abi.encodeCall(Desk.allowToken, (NVDA, 500, NVDA_FEED)));
        bad[3] = _one(abi.encodeCall(Desk.grantSession, (key, uint40(block.timestamp + 7 days))));
        bad[4] = _one(abi.encodeCall(Desk.buy, (NVDA, 10e6, 0, _deadline(), H1)));
        bad[5] = _one(abi.encodeCall(Desk.disallowToken, (NVDA)));
        for (uint256 i; i < bad.length; ++i) {
            vm.prank(key);
            vm.expectRevert();
            desk.batch(bad[i]);
        }
        assertEq(desk.operator(), operator, "the operator never changed");
    }

    function test_key_cannotBuySweepRedeemOrCheckpoint() public {
        vm.startPrank(key);
        vm.expectRevert(Desk.NotOwnerOrOperator.selector);
        desk.buy(NVDA, 10e6, 0, _deadline(), H1);
        vm.expectRevert(Desk.NotOwnerOrOperator.selector);
        desk.sweepToVault(10e6, _deadline(), H1);
        vm.expectRevert(Desk.NotOwnerOrOperator.selector);
        desk.redeemFromVault(1, _deadline(), H1);
        vm.expectRevert(Desk.NotOwnerOrOperator.selector);
        desk.checkpoint(_deadline(), H1);
        vm.stopPrank();
    }

    // ---------------------------------------------------------------- expiry and revoke
    function test_expiredKey_hasNoPowers() public {
        vm.warp(block.timestamp + 1 days + 1);
        vm.startPrank(key);
        vm.expectRevert(Desk.NotOwnerOrSession.selector);
        desk.withdraw(USDG, 1e6);
        vm.expectRevert(Desk.NotOwnerOrOperator.selector);
        desk.pause();
        vm.expectRevert(Desk.NotOwnerOrOperator.selector);
        desk.sell(NVDA, 1, 0, _deadline(), H2);
        vm.stopPrank();
    }

    function test_revokeSession_byTheOwnerOrTheKey_only() public {
        vm.prank(stranger);
        vm.expectRevert(Desk.NotOwnerOrSession.selector);
        desk.revokeSession();

        vm.prank(key);
        desk.revokeSession();
        assertEq(desk.session(), address(0));

        vm.prank(key);
        vm.expectRevert(Desk.NotOwnerOrSession.selector);
        desk.withdraw(USDG, 1e6);

        vm.prank(owner);
        desk.grantSession(key, uint40(block.timestamp + 1 hours));
        vm.prank(owner);
        desk.revokeSession();
        assertEq(desk.session(), address(0));
    }

    function _one(bytes memory call) private pure returns (bytes[] memory calls) {
        calls = new bytes[](1);
        calls[0] = call;
    }
}
