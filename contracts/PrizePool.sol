// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./RoleManager.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract PrizePool {
    struct Pool {
        address token;
        uint256 total;
        bool verified;
        address creator;
    }

    RoleManager public roles;
    uint256 public poolCount;
    mapping(uint256 => Pool) public pools;

    event PrizePoolCreated(uint256 indexed poolId, address token, uint256 total);
    event PrizeReleased(uint256 indexed poolId, address indexed to, uint256 amount);
    event ResultsVerified(uint256 indexed poolId);

    constructor(RoleManager _roles) { roles = _roles; }

    modifier onlyAdmin() { require(roles.hasRole(roles.ADMIN_ROLE(), msg.sender), "NOT_ADMIN"); _; }

    function createPool(address token, uint256 amount) external onlyAdmin returns (uint256 id) {
        id = ++poolCount;
        pools[id] = Pool({token: token, total: amount, verified: false, creator: msg.sender});
        require(IERC20(token).transferFrom(msg.sender, address(this), amount), "DEPOSIT_FAIL");
        emit PrizePoolCreated(id, token, amount);
    }

    function verifyResults(uint256 poolId) external onlyAdmin {
        pools[poolId].verified = true;
        emit ResultsVerified(poolId);
    }

    function release(uint256 poolId, address[] calldata winners, uint256[] calldata amounts) external onlyAdmin {
        require(pools[poolId].verified, "NOT_VERIFIED");
        require(winners.length == amounts.length, "LEN_MISMATCH");
        address t = pools[poolId].token;
        for (uint256 i = 0; i < winners.length; i++) {
            require(IERC20(t).transfer(winners[i], amounts[i]), "TRANSFER_FAIL");
            emit PrizeReleased(poolId, winners[i], amounts[i]);
        }
    }
}
