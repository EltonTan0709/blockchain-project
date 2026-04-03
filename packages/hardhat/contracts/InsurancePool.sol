// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

interface IPolicyReserveSource {
    function totalActiveCoverageAmount() external view returns (uint256);
}

contract InsurancePool is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    IERC20 public immutable stablecoin;
    uint256 public totalLiquidity;
    uint256 public totalPremiumsCollected;
    uint256 public totalPayouts;

    address public policyManager;

    mapping(address => uint256) public liquidityProvided;

    event LiquidityDeposited(address indexed provider, uint256 amount);
    event LiquidityWithdrawn(address indexed recipient, uint256 amount, uint256 requiredReserve, uint256 poolBalance);
    event PolicyManagerSet(address indexed policyManager);
    event PremiumReceived(address indexed payer, uint256 amount);
    event PayoutExecuted(address indexed recipient, uint256 amount);

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

        stablecoin.safeTransferFrom(msg.sender, address(this), amount);

        liquidityProvided[msg.sender] += amount;
        totalLiquidity += amount;

        emit LiquidityDeposited(msg.sender, amount);
    }

    function withdrawExcessLiquidity(uint256 amount) external onlyOwner nonReentrant whenNotPaused {
        require(amount > 0, "Amount must be > 0");

        uint256 withdrawableAmount = getWithdrawableAmount();
        require(amount <= withdrawableAmount, "Amount exceeds withdrawable balance");

        uint256 providerBalance = liquidityProvided[msg.sender];
        if (providerBalance != 0) {
            uint256 providerReduction = amount > providerBalance ? providerBalance : amount;
            liquidityProvided[msg.sender] = providerBalance - providerReduction;
        }

        if (totalLiquidity != 0) {
            uint256 liquidityReduction = amount > totalLiquidity ? totalLiquidity : amount;
            totalLiquidity -= liquidityReduction;
        }

        stablecoin.safeTransfer(msg.sender, amount);

        emit LiquidityWithdrawn(msg.sender, amount, getRequiredReserve(), stablecoin.balanceOf(address(this)));
    }

    function receivePremium(address payer, uint256 amount) external onlyPolicyManager whenNotPaused {
        require(payer != address(0), "Invalid payer");
        require(amount > 0, "Amount must be > 0");

        totalPremiumsCollected += amount;

        emit PremiumReceived(payer, amount);
    }

    function payOut(address recipient, uint256 amount) external onlyPolicyManager nonReentrant whenNotPaused {
        require(recipient != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be > 0");
        require(stablecoin.balanceOf(address(this)) >= amount, "Insufficient pool balance");

        totalPayouts += amount;
        stablecoin.safeTransfer(recipient, amount);

        emit PayoutExecuted(recipient, amount);
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

    function getRequiredReserve() public view returns (uint256) {
        if (policyManager == address(0)) {
            return 0;
        }

        return IPolicyReserveSource(policyManager).totalActiveCoverageAmount();
    }

    function getWithdrawableAmount() public view returns (uint256) {
        uint256 poolBalance = stablecoin.balanceOf(address(this));
        uint256 requiredReserve = getRequiredReserve();

        return poolBalance > requiredReserve ? poolBalance - requiredReserve : 0;
    }
}
