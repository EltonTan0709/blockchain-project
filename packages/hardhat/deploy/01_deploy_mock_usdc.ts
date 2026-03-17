import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const deployMockUSDC: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  await deploy("MockUSDC", {
    from: deployer,
    args: [deployer],
    log: true,
    autoMine: true,
  });
};

export default deployMockUSDC;

deployMockUSDC.tags = ["MockUSDC"];
