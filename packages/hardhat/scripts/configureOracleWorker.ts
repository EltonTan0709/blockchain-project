import { isAddress } from "ethers";
import hre from "hardhat";

async function main() {
  const configuredWorkerAddress = process.env.ORACLE_AUTOMATION_ADDRESS?.trim();

  if (!configuredWorkerAddress || !isAddress(configuredWorkerAddress)) {
    throw new Error("Set ORACLE_AUTOMATION_ADDRESS to a valid worker wallet address before running this script.");
  }

  const { deployer } = await hre.getNamedAccounts();
  const oracleCoordinatorDeployment = await hre.deployments.get("OracleCoordinator");
  const chainlinkDemoOracleConsumerDeployment = await hre.deployments.get("ChainlinkDemoOracleConsumer");

  const oracleCoordinator = await hre.ethers.getContractAt("OracleCoordinator", oracleCoordinatorDeployment.address);
  const chainlinkDemoOracleConsumer = await hre.ethers.getContractAt(
    "ChainlinkDemoOracleConsumer",
    chainlinkDemoOracleConsumerDeployment.address,
  );
  const deployerSigner = await hre.ethers.getSigner(deployer);

  const currentAutomationForwarder = await oracleCoordinator.automationForwarder();
  if (currentAutomationForwarder.toLowerCase() !== configuredWorkerAddress.toLowerCase()) {
    const automationTx = await oracleCoordinator
      .connect(deployerSigner)
      .setAutomationForwarder(configuredWorkerAddress);
    await automationTx.wait();
    console.log(`Updated OracleCoordinator automationForwarder to ${configuredWorkerAddress}`);
  } else {
    console.log(`OracleCoordinator automationForwarder already set to ${configuredWorkerAddress}`);
  }

  const currentFunctionsRouter = await chainlinkDemoOracleConsumer.functionsRouter();
  if (currentFunctionsRouter.toLowerCase() !== configuredWorkerAddress.toLowerCase()) {
    const routerTx = await chainlinkDemoOracleConsumer
      .connect(deployerSigner)
      .setFunctionsRouter(configuredWorkerAddress);
    await routerTx.wait();
    console.log(`Updated ChainlinkDemoOracleConsumer functionsRouter to ${configuredWorkerAddress}`);
  } else {
    console.log(`ChainlinkDemoOracleConsumer functionsRouter already set to ${configuredWorkerAddress}`);
  }

  const deployerReporterStatus = await oracleCoordinator.reporters(deployer);
  if (deployerReporterStatus) {
    const revokeReporterTx = await oracleCoordinator.connect(deployerSigner).setReporter(deployer, false);
    await revokeReporterTx.wait();
    console.log(`Revoked direct reporter permission from owner ${deployer}`);
  } else {
    console.log(`Owner ${deployer} is not configured as a direct reporter`);
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
