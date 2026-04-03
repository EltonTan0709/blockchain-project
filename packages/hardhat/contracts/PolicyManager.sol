// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IInsurancePool {
    function receivePremium(address payer, uint256 amount) external;
    function payOut(address recipient, uint256 amount) external;
}

contract PolicyManager is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    IERC20 public immutable stablecoin;
    address public insurancePool;
    address public oracleCoordinator;
    bool public demoOracleMode;
    uint256 public demoOracleDelaySeconds = 30;
    uint256 public totalActiveCoverageAmount;

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
        uint256 delayThresholdMinutes;
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
    event OracleCoordinatorUpdated(address indexed newCoordinator);
    event OracleEvaluationConfigUpdated(bool demoOracleMode, uint256 demoOracleDelaySeconds);
    event PolicyResolved(
        uint256 indexed policyId,
        address indexed holder,
        uint256 payoutAmount,
        bool payoutExecuted,
        uint8 oracleOutcome,
        uint256 delayMinutes
    );

    constructor(
        address _stablecoin,
        address _insurancePool,
        address _oracleCoordinator,
        address initialOwner
    ) Ownable(initialOwner) {
        require(_stablecoin != address(0), "Invalid stablecoin address");
        require(_insurancePool != address(0), "Invalid pool address");
        require(_oracleCoordinator != address(0), "Invalid oracle coordinator");
        require(initialOwner != address(0), "Invalid owner");

        stablecoin = IERC20(_stablecoin);
        insurancePool = _insurancePool;
        oracleCoordinator = _oracleCoordinator;
        nextPolicyId = 1;
    }

    function setInsurancePool(address _insurancePool) external onlyOwner {
        require(_insurancePool != address(0), "Invalid pool address");
        insurancePool = _insurancePool;

        emit InsurancePoolUpdated(_insurancePool);
    }

    function setOracleCoordinator(address _oracleCoordinator) external onlyOwner {
        require(_oracleCoordinator != address(0), "Invalid oracle coordinator");
        oracleCoordinator = _oracleCoordinator;

        emit OracleCoordinatorUpdated(_oracleCoordinator);
    }

    function setOracleEvaluationConfig(bool _demoOracleMode, uint256 _demoOracleDelaySeconds) external onlyOwner {
        if (_demoOracleMode) {
            require(_demoOracleDelaySeconds > 0, "Demo delay required");
        }

        demoOracleMode = _demoOracleMode;
        demoOracleDelaySeconds = _demoOracleDelaySeconds;

        emit OracleEvaluationConfigUpdated(_demoOracleMode, _demoOracleDelaySeconds);
    }

    function buyPolicy(
        string calldata flightNumber,
        uint256 departureTimestamp,
        uint8 policyType,
        uint256 coverageAmount,
        uint256 duration,
        uint256 delayThresholdMinutes,
        uint256 premium
    ) external nonReentrant whenNotPaused {
        require(bytes(flightNumber).length > 0, "Flight number required");
        require(bytes(flightNumber).length <= MAX_FLIGHT_NUMBER_LENGTH, "Flight number too long");
        require(departureTimestamp > block.timestamp, "Departure must be in future");
        require(policyType <= uint8(PolicyType.FlightCancellation), "Invalid policy type");
        require(coverageAmount > 0, "Coverage must be > 0");
        require(duration > 0, "Duration must be > 0");
        if (policyType == uint8(PolicyType.FlightDelay)) {
            require(delayThresholdMinutes > 0, "Delay threshold required");
        }
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
            delayThresholdMinutes: delayThresholdMinutes,
            policyType: PolicyType(policyType),
            status: PolicyStatus.Active
        });

        totalActiveCoverageAmount += coverageAmount;
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

    function getOracleReadyTimestamp(uint256 policyId) external view returns (uint256) {
        Policy memory policy = policies[policyId];
        require(policy.policyId != 0, "Policy not found");

        return _getOracleReadyTimestamp(policy);
    }

    function canRequestOracleCheck(uint256 policyId) external view returns (bool) {
        Policy memory policy = policies[policyId];
        return
            oracleCoordinator != address(0) &&
            policy.policyId != 0 &&
            policy.status == PolicyStatus.Active &&
            block.timestamp >= _getOracleReadyTimestamp(policy);
    }

    function resolvePolicyFromOracle(
        uint256 policyId,
        uint8 outcome,
        uint256 delayMinutes
    ) external nonReentrant whenNotPaused returns (bool payoutExecuted, uint256 payoutAmount) {
        require(msg.sender == oracleCoordinator, "Not oracle coordinator");

        Policy storage policy = policies[policyId];
        require(policy.policyId != 0, "Policy not found");
        require(policy.status == PolicyStatus.Active, "Policy not active");
        require(block.timestamp >= _getOracleReadyTimestamp(policy), "Oracle check not ready");

        bool eligibleForPayout = _isEligibleForPayout(policy, outcome, delayMinutes);
        uint256 coverageAmount = policy.coverageAmount;
        totalActiveCoverageAmount -= coverageAmount;

        if (!eligibleForPayout) {
            policy.status = PolicyStatus.Expired;
            emit PolicyResolved(policyId, policy.holder, 0, false, outcome, delayMinutes);
            return (false, 0);
        }

        policy.status = PolicyStatus.PaidOut;
        IInsurancePool(insurancePool).payOut(policy.holder, coverageAmount);

        emit PolicyResolved(policyId, policy.holder, coverageAmount, true, outcome, delayMinutes);
        return (true, coverageAmount);
    }

    function getFlightKey(string memory flightNumber, uint256 departureTimestamp) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(flightNumber, departureTimestamp));
    }

    function _isEligibleForPayout(Policy memory policy, uint8 outcome, uint256 delayMinutes) internal pure returns (bool) {
        if (policy.policyType == PolicyType.FlightDelay) {
            return outcome == 2 && delayMinutes >= policy.delayThresholdMinutes;
        }

        if (policy.policyType == PolicyType.FlightCancellation) {
            return outcome == 3;
        }

        return false;
    }

    function _getOracleReadyTimestamp(Policy memory policy) internal view returns (uint256) {
        if (demoOracleMode) {
            return policy.purchaseTime + demoOracleDelaySeconds;
        }

        return policy.departureTimestamp;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
