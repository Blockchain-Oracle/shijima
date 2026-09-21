// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Desk} from "../../src/Desk.sol";
import {ForkBase} from "./Base.t.sol";

contract DeskOwnerForkTest is ForkBase {
    // ---------------------------------------------------------------- pause and revoke
    function test_pause_operatorCanStop_onlyOwnerCanStart() public {
        vm.prank(operator);
        desk.pause();
        assertTrue(desk.paused());

        vm.startPrank(operator);
        vm.expectRevert(Desk.IsPaused.selector);
        desk.buy(NVDA, 10e6, 0, _deadline(), H1);
        vm.expectRevert(Desk.IsPaused.selector);
        desk.sweepToVault(10e6, _deadline(), H1);
        desk.checkpoint(_deadline(), H1); // "paused, did nothing" is still a record
        vm.stopPrank();
        assertEq(desk.seq(), 1);

        vm.prank(owner); // pause never blocks the owner
        desk.buy(NVDA, 10e6, 0, _deadline(), H1);

        vm.prank(owner);
        desk.unpause();
        vm.prank(operator);
        desk.buy(NVDA, 10e6, 0, _deadline(), H1);
    }

    function test_revokeOperator_isOneTransaction_andFinal() public {
        vm.prank(owner);
        desk.revokeOperator();
        assertEq(desk.operator(), address(0));
        assertTrue(desk.paused());

        vm.startPrank(operator);
        vm.expectRevert(Desk.NotOwnerOrOperator.selector);
        desk.buy(NVDA, 10e6, 0, _deadline(), H1);
        vm.expectRevert(Desk.NotOwnerOrOperator.selector);
        desk.checkpoint(_deadline(), H1);
        vm.expectRevert(Desk.NotOwnerOrOperator.selector);
        desk.pause();
        vm.stopPrank();
    }

    function test_zeroAddress_isNeverTheOperator() public {
        vm.prank(owner);
        desk.revokeOperator();
        vm.prank(address(0));
        vm.expectRevert(Desk.NotOwnerOrOperator.selector);
        desk.checkpoint(_deadline(), H1);
    }

    // ---------------------------------------------------------------- withdraw: always, and only to the owner
    function test_withdraw_goesOnlyToOwner_inEveryState() public {
        vm.prank(operator);
        uint256 nvda = desk.buy(NVDA, 100e6, 0, _deadline(), H1);

        vm.prank(owner);
        desk.revokeOperator(); // paused AND revoked: the owner must still get everything out

        uint256 usdg = _bal(USDG, address(desk));
        vm.startPrank(owner);
        desk.withdraw(USDG, usdg);
        desk.withdraw(NVDA, nvda);
        vm.stopPrank();

        assertEq(_bal(USDG, owner), usdg);
        assertEq(_bal(NVDA, owner), nvda);
        assertEq(_bal(USDG, address(desk)), 0);
        assertEq(_bal(NVDA, address(desk)), 0);
    }

    function test_disallowedToken_cannotBeBought_butCanStillBeSold() public {
        vm.prank(operator);
        uint256 out = desk.buy(NVDA, 50e6, 0, _deadline(), H1);

        vm.prank(owner);
        desk.disallowToken(NVDA);

        vm.startPrank(operator);
        vm.expectRevert(Desk.TokenNotEnabled.selector);
        desk.buy(NVDA, 10e6, 0, _deadline(), H1);
        assertGt(desk.sell(NVDA, out, 0, _deadline(), H2), 0, "the desk can always exit");
        vm.stopPrank();
    }

    // ---------------------------------------------------------------- vault
    function test_vault_sweepAndRedeem_returnsTheCash_andTouchesNoCap() public {
        uint256 before = _bal(USDG, address(desk));

        vm.startPrank(operator);
        uint256 shares = desk.sweepToVault(200e6, _deadline(), H1);
        assertEq(_bal(VAULT, address(desk)), shares, "shares are held by the desk");
        assertEq(IERC20(USDG).allowance(address(desk), VAULT), 0, "no standing allowance");
        uint256 back = desk.redeemFromVault(shares, _deadline(), H2);
        vm.stopPrank();

        assertGe(back, 200e6 - 2, "round trip loses at most rounding");
        assertGe(_bal(USDG, address(desk)), before - 2);
        assertEq(desk.spentInWindow(), 0, "parking cash is not spending");
        assertEq(desk.seq(), 2);
    }

    function test_ownerCanWithdrawVaultShares_directly() public {
        vm.prank(operator);
        uint256 shares = desk.sweepToVault(100e6, _deadline(), H1);
        vm.prank(owner);
        desk.withdraw(VAULT, shares);
        assertEq(_bal(VAULT, owner), shares);
    }

    // ---------------------------------------------------------------- batch: one confirmation
    function test_batch_sellsEverythingAndWithdraws_inOneCall() public {
        vm.startPrank(owner);
        uint256 nvda = desk.buy(NVDA, 200e6, 0, _deadline(), H1);
        uint256 aapl = desk.buy(AAPL, 200e6, 0, _deadline(), H1);
        uint256 shares = desk.sweepToVault(100e6, _deadline(), H1);

        bytes[] memory calls = new bytes[](3);
        calls[0] = abi.encodeCall(Desk.sell, (NVDA, nvda, 0, _deadline(), H2));
        calls[1] = abi.encodeCall(Desk.sell, (AAPL, aapl, 0, _deadline(), H2));
        calls[2] = abi.encodeCall(Desk.redeemFromVault, (shares, _deadline(), H2));
        desk.batch(calls);

        uint256 all = _bal(USDG, address(desk));
        bytes[] memory out = new bytes[](1);
        out[0] = abi.encodeCall(Desk.withdraw, (USDG, all));
        desk.batch(out);
        vm.stopPrank();

        assertEq(_bal(NVDA, address(desk)), 0);
        assertEq(_bal(AAPL, address(desk)), 0);
        assertEq(_bal(VAULT, address(desk)), 0);
        assertEq(_bal(USDG, address(desk)), 0);
        assertGt(_bal(USDG, owner), 990e6, "about $1,000 came back, minus pool fees");
    }

    function test_batch_bubblesTheInnerError() public {
        bytes[] memory calls = new bytes[](1);
        calls[0] = abi.encodeCall(Desk.disallowToken, (address(0xBEEF)));
        vm.prank(owner);
        vm.expectRevert(Desk.TokenNotConfigured.selector);
        desk.batch(calls);
    }

    function test_batch_cannotReinitialise() public {
        bytes[] memory calls = new bytes[](1);
        calls[0] = abi.encodeCall(Desk.initialize, (stranger, _config(1, 1)));
        vm.prank(owner);
        vm.expectRevert();
        desk.batch(calls);
        assertEq(desk.owner(), owner);
    }

    // ---------------------------------------------------------------- misc invariants
    function test_desk_cannotReceiveEth() public {
        vm.deal(address(this), 1 ether);
        (bool ok,) = address(desk).call{value: 1}("");
        assertFalse(ok);
    }

    function test_limits_perActionCannotExceedDaily_andOperatorCannotBeOwner() public {
        vm.startPrank(owner);
        vm.expectRevert(Desk.BadConfig.selector);
        desk.setLimits(500e6, 100e6);
        vm.expectRevert(Desk.BadOperator.selector);
        desk.setOperator(owner);
        vm.expectRevert(Desk.BadOperator.selector);
        desk.setOperator(address(0));
        vm.stopPrank();
    }

    /// v1: every operator call carries a deadline, so "it never landed" is a fact once the deadline has passed.
    function test_everyOperatorCall_refusesAPastDeadline() public {
        uint40 past = uint40(block.timestamp - 1);
        vm.startPrank(operator);
        vm.expectRevert(Desk.DeadlinePassed.selector);
        desk.checkpoint(past, H1);
        vm.expectRevert(Desk.DeadlinePassed.selector);
        desk.sweepToVault(10e6, past, H1);
        vm.expectRevert(Desk.DeadlinePassed.selector);
        desk.redeemFromVault(1, past, H1);
        vm.stopPrank();
    }
}
