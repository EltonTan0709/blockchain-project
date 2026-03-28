// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

interface IOraclePolicyManager {
    function canRequestOracleCheck(uint256 policyId) external view returns (bool);
    function resolvePolicyFromOracle(
        uint256 policyId,
        uint8 outcome,
        uint256 delayMinutes
    ) external returns (bool payoutExecuted, uint256 payoutAmount);
}

contract OracleCoordinator is Ownable, Pausable {
    enum FlightOutcome {
        Unknown,
        OnTime,
        Delayed,
        Cancelled
    }

    struct OracleRequest {
        uint256 requestId;
        uint256 policyId;
        uint256 requestedAt;
        uint256 fulfilledAt;
        bool pending;
        bool fulfilled;
        FlightOutcome outcome;
        uint256 delayMinutes;
        bool payoutExecuted;
        uint256 payoutAmount;
    }

    address public policyManager;
    address public automationForwarder;
    uint256 public nextRequestId = 1;

    mapping(address => bool) public reporters;
    mapping(uint256 => OracleRequest) public requestsByPolicyId;

    event PolicyManagerUpdated(address indexed newPolicyManager);
    event AutomationForwarderUpdated(address indexed newAutomationForwarder);
    event ReporterUpdated(address indexed reporter, bool isAuthorized);
    event OracleCheckRequested(uint256 indexed requestId, uint256 indexed policyId, address indexed requester);
    event OracleCheckFulfilled(
        uint256 indexed requestId,
        uint256 indexed policyId,
        FlightOutcome outcome,
        uint256 delayMinutes,
        bool payoutExecuted,
        uint256 payoutAmount,
        address reporter
    );

    modifier onlyAutomation() {
        require(
            msg.sender == owner() || (automationForwarder != address(0) && msg.sender == automationForwarder),
            "Not automation"
        );
        _;
    }

    modifier onlyReporter() {
        require(reporters[msg.sender], "Not authorized reporter");
        _;
    }

    constructor(address initialOwner) Ownable(initialOwner) {
        require(initialOwner != address(0), "Invalid owner");
    }

    function setPolicyManager(address newPolicyManager) external onlyOwner {
        require(newPolicyManager != address(0), "Invalid policy manager");
        policyManager = newPolicyManager;

        emit PolicyManagerUpdated(newPolicyManager);
    }

    function setAutomationForwarder(address newAutomationForwarder) external onlyOwner {
        automationForwarder = newAutomationForwarder;

        emit AutomationForwarderUpdated(newAutomationForwarder);
    }

    function setReporter(address reporter, bool isAuthorized) external onlyOwner {
        require(reporter != address(0), "Invalid reporter");
        reporters[reporter] = isAuthorized;

        emit ReporterUpdated(reporter, isAuthorized);
    }

    function checkUpkeep(bytes calldata checkData) external view returns (bool upkeepNeeded, bytes memory performData) {
        uint256 policyId = abi.decode(checkData, (uint256));
        OracleRequest memory request = requestsByPolicyId[policyId];
        bool hasOpenRequest = request.pending && !request.fulfilled;

        upkeepNeeded = policyManager != address(0) &&
            !hasOpenRequest &&
            IOraclePolicyManager(policyManager).canRequestOracleCheck(policyId);

        performData = abi.encode(policyId);
    }

    function performUpkeep(bytes calldata performData) external onlyAutomation whenNotPaused {
        uint256 policyId = abi.decode(performData, (uint256));
        requestOracleCheck(policyId);
    }

    function requestOracleCheck(uint256 policyId) public onlyAutomation whenNotPaused {
        require(policyManager != address(0), "Policy manager not set");
        require(IOraclePolicyManager(policyManager).canRequestOracleCheck(policyId), "Policy not ready");

        OracleRequest storage existingRequest = requestsByPolicyId[policyId];
        require(!(existingRequest.pending && !existingRequest.fulfilled), "Request already pending");

        uint256 requestId = nextRequestId++;
        requestsByPolicyId[policyId] = OracleRequest({
            requestId: requestId,
            policyId: policyId,
            requestedAt: block.timestamp,
            fulfilledAt: 0,
            pending: true,
            fulfilled: false,
            outcome: FlightOutcome.Unknown,
            delayMinutes: 0,
            payoutExecuted: false,
            payoutAmount: 0
        });

        emit OracleCheckRequested(requestId, policyId, msg.sender);
    }

    function fulfillOracleCheck(
        uint256 policyId,
        uint8 outcome,
        uint256 delayMinutes
    ) external onlyReporter whenNotPaused {
        require(policyManager != address(0), "Policy manager not set");
        require(outcome <= uint8(FlightOutcome.Cancelled), "Invalid outcome");

        OracleRequest storage request = requestsByPolicyId[policyId];
        require(request.requestId != 0, "Request not found");
        require(request.pending && !request.fulfilled, "Request not pending");

        (bool payoutExecuted, uint256 payoutAmount) = IOraclePolicyManager(policyManager).resolvePolicyFromOracle(
            policyId,
            outcome,
            delayMinutes
        );

        request.pending = false;
        request.fulfilled = true;
        request.fulfilledAt = block.timestamp;
        request.outcome = FlightOutcome(outcome);
        request.delayMinutes = delayMinutes;
        request.payoutExecuted = payoutExecuted;
        request.payoutAmount = payoutAmount;

        emit OracleCheckFulfilled(
            request.requestId,
            policyId,
            FlightOutcome(outcome),
            delayMinutes,
            payoutExecuted,
            payoutAmount,
            msg.sender
        );
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
