// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./RoleManager.sol";

contract DisciplinaryRegistry {
    struct Sanction { address subject; string kind; string reason; uint64 startDate; uint64 endDate; uint64 ts; }
    RoleManager public roles; uint256 public count; mapping(uint256 => Sanction) public sanctions;
    event SanctionLogged(uint256 indexed id, address indexed subject, string kind, string reason, uint64 startDate, uint64 endDate, uint64 ts);

    constructor(RoleManager _roles){ roles = _roles; }
    function logSanction(address subject, string calldata kind, string calldata reason, uint64 startDate, uint64 endDate) external {
        require(roles.hasRole(roles.ADMIN_ROLE(), msg.sender), "NOT_ADMIN");
        uint256 id = ++count;
        sanctions[id] = Sanction(subject, kind, reason, startDate, endDate, uint64(block.timestamp));
        emit SanctionLogged(id, subject, kind, reason, startDate, endDate, uint64(block.timestamp));
    }
}
