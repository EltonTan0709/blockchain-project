import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const deployInsurancePool: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy, get } = hre.deployments;

  const mockUSDC = await get("MockUSDC");

  await deploy("InsurancePool", {
    from: deployer,
    args: [mockUSDC.address, deployer],
    log: true,
    autoMine: true,
  });
};

export default deployInsurancePool;

deployInsurancePool.tags = ["InsurancePool"];
