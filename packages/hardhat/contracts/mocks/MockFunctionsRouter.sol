// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IFunctionsClient} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/interfaces/IFunctionsClient.sol";

contract MockFunctionsRouter {
    uint256 private nextRequestNonce = 1;

    event MockRequestSent(
        bytes32 indexed requestId,
        address indexed sender,
        uint64 subscriptionId,
        uint32 callbackGasLimit,
        bytes32 indexed donId
    );

    function sendRequest(
        uint64 subscriptionId,
        bytes calldata,
        uint16,
        uint32 callbackGasLimit,
        bytes32 donId
    ) external returns (bytes32 requestId) {
        requestId = keccak256(abi.encode(msg.sender, subscriptionId, donId, nextRequestNonce++));

        emit MockRequestSent(requestId, msg.sender, subscriptionId, callbackGasLimit, donId);
    }

    function fulfillRequest(address consumer, bytes32 requestId, bytes calldata response, bytes calldata err) external {
        IFunctionsClient(consumer).handleOracleFulfillment(requestId, response, err);
    }
}
