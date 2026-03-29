// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/Pausable.sol";
import {ConfirmedOwner} from "@chainlink/contracts/src/v0.8/shared/access/ConfirmedOwner.sol";
import {FunctionsClient} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/FunctionsClient.sol";
import {FunctionsRequest} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/libraries/FunctionsRequest.sol";

interface IOracleCoordinatorConsumerTarget {
    function fulfillOracleCheck(uint256 policyId, uint8 outcome, uint256 delayMinutes) external;
}

contract ChainlinkDemoOracleConsumer is FunctionsClient, ConfirmedOwner, Pausable {
    using FunctionsRequest for FunctionsRequest.Request;

    string internal constant ORACLE_DECISION_SOURCE =
        "const policyId = args[0];"
        "const apiBaseUrl = args[1];"
        "if (!policyId || !apiBaseUrl) { throw Error('Missing policyId or apiBaseUrl'); }"
        "const apiResponse = await Functions.makeHttpRequest({"
        "url: `${apiBaseUrl}/api/oracle/functions/${policyId}`,"
        "method: 'GET',"
        "headers: { Accept: 'application/json' }"
        "});"
        "if (apiResponse.error) { throw Error(`Oracle API request failed: ${apiResponse.error}`); }"
        "const payload = apiResponse.data;"
        "if (!payload || typeof payload.outcome !== 'number' || typeof payload.delayMinutes !== 'number') {"
        "throw Error('Oracle API response missing numeric outcome or delayMinutes');"
        "}"
        "const encodedOutcome = Functions.encodeUint256(BigInt(payload.outcome));"
        "const encodedDelay = Functions.encodeUint256(BigInt(payload.delayMinutes));"
        "const combined = new Uint8Array(encodedOutcome.length + encodedDelay.length);"
        "combined.set(encodedOutcome, 0);"
        "combined.set(encodedDelay, encodedOutcome.length);"
        "return combined;";

    address public immutable oracleCoordinator;
    address public functionsRouter;
    uint64 public subscriptionId;
    uint32 public callbackGasLimit;
    bytes32 public donId;
    string public oracleApiBaseUrl;
    bytes32 public lastRequestId;
    bytes public lastResponse;
    bytes public lastError;

    mapping(bytes32 => uint256) public policyIdByChainlinkRequestId;
    mapping(uint256 => bytes32) public activeChainlinkRequestIdByPolicyId;

    event FunctionsRouterUpdated(address indexed newFunctionsRouter);
    event ChainlinkConfigUpdated(
        uint64 indexed subscriptionId,
        uint32 callbackGasLimit,
        bytes32 indexed donId,
        string oracleApiBaseUrl
    );
    event PolicyEvaluationRequested(bytes32 indexed chainlinkRequestId, uint256 indexed policyId, string requestUrl);
    event PolicyEvaluationFulfilled(
        bytes32 indexed chainlinkRequestId,
        uint256 indexed policyId,
        uint8 outcome,
        uint256 delayMinutes,
        address indexed caller
    );
    event PolicyEvaluationFailed(bytes32 indexed chainlinkRequestId, uint256 indexed policyId, bytes err);
    event ConsensusResultSubmitted(uint256 indexed policyId, uint8 outcome, uint256 delayMinutes, address indexed caller);

    error InvalidChainlinkRouter();
    error InvalidFunctionsRouter();
    error InvalidSubscriptionId();
    error InvalidCallbackGasLimit();
    error InvalidDonId();
    error EmptyOracleApiBaseUrl();
    error InvalidPolicyId();
    error PolicyEvaluationAlreadyRequested(uint256 policyId);
    error UnexpectedRequestID(bytes32 requestId);
    error InvalidOracleOutcome(uint256 outcome);

    modifier onlyCallbackExecutor() {
        require(functionsRouter != address(0) && msg.sender == functionsRouter, "Not callback executor");
        _;
    }

    modifier onlyRequestInitiator() {
        require(msg.sender == owner() || msg.sender == functionsRouter, "Not request initiator");
        _;
    }

    constructor(
        address _oracleCoordinator,
        address initialOwner,
        address chainlinkRouter
    ) FunctionsClient(chainlinkRouter) ConfirmedOwner(initialOwner) {
        require(_oracleCoordinator != address(0), "Invalid oracle coordinator");
        if (chainlinkRouter == address(0)) {
            revert InvalidChainlinkRouter();
        }

        oracleCoordinator = _oracleCoordinator;
    }

    function setFunctionsRouter(address newFunctionsRouter) external onlyOwner {
        if (newFunctionsRouter == address(0)) {
            revert InvalidFunctionsRouter();
        }

        functionsRouter = newFunctionsRouter;
        emit FunctionsRouterUpdated(newFunctionsRouter);
    }

    function updateChainlinkConfig(
        uint64 newSubscriptionId,
        uint32 newCallbackGasLimit,
        bytes32 newDonId,
        string calldata newOracleApiBaseUrl
    ) external onlyOwner {
        if (newSubscriptionId == 0) {
            revert InvalidSubscriptionId();
        }
        if (newCallbackGasLimit == 0) {
            revert InvalidCallbackGasLimit();
        }
        if (newDonId == bytes32(0)) {
            revert InvalidDonId();
        }
        if (bytes(newOracleApiBaseUrl).length == 0) {
            revert EmptyOracleApiBaseUrl();
        }

        subscriptionId = newSubscriptionId;
        callbackGasLimit = newCallbackGasLimit;
        donId = newDonId;
        oracleApiBaseUrl = newOracleApiBaseUrl;

        emit ChainlinkConfigUpdated(newSubscriptionId, newCallbackGasLimit, newDonId, newOracleApiBaseUrl);
    }

    function getChainlinkRouter() external view returns (address) {
        return address(i_router);
    }

    function requestPolicyEvaluation(uint256 policyId) external onlyRequestInitiator whenNotPaused returns (bytes32) {
        if (policyId == 0) {
            revert InvalidPolicyId();
        }
        if (subscriptionId == 0) {
            revert InvalidSubscriptionId();
        }
        if (callbackGasLimit == 0) {
            revert InvalidCallbackGasLimit();
        }
        if (donId == bytes32(0)) {
            revert InvalidDonId();
        }
        if (bytes(oracleApiBaseUrl).length == 0) {
            revert EmptyOracleApiBaseUrl();
        }
        if (activeChainlinkRequestIdByPolicyId[policyId] != bytes32(0)) {
            revert PolicyEvaluationAlreadyRequested(policyId);
        }

        FunctionsRequest.Request memory req;
        req.initializeRequestForInlineJavaScript(ORACLE_DECISION_SOURCE);

        string[] memory args = new string[](2);
        args[0] = _toString(policyId);
        args[1] = oracleApiBaseUrl;
        req.setArgs(args);

        bytes32 chainlinkRequestId = _sendRequest(req.encodeCBOR(), subscriptionId, callbackGasLimit, donId);
        policyIdByChainlinkRequestId[chainlinkRequestId] = policyId;
        activeChainlinkRequestIdByPolicyId[policyId] = chainlinkRequestId;
        lastRequestId = chainlinkRequestId;

        emit PolicyEvaluationRequested(
            chainlinkRequestId,
            policyId,
            string.concat(oracleApiBaseUrl, "/api/oracle/functions/", _toString(policyId))
        );

        return chainlinkRequestId;
    }

    function submitConsensusResult(
        uint256 policyId,
        uint8 outcome,
        uint256 delayMinutes
    ) external onlyCallbackExecutor whenNotPaused {
        IOracleCoordinatorConsumerTarget(oracleCoordinator).fulfillOracleCheck(policyId, outcome, delayMinutes);

        emit ConsensusResultSubmitted(policyId, outcome, delayMinutes, msg.sender);
    }

    function fulfillRequest(bytes32 requestId, bytes memory response, bytes memory err) internal override {
        uint256 policyId = policyIdByChainlinkRequestId[requestId];
        if (policyId == 0) {
            revert UnexpectedRequestID(requestId);
        }

        lastRequestId = requestId;
        lastResponse = response;
        lastError = err;

        delete policyIdByChainlinkRequestId[requestId];
        delete activeChainlinkRequestIdByPolicyId[policyId];

        if (err.length > 0) {
            emit PolicyEvaluationFailed(requestId, policyId, err);
            return;
        }

        (uint256 outcome, uint256 delayMinutes) = abi.decode(response, (uint256, uint256));
        if (outcome > uint256(type(uint8).max) || outcome > 3) {
            revert InvalidOracleOutcome(outcome);
        }

        IOracleCoordinatorConsumerTarget(oracleCoordinator).fulfillOracleCheck(policyId, uint8(outcome), delayMinutes);

        emit PolicyEvaluationFulfilled(requestId, policyId, uint8(outcome), delayMinutes, msg.sender);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }

        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }

        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + value % 10));
            value /= 10;
        }

        return string(buffer);
    }
}
