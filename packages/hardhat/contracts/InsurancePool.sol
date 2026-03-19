// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract InsurancePool is Ownable, ReentrancyGuard, Pausable {
    IERC20 public immutable stablecoin;
    uint256 public totalLiquidity;
    uint256 public totalPremiumsCollected;

    address public policyManager;

    mapping(address => uint256) public liquidityProvided;

    event LiquidityDeposited(address indexed provider, uint256 amount);
    event PolicyManagerSet(address indexed policyManager);
    event PremiumReceived(address indexed payer, uint256 amount);

    modifier onlyPolicyManager() {
        require(msg.sender == policyManager, "Not policy manager");
        _;
    }

    constructor(address _stablecoin, address initialOwner) Ownable(initialOwner) {
        require(_stablecoin != address(0), "Invalid stablecoin address");
        require(initialOwner != address(0), "Invalid owner");

        stablecoin = IERC20(_stablecoin);
    }

    function setPolicyManager(address _policyManager) external onlyOwner {
        require(_policyManager != address(0), "Invalid policy manager");
        policyManager = _policyManager;

        emit PolicyManagerSet(_policyManager);
    }

    function depositLiquidity(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "Amount must be > 0");

        bool success = stablecoin.transferFrom(msg.sender, address(this), amount);
        require(success, "Transfer failed");

        liquidityProvided[msg.sender] += amount;
        totalLiquidity += amount;

        emit LiquidityDeposited(msg.sender, amount);
    }

    function receivePremium(address payer, uint256 amount) external onlyPolicyManager whenNotPaused {
        require(payer != address(0), "Invalid payer");
        require(amount > 0, "Amount must be > 0");

        totalPremiumsCollected += amount;

        emit PremiumReceived(payer, amount);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function getPoolBalance() external view returns (uint256) {
        return stablecoin.balanceOf(address(this));
    }
}