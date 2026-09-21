// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {Desk} from "./Desk.sol";

/// @title DeskFactory
/// @notice Deploys one Desk per call as an EIP-1167 clone. The factory owns nothing and controls nothing
///         after creation. The owner of a new desk is always the caller: nobody can create a desk on
///         someone else's behalf.
contract DeskFactory {
    address public immutable implementation;

    mapping(address owner => address[] desks) private _desksOf;

    event DeskCreated(address indexed owner, address indexed desk, address operator);

    constructor() {
        implementation = address(new Desk());
    }

    function createDesk(Desk.Config calldata cfg, bytes32 salt) external returns (address desk) {
        desk = Clones.cloneDeterministic(implementation, _salt(msg.sender, salt));
        Desk(desk).initialize(msg.sender, cfg);
        _desksOf[msg.sender].push(desk);
        emit DeskCreated(msg.sender, desk, cfg.operator);
    }

    /// @notice The address a desk WILL have. Lets the app bridge money to it before it exists.
    function predictDesk(address owner, bytes32 salt) external view returns (address) {
        return Clones.predictDeterministicAddress(implementation, _salt(owner, salt), address(this));
    }

    function desksOf(address owner) external view returns (address[] memory) {
        return _desksOf[owner];
    }

    function _salt(address owner, bytes32 salt) private pure returns (bytes32) {
        return keccak256(abi.encode(owner, salt));
    }
}
