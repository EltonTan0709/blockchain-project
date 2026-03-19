// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IInsurancePool {
    function receivePremium(address payer, uint256 amount) external;
}

contract PolicyManager is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    IERC20 public immutable stablecoin;
    address public insurancePool;

    uint256 public nextPolicyId;

    uint256 public constant MAX_FLIGHT_NUMBER_LENGTH = 20;

    enum PolicyType {
        FlightDelay,
        FlightCancellation
    }

    enum PolicyStatus {
        Active,
        Expired,
        Claimed,
        PaidOut
    }

    struct Policy {
        uint256 policyId;
        address holder;
        string flightNumber;
        uint256 purchaseTime;
        uint256 departureTimestamp;
        uint256 premium;
        uint256 coverageAmount;
        uint256 endTime;
        PolicyType policyType;
        PolicyStatus status;
    }

    mapping(uint256 => Policy) public policies;
    mapping(address => uint256[]) public userPolicies;

    event PolicyPurchased(
        uint256 indexed policyId,
        address indexed holder,
        string flightNumber,
        uint256 departureTimestamp,
        PolicyType policyType,
        uint256 premium,
        uint256 coverageAmount,
        uint256 purchaseTime,
        uint256 endTime
    );

    event InsurancePoolUpdated(address indexed newPool);

    constructor(address _stablecoin, address _insurancePool, address initialOwner) Ownable(initialOwner) {
        require(_stablecoin != address(0), "Invalid stablecoin address");
        require(_insurancePool != address(0), "Invalid pool address");
        require(initialOwner != address(0), "Invalid owner");

        stablecoin = IERC20(_stablecoin);
        insurancePool = _insurancePool;
        nextPolicyId = 1;
    }

    function setInsurancePool(address _insurancePool) external onlyOwner {
        require(_insurancePool != address(0), "Invalid pool address");
        insurancePool = _insurancePool;

        emit InsurancePoolUpdated(_insurancePool);
    }

    function buyPolicy(
        string calldata flightNumber,
        uint256 departureTimestamp,
        uint8 policyType,
        uint256 coverageAmount,
        uint256 duration,
        uint256 premium
    ) external nonReentrant whenNotPaused {
        require(bytes(flightNumber).length > 0, "Flight number required");
        require(bytes(flightNumber).length <= MAX_FLIGHT_NUMBER_LENGTH, "Flight number too long");
        require(departureTimestamp > block.timestamp, "Departure must be in future");
        require(policyType <= uint8(PolicyType.FlightCancellation), "Invalid policy type");
        require(coverageAmount > 0, "Coverage must be > 0");
        require(duration > 0, "Duration must be > 0");
        require(premium > 0, "Premium must be > 0");

        uint256 policyId = nextPolicyId;
        uint256 purchaseTime = block.timestamp;
        uint256 endTime = departureTimestamp + duration;

        stablecoin.safeTransferFrom(msg.sender, address(this), premium);
        stablecoin.safeTransfer(insurancePool, premium);

        IInsurancePool(insurancePool).receivePremium(msg.sender, premium);

        policies[policyId] = Policy({
            policyId: policyId,
            holder: msg.sender,
            flightNumber: flightNumber,
            purchaseTime: purchaseTime,
            departureTimestamp: departureTimestamp,
            premium: premium,
            coverageAmount: coverageAmount,
            endTime: endTime,
            policyType: PolicyType(policyType),
            status: PolicyStatus.Active
        });

        userPolicies[msg.sender].push(policyId);
        nextPolicyId++;

        emit PolicyPurchased(
            policyId,
            msg.sender,
            flightNumber,
            departureTimestamp,
            PolicyType(policyType),
            premium,
            coverageAmount,
            purchaseTime,
            endTime
        );
    }

    function getPolicy(uint256 policyId) external view returns (Policy memory) {
        return policies[policyId];
    }

    function getUserPolicies(address user) external view returns (uint256[] memory) {
        return userPolicies[user];
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
