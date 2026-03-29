import hre from "hardhat";

const getRequiredEnv = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Set ${name} before running this script.`);
  }

  return value;
};

async function main() {
  const subscriptionId = BigInt(getRequiredEnv("CHAINLINK_FUNCTIONS_SUBSCRIPTION_ID"));
  const callbackGasLimit = Number(process.env.CHAINLINK_FUNCTIONS_CALLBACK_GAS_LIMIT ?? "300000");
  const configuredDonId = getRequiredEnv("CHAINLINK_FUNCTIONS_DON_ID");
  const oracleApiBaseUrl = getRequiredEnv("CHAINLINK_ORACLE_API_BASE_URL");

  if (!Number.isFinite(callbackGasLimit) || callbackGasLimit <= 0) {
    throw new Error("CHAINLINK_FUNCTIONS_CALLBACK_GAS_LIMIT must be a positive integer.");
  }

  const normalizedDonId = configuredDonId.startsWith("0x")
    ? configuredDonId
    : hre.ethers.encodeBytes32String(configuredDonId);

  const { deployer } = await hre.getNamedAccounts();
  const deployerSigner = await hre.ethers.getSigner(deployer);
  const chainlinkDemoOracleConsumerDeployment = await hre.deployments.get("ChainlinkDemoOracleConsumer");
  const chainlinkDemoOracleConsumer = await hre.ethers.getContractAt(
    "ChainlinkDemoOracleConsumer",
    chainlinkDemoOracleConsumerDeployment.address,
  );

  const currentSubscriptionId = await chainlinkDemoOracleConsumer.subscriptionId();
  const currentCallbackGasLimit = await chainlinkDemoOracleConsumer.callbackGasLimit();
  const currentDonId = await chainlinkDemoOracleConsumer.donId();
  const currentOracleApiBaseUrl = await chainlinkDemoOracleConsumer.oracleApiBaseUrl();

  if (
    currentSubscriptionId === subscriptionId &&
    currentCallbackGasLimit === BigInt(callbackGasLimit) &&
    currentDonId.toLowerCase() === normalizedDonId.toLowerCase() &&
    currentOracleApiBaseUrl === oracleApiBaseUrl
  ) {
    console.log(`ChainlinkDemoOracleConsumer already configured at ${chainlinkDemoOracleConsumerDeployment.address}`);
    return;
  }

  const configTx = await chainlinkDemoOracleConsumer
    .connect(deployerSigner)
    .updateChainlinkConfig(subscriptionId, callbackGasLimit, normalizedDonId, oracleApiBaseUrl);
  await configTx.wait();

  console.log(`Configured ChainlinkDemoOracleConsumer at ${chainlinkDemoOracleConsumerDeployment.address}`);
  console.log(`Subscription ID: ${subscriptionId.toString()}`);
  console.log(`Callback gas limit: ${callbackGasLimit}`);
  console.log(`DON ID: ${configuredDonId}`);
  console.log(`Oracle API base URL: ${oracleApiBaseUrl}`);
  console.log(
    `Add ${chainlinkDemoOracleConsumerDeployment.address} as a consumer on subscription ${subscriptionId.toString()} if you have not done so yet.`,
  );
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
