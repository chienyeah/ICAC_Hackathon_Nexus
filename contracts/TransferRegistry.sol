// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract TransferRegistry is AccessControl {
    bytes32 public constant CLUB_ROLE = keccak256("CLUB_ROLE");

    struct Transfer {
        uint256 id;
        uint256 playerId;
        address fromClub;
        address toClub;
        uint256 feeWei;
        address agent;
        uint256 agentFeeWei;
        bytes32 docSha256;
        string ipfsCid;
        uint256 ts;
    }

    // 👇 expose a public getter (indexer may call this)
    uint256 public lastId;

    // 👇 expose mapping getter or add an explicit view function
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
        string ipfsCid
    );

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(CLUB_ROLE, admin);
    }

    function recordTransfer(
        uint256 playerId,
        address toClub,
        uint256 feeWei,
        address agent,
        uint256 agentFeeWei,
        bytes32 docSha256,
        string memory ipfsCid
    ) external onlyRole(CLUB_ROLE) returns (uint256 id) {
        id = ++lastId;
        transfers[id] = Transfer({
            id: id,
            playerId: playerId,
            fromClub: msg.sender,
            toClub: toClub,
            feeWei: feeWei,
            agent: agent,
            agentFeeWei: agentFeeWei,
            docSha256: docSha256,
            ipfsCid: ipfsCid,
            ts: block.timestamp
        });

        emit TransferRecorded(
            id, playerId, msg.sender, toClub, feeWei, agent, agentFeeWei, docSha256, ipfsCid
        );
    }

    // If your indexer expects an explicit getter, keep this too:
    function getTransfer(uint256 id) external view returns (Transfer memory) {
        return transfers[id];
    }
}
