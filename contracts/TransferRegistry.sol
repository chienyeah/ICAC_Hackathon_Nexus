// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./RoleManager.sol";

contract TransferRegistry {
    struct Transfer {
        uint256 playerId;
        address fromClub;
        address toClub;
        uint256 feeWei;
        address agent;
        uint256 agentFeeWei;
        bytes32 docSha256;   // simple, verifiable on UI
        string  ipfsCid;     // optional: display / retrieval
        uint64  ts;
    }

    RoleManager public roles;
    uint256 public transferCount;
    mapping(uint256 => Transfer) public transfers;

    event TransferRecorded(
        uint256 indexed id,
        uint256 indexed playerId,
        address indexed fromClub,
        address toClub,
        uint256 feeWei,
        address agent,
        uint256 agentFeeWei,
        bytes32 docSha256,
        string ipfsCid,
        uint64 ts
    );

    constructor(RoleManager _roles) { roles = _roles; }

    modifier onlyClub() { require(roles.hasRole(roles.CLUB_ROLE(), msg.sender), "NOT_CLUB"); _; }

    function recordTransfer(
        uint256 playerId,
        address toClub,
        uint256 feeWei,
        address agent,
        uint256 agentFeeWei,
        bytes32 docSha256,
        string calldata ipfsCid
    ) external onlyClub returns (uint256 id) {
        id = ++transferCount;
        transfers[id] = Transfer({
            playerId: playerId,
            fromClub: msg.sender,
            toClub: toClub,
            feeWei: feeWei,
            agent: agent,
            agentFeeWei: agentFeeWei,
            docSha256: docSha256,
            ipfsCid: ipfsCid,
            ts: uint64(block.timestamp)
        });
        emit TransferRecorded(id, playerId, msg.sender, toClub, feeWei, agent, agentFeeWei, docSha256, ipfsCid, uint64(block.timestamp));
    }
}
