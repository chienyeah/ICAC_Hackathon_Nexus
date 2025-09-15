// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./RoleManager.sol";

contract SponsorshipRegistry {
    struct Sponsorship {
        address sponsor; address club;
        uint256 amountWei; bytes32 docSha256; string ipfsCid; uint64 ts;
    }
    RoleManager public roles; uint256 public count; mapping(uint256 => Sponsorship) public deals;
    event SponsorshipRegistered(uint256 indexed id, address indexed sponsor, address indexed club, uint256 amountWei, bytes32 docSha256, string ipfsCid, uint64 ts);

    constructor(RoleManager _roles){ roles = _roles; }
    function registerDeal(address club, uint256 amountWei, bytes32 docSha256, string calldata ipfsCid) external returns(uint256 id){
        require(roles.hasRole(roles.SPONSOR_ROLE(), msg.sender), "NOT_SPONSOR");
        id = ++count;
        deals[id] = Sponsorship(msg.sender, club, amountWei, docSha256, ipfsCid, uint64(block.timestamp));
        emit SponsorshipRegistered(id, msg.sender, club, amountWei, docSha256, ipfsCid, uint64(block.timestamp));
    }
}
