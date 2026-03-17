// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract InsurancePool is Ownable {
    IERC20 public immutable stablecoin;
    uint256 public totalLiquidity;

    mapping(address => uint256) public liquidityProvided;

    event LiquidityDeposited(address indexed provider, uint256 amount);

    constructor(address _stablecoin, address initialOwner) Ownable(initialOwner) {
        stablecoin = IERC20(_stablecoin);
    }

    function depositLiquidity(uint256 amount) external {
        require(amount > 0, "Amount must be > 0");

        bool success = stablecoin.transferFrom(msg.sender, address(this), amount);
        require(success, "Transfer failed");

        liquidityProvided[msg.sender] += amount;
        totalLiquidity += amount;

        emit LiquidityDeposited(msg.sender, amount);
    }

    function getPoolBalance() external view returns (uint256) {
        return stablecoin.balanceOf(address(this));
    }
}
