import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const deployPolicyManager: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, ethers } = hre;
  const { deploy, get, log } = deployments;
  const { deployer } = await getNamedAccounts();
  const demoOracleMode = process.env.ORACLE_DEMO_MODE === "true";
  const demoOracleDelaySeconds = Number(process.env.ORACLE_DEMO_DELAY_SECONDS ?? "30");
  const oracleAutomationAddress = process.env.ORACLE_AUTOMATION_ADDRESS?.trim() || deployer;
  const chainlinkFunctionsRouter = process.env.CHAINLINK_FUNCTIONS_ROUTER?.trim() || oracleAutomationAddress;
  const chainlinkSubscriptionId = process.env.CHAINLINK_FUNCTIONS_SUBSCRIPTION_ID?.trim();
  const chainlinkCallbackGasLimit = Number(process.env.CHAINLINK_FUNCTIONS_CALLBACK_GAS_LIMIT ?? "300000");
  const configuredDonId = process.env.CHAINLINK_FUNCTIONS_DON_ID?.trim();
  const chainlinkOracleApiBaseUrl = process.env.CHAINLINK_ORACLE_API_BASE_URL?.trim();

  const mockUSDC = await get("MockUSDC");
  const insurancePool = await get("InsurancePool");
  const oracleCoordinator = await get("OracleCoordinator");
  const chainlinkDemoOracleConsumer = await deploy("ChainlinkDemoOracleConsumer", {
    from: deployer,
    args: [oracleCoordinator.address, deployer, chainlinkFunctionsRouter],
    log: true,
    autoMine: true,
  });

  const policyManager = await deploy("PolicyManager", {
    from: deployer,
    args: [mockUSDC.address, insurancePool.address, oracleCoordinator.address, deployer],
    log: true,
    autoMine: true,
  });

  log(`PolicyManager deployed at ${policyManager.address}`);

  const insurancePoolContract = await ethers.getContractAt("InsurancePool", insurancePool.address);
  const tx = await insurancePoolContract.setPolicyManager(policyManager.address, {
    gasLimit: 100000,
  });
  await tx.wait();

  log(`InsurancePool policyManager set to ${policyManager.address}`);

  const oracleCoordinatorContract = await ethers.getContractAt("OracleCoordinator", oracleCoordinator.address);
  const oracleTx = await oracleCoordinatorContract.setPolicyManager(policyManager.address, {
    gasLimit: 100000,
  });
  await oracleTx.wait();

  log(`OracleCoordinator policyManager set to ${policyManager.address}`);

  const consumerTx = await oracleCoordinatorContract.setOracleCallbackConsumer(chainlinkDemoOracleConsumer.address, {
    gasLimit: 100000,
  });
  await consumerTx.wait();

  log(`OracleCoordinator oracleCallbackConsumer set to ${chainlinkDemoOracleConsumer.address}`);

  const automationTx = await oracleCoordinatorContract.setAutomationForwarder(oracleAutomationAddress, {
    gasLimit: 100000,
  });
  await automationTx.wait();

  log(`OracleCoordinator automationForwarder set to ${oracleAutomationAddress}`);

  const chainlinkDemoOracleConsumerContract = await ethers.getContractAt(
    "ChainlinkDemoOracleConsumer",
    chainlinkDemoOracleConsumer.address,
  );
  const functionsRouterTx = await chainlinkDemoOracleConsumerContract.setFunctionsRouter(oracleAutomationAddress, {
    gasLimit: 100000,
  });
  await functionsRouterTx.wait();

  log(`ChainlinkDemoOracleConsumer functionsRouter set to ${oracleAutomationAddress}`);

  if (chainlinkSubscriptionId && configuredDonId && chainlinkOracleApiBaseUrl) {
    const normalizedDonId = configuredDonId.startsWith("0x")
      ? configuredDonId
      : ethers.encodeBytes32String(configuredDonId);

    const chainlinkConfigTx = await chainlinkDemoOracleConsumerContract.updateChainlinkConfig(
      BigInt(chainlinkSubscriptionId),
      chainlinkCallbackGasLimit,
      normalizedDonId,
      chainlinkOracleApiBaseUrl,
      {
        gasLimit: 300000,
      },
    );
    await chainlinkConfigTx.wait();

    log(
      `ChainlinkDemoOracleConsumer configured for subscription ${chainlinkSubscriptionId} at ${chainlinkOracleApiBaseUrl}`,
    );
  }

  if (demoOracleMode) {
    const policyManagerContract = await ethers.getContractAt("PolicyManager", policyManager.address);
    const oracleTimingTx = await policyManagerContract.setOracleEvaluationConfig(true, demoOracleDelaySeconds, {
      gasLimit: 100000,
    });
    await oracleTimingTx.wait();

    log(`PolicyManager demo oracle timing enabled with ${demoOracleDelaySeconds} second delay`);
  }
};

export default deployPolicyManager;
deployPolicyManager.tags = ["PolicyManager"];
deployPolicyManager.dependencies = ["MockUSDC", "InsurancePool", "OracleCoordinator"];
