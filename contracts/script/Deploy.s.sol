// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {DeskFactory} from "../src/DeskFactory.sol";

/// @notice Deploys the factory. The factory's constructor deploys the Desk implementation.
///         Nothing here holds funds and nothing here has an owner or an admin.
contract Deploy is Script {
    function run() external returns (DeskFactory factory) {
        vm.startBroadcast();
        factory = new DeskFactory();
        vm.stopBroadcast();
        console2.log("DeskFactory", address(factory));
        console2.log("Desk implementation", factory.implementation());
    }
}
