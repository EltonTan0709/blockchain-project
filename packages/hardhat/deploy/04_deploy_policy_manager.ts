import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const deployPolicyManager: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, ethers } = hre;
  const { deploy, get, log } = deployments;
  const { deployer } = await getNamedAccounts();

  const mockUSDC = await get("MockUSDC");
  const insurancePool = await get("InsurancePool");
  const oracleCoordinator = await get("OracleCoordinator");

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

  const automationTx = await oracleCoordinatorContract.setAutomationForwarder(deployer, {
    gasLimit: 100000,
  });
  await automationTx.wait();

  log(`OracleCoordinator automationForwarder set to ${deployer}`);

  const reporterTx = await oracleCoordinatorContract.setReporter(deployer, true, {
    gasLimit: 100000,
  });
  await reporterTx.wait();

  log(`OracleCoordinator reporter set to ${deployer}`);
};

export default deployPolicyManager;
deployPolicyManager.tags = ["PolicyManager"];
deployPolicyManager.dependencies = ["MockUSDC", "InsurancePool", "OracleCoordinator"];
