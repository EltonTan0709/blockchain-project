import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const deployOracleCoordinator: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  await deploy("OracleCoordinator", {
    from: deployer,
    args: [deployer],
    log: true,
    autoMine: true,
  });
};

export default deployOracleCoordinator;

deployOracleCoordinator.tags = ["OracleCoordinator"];
