import { expect } from "chai";
import { ethers } from "hardhat";
import { GAS_BENCHMARKS } from "../../nextjs/lib/performanceBenchmarks";

const FIXED_GAS_PRICE = ethers.parseUnits("20", "gwei");

const expectGasBudget = (gasUsed: bigint, budget: bigint, label: string) => {
  expect(gasUsed, `${label} exceeded the gas budget of ${budget.toString()} units`).to.be.lessThan(budget);
};

const expectEthCostBudget = (gasUsed: bigint, maxCostWei: bigint, label: string) => {
  const estimatedCostWei = gasUsed * FIXED_GAS_PRICE;
  expect(estimatedCostWei, `${label} exceeded the fixed 20 gwei cost budget`).to.be.lessThan(maxCostWei);
};

describe("Oracle coordinator workflow", function () {
  async function deployFixture() {
    const [owner, liquidityProvider, traveler, oracleReporter, automationForwarder, simulatedFunctionsRouter] =
      await ethers.getSigners();

    const mockUSDCFactory = (await ethers.getContractFactory("MockUSDC")) as any;
    const mockUSDC = await mockUSDCFactory.deploy(owner.address);
    await mockUSDC.waitForDeployment();

    const insurancePoolFactory = (await ethers.getContractFactory("InsurancePool")) as any;
    const insurancePool = await insurancePoolFactory.deploy(await mockUSDC.getAddress(), owner.address);
    await insurancePool.waitForDeployment();

    const oracleCoordinatorFactory = (await ethers.getContractFactory("OracleCoordinator")) as any;
    const oracleCoordinator = await oracleCoordinatorFactory.deploy(owner.address);
    await oracleCoordinator.waitForDeployment();

    const mockFunctionsRouterFactory = (await ethers.getContractFactory("MockFunctionsRouter")) as any;
    const mockFunctionsRouter = await mockFunctionsRouterFactory.deploy();
    await mockFunctionsRouter.waitForDeployment();

    const chainlinkDemoOracleConsumerFactory = (await ethers.getContractFactory("ChainlinkDemoOracleConsumer")) as any;
    const chainlinkDemoOracleConsumer = await chainlinkDemoOracleConsumerFactory.deploy(
      await oracleCoordinator.getAddress(),
      owner.address,
      await mockFunctionsRouter.getAddress(),
    );
    await chainlinkDemoOracleConsumer.waitForDeployment();

    const policyManagerFactory = (await ethers.getContractFactory("PolicyManager")) as any;
    const policyManager = (await policyManagerFactory.deploy(
      await mockUSDC.getAddress(),
      await insurancePool.getAddress(),
      await oracleCoordinator.getAddress(),
      owner.address,
    )) as any;
    await policyManager.waitForDeployment();

    const oracleCoordinatorContract = oracleCoordinator as any;
    const insurancePoolContract = insurancePool as any;

    await insurancePoolContract.setPolicyManager(await policyManager.getAddress());
    await oracleCoordinatorContract.setPolicyManager(await policyManager.getAddress());
    await oracleCoordinatorContract.setAutomationForwarder(automationForwarder.address);
    await oracleCoordinatorContract.setOracleCallbackConsumer(await chainlinkDemoOracleConsumer.getAddress());
    await chainlinkDemoOracleConsumer.setFunctionsRouter(simulatedFunctionsRouter.address);
    await oracleCoordinatorContract.setReporter(oracleReporter.address, true);

    await mockUSDC.mint(liquidityProvider.address, 5_000);
    await mockUSDC.mint(traveler.address, 500);

    await mockUSDC.connect(liquidityProvider).approve(await insurancePool.getAddress(), 5_000_000_000);
    await insurancePool.connect(liquidityProvider).depositLiquidity(5_000_000_000);

    await mockUSDC.connect(traveler).approve(await policyManager.getAddress(), 500_000_000);

    return {
      owner,
      liquidityProvider,
      traveler,
      oracleReporter,
      automationForwarder,
      simulatedFunctionsRouter,
      mockFunctionsRouter,
      mockUSDC,
      insurancePool: insurancePoolContract,
      oracleCoordinator: oracleCoordinatorContract,
      chainlinkDemoOracleConsumer,
      policyManager,
    };
  }

  it("requests and fulfills a delayed-flight payout through the coordinator", async function () {
    const { traveler, oracleReporter, automationForwarder, mockUSDC, insurancePool, oracleCoordinator, policyManager } =
      await deployFixture();

    const latestBlock = await ethers.provider.getBlock("latest");
    const departureTimestamp = BigInt(latestBlock!.timestamp + 3600);

    await policyManager
      .connect(traveler)
      .buyPolicy("SQ318", departureTimestamp, 0, 200_000_000, 24 * 3600, 360, 10_000_000);

    await ethers.provider.send("evm_setNextBlockTimestamp", [Number(departureTimestamp + 5n)]);
    await ethers.provider.send("evm_mine", []);

    await expect(
      oracleCoordinator
        .connect(automationForwarder)
        .performUpkeep(ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [1n])),
    ).to.emit(oracleCoordinator, "OracleCheckRequested");

    const travelerBalanceBefore = await mockUSDC.balanceOf(traveler.address);

    await expect(oracleCoordinator.connect(oracleReporter).fulfillOracleCheck(1, 2, 420))
      .to.emit(oracleCoordinator, "OracleCheckFulfilled")
      .withArgs(1n, 1n, 2n, 420n, true, 200_000_000n, oracleReporter.address);

    expect(await mockUSDC.balanceOf(traveler.address)).to.equal(travelerBalanceBefore + 200_000_000n);
    expect(await insurancePool.totalPayouts()).to.equal(200_000_000n);
  });

  it("allows the owner to withdraw only excess liquidity above active policy reserve", async function () {
    const { owner, traveler, mockUSDC, insurancePool, policyManager } = await deployFixture();

    const latestBlock = await ethers.provider.getBlock("latest");
    const departureTimestamp = BigInt(latestBlock!.timestamp + 3600);

    await policyManager
      .connect(traveler)
      .buyPolicy("SQ318", departureTimestamp, 0, 200_000_000, 24 * 3600, 360, 10_000_000);

    expect(await policyManager.totalActiveCoverageAmount()).to.equal(200_000_000n);
    expect(await insurancePool.getRequiredReserve()).to.equal(200_000_000n);
    expect(await insurancePool.getWithdrawableAmount()).to.equal(4_810_000_000n);

    const ownerBalanceBefore = await mockUSDC.balanceOf(owner.address);
    await insurancePool.connect(owner).withdrawExcessLiquidity(4_810_000_000n);

    expect(await mockUSDC.balanceOf(owner.address)).to.equal(ownerBalanceBefore + 4_810_000_000n);
    expect(await insurancePool.getPoolBalance()).to.equal(200_000_000n);
    expect(await insurancePool.getWithdrawableAmount()).to.equal(0n);

    await expect(insurancePool.connect(owner).withdrawExcessLiquidity(1)).to.be.revertedWith(
      "Amount exceeds withdrawable balance",
    );
  });

  it("does not pay out when the delay is below the purchased threshold", async function () {
    const { traveler, oracleReporter, automationForwarder, mockUSDC, oracleCoordinator, policyManager } =
      await deployFixture();

    const latestBlock = await ethers.provider.getBlock("latest");
    const departureTimestamp = BigInt(latestBlock!.timestamp + 1800);

    await policyManager
      .connect(traveler)
      .buyPolicy("BA12", departureTimestamp, 0, 150_000_000, 12 * 3600, 720, 8_000_000);

    await ethers.provider.send("evm_setNextBlockTimestamp", [Number(departureTimestamp + 2n)]);
    await ethers.provider.send("evm_mine", []);

    await oracleCoordinator
      .connect(automationForwarder)
      .performUpkeep(ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [1n]));

    const travelerBalanceBefore = await mockUSDC.balanceOf(traveler.address);
    await oracleCoordinator.connect(oracleReporter).fulfillOracleCheck(1, 2, 180);

    expect(await mockUSDC.balanceOf(traveler.address)).to.equal(travelerBalanceBefore);

    const policy = await policyManager.getPolicy(1);
    expect(policy.status).to.equal(1n);
  });

  it("releases reserved coverage after a no-payout oracle resolution", async function () {
    const { traveler, oracleReporter, automationForwarder, insurancePool, oracleCoordinator, policyManager } =
      await deployFixture();

    const latestBlock = await ethers.provider.getBlock("latest");
    const departureTimestamp = BigInt(latestBlock!.timestamp + 1800);

    await policyManager
      .connect(traveler)
      .buyPolicy("BA12", departureTimestamp, 0, 150_000_000, 12 * 3600, 720, 8_000_000);

    expect(await insurancePool.getRequiredReserve()).to.equal(150_000_000n);

    await ethers.provider.send("evm_setNextBlockTimestamp", [Number(departureTimestamp + 2n)]);
    await ethers.provider.send("evm_mine", []);

    await oracleCoordinator
      .connect(automationForwarder)
      .performUpkeep(ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [1n]));

    await oracleCoordinator.connect(oracleReporter).fulfillOracleCheck(1, 2, 180);

    expect(await policyManager.totalActiveCoverageAmount()).to.equal(0n);
    expect(await insurancePool.getRequiredReserve()).to.equal(0n);
    expect(await insurancePool.getWithdrawableAmount()).to.equal(5_008_000_000n);
  });

  it("pays out a cancellation policy when the oracle returns cancelled", async function () {
    const { traveler, oracleReporter, automationForwarder, mockUSDC, oracleCoordinator, policyManager } =
      await deployFixture();

    const latestBlock = await ethers.provider.getBlock("latest");
    const departureTimestamp = BigInt(latestBlock!.timestamp + 5400);

    await policyManager
      .connect(traveler)
      .buyPolicy("UA1", departureTimestamp, 1, 300_000_000, 24 * 3600, 0, 15_000_000);

    await ethers.provider.send("evm_setNextBlockTimestamp", [Number(departureTimestamp + 3n)]);
    await ethers.provider.send("evm_mine", []);

    await oracleCoordinator
      .connect(automationForwarder)
      .performUpkeep(ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [1n]));

    const travelerBalanceBefore = await mockUSDC.balanceOf(traveler.address);
    await oracleCoordinator.connect(oracleReporter).fulfillOracleCheck(1, 3, 0);

    expect(await mockUSDC.balanceOf(traveler.address)).to.equal(travelerBalanceBefore + 300_000_000n);
  });

  it("allows the callback consumer to fulfill a voted oracle result", async function () {
    const {
      traveler,
      automationForwarder,
      simulatedFunctionsRouter,
      chainlinkDemoOracleConsumer,
      mockUSDC,
      oracleCoordinator,
      policyManager,
    } = await deployFixture();

    const latestBlock = await ethers.provider.getBlock("latest");
    const departureTimestamp = BigInt(latestBlock!.timestamp + 900);

    await policyManager
      .connect(traveler)
      .buyPolicy("LH779", departureTimestamp, 0, 120_000_000, 12 * 3600, 180, 7_000_000);

    await ethers.provider.send("evm_setNextBlockTimestamp", [Number(departureTimestamp + 2n)]);
    await ethers.provider.send("evm_mine", []);

    await oracleCoordinator
      .connect(automationForwarder)
      .performUpkeep(ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [1n]));

    const travelerBalanceBefore = await mockUSDC.balanceOf(traveler.address);

    await expect(chainlinkDemoOracleConsumer.connect(simulatedFunctionsRouter).submitConsensusResult(1, 2, 240))
      .to.emit(oracleCoordinator, "OracleCheckFulfilled")
      .withArgs(1n, 1n, 2n, 240n, true, 120_000_000n, await chainlinkDemoOracleConsumer.getAddress());

    expect(await mockUSDC.balanceOf(traveler.address)).to.equal(travelerBalanceBefore + 120_000_000n);
  });

  it("can send a real Functions request and settle through the router callback", async function () {
    const {
      owner,
      traveler,
      automationForwarder,
      simulatedFunctionsRouter,
      mockFunctionsRouter,
      chainlinkDemoOracleConsumer,
      mockUSDC,
      oracleCoordinator,
      policyManager,
    } = await deployFixture();

    await chainlinkDemoOracleConsumer.updateChainlinkConfig(
      6421n,
      300_000,
      ethers.encodeBytes32String("fun-ethereum-sepolia-1"),
      "https://oracle.example.com",
    );

    const latestBlock = await ethers.provider.getBlock("latest");
    const departureTimestamp = BigInt(latestBlock!.timestamp + 900);

    await policyManager
      .connect(traveler)
      .buyPolicy("BA12", departureTimestamp, 0, 120_000_000, 12 * 3600, 180, 7_000_000);

    await ethers.provider.send("evm_setNextBlockTimestamp", [Number(departureTimestamp + 2n)]);
    await ethers.provider.send("evm_mine", []);

    await oracleCoordinator
      .connect(automationForwarder)
      .performUpkeep(ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [1n]));

    const travelerBalanceBefore = await mockUSDC.balanceOf(traveler.address);

    await expect(chainlinkDemoOracleConsumer.connect(simulatedFunctionsRouter).requestPolicyEvaluation(1)).to.emit(
      chainlinkDemoOracleConsumer,
      "PolicyEvaluationRequested",
    );

    const activeRequestId = await chainlinkDemoOracleConsumer.activeChainlinkRequestIdByPolicyId(1);
    expect(activeRequestId).to.not.equal(ethers.ZeroHash);

    const response = ethers.AbiCoder.defaultAbiCoder().encode(["uint256", "uint256"], [2n, 240n]);
    await expect(
      mockFunctionsRouter.fulfillRequest(
        await chainlinkDemoOracleConsumer.getAddress(),
        activeRequestId,
        response,
        "0x",
      ),
    )
      .to.emit(oracleCoordinator, "OracleCheckFulfilled")
      .withArgs(1n, 1n, 2n, 240n, true, 120_000_000n, await chainlinkDemoOracleConsumer.getAddress());

    expect(await chainlinkDemoOracleConsumer.activeChainlinkRequestIdByPolicyId(1)).to.equal(ethers.ZeroHash);
    expect(await mockUSDC.balanceOf(traveler.address)).to.equal(travelerBalanceBefore + 120_000_000n);
    expect(await chainlinkDemoOracleConsumer.getChainlinkRouter()).to.equal(await mockFunctionsRouter.getAddress());
    expect(await chainlinkDemoOracleConsumer.owner()).to.equal(owner.address);
  });

  it("keeps the owner as config-only while the dedicated worker executes automation and callback", async function () {
    const {
      owner,
      traveler,
      automationForwarder,
      simulatedFunctionsRouter,
      chainlinkDemoOracleConsumer,
      oracleCoordinator,
      policyManager,
    } = await deployFixture();

    const latestBlock = await ethers.provider.getBlock("latest");
    const departureTimestamp = BigInt(latestBlock!.timestamp + 900);

    await policyManager
      .connect(traveler)
      .buyPolicy("BA12", departureTimestamp, 0, 120_000_000, 12 * 3600, 180, 7_000_000);

    await ethers.provider.send("evm_setNextBlockTimestamp", [Number(departureTimestamp + 2n)]);
    await ethers.provider.send("evm_mine", []);

    const performData = ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [1n]);

    await expect(oracleCoordinator.connect(owner).performUpkeep(performData)).to.be.revertedWith("Not automation");

    await expect(oracleCoordinator.connect(automationForwarder).performUpkeep(performData)).to.emit(
      oracleCoordinator,
      "OracleCheckRequested",
    );

    await expect(chainlinkDemoOracleConsumer.connect(owner).submitConsensusResult(1, 2, 240)).to.be.revertedWith(
      "Not callback executor",
    );

    await expect(
      chainlinkDemoOracleConsumer.connect(simulatedFunctionsRouter).submitConsensusResult(1, 2, 240),
    ).to.emit(oracleCoordinator, "OracleCheckFulfilled");
  });

  it("keeps the core delayed-claim workflow within measurable gas and cost budgets", async function () {
    const [owner, liquidityProvider, traveler, oracleReporter, automationForwarder] = await ethers.getSigners();

    const mockUSDCFactory = (await ethers.getContractFactory("MockUSDC")) as any;
    const mockUSDC = await mockUSDCFactory.deploy(owner.address);
    await mockUSDC.waitForDeployment();

    const insurancePoolFactory = (await ethers.getContractFactory("InsurancePool")) as any;
    const insurancePool = await insurancePoolFactory.deploy(await mockUSDC.getAddress(), owner.address);
    await insurancePool.waitForDeployment();

    const oracleCoordinatorFactory = (await ethers.getContractFactory("OracleCoordinator")) as any;
    const oracleCoordinator = await oracleCoordinatorFactory.deploy(owner.address);
    await oracleCoordinator.waitForDeployment();

    const policyManagerFactory = (await ethers.getContractFactory("PolicyManager")) as any;
    const policyManager = (await policyManagerFactory.deploy(
      await mockUSDC.getAddress(),
      await insurancePool.getAddress(),
      await oracleCoordinator.getAddress(),
      owner.address,
    )) as any;
    await policyManager.waitForDeployment();

    await insurancePool.setPolicyManager(await policyManager.getAddress());
    await oracleCoordinator.setPolicyManager(await policyManager.getAddress());
    await oracleCoordinator.setAutomationForwarder(automationForwarder.address);
    await oracleCoordinator.setReporter(oracleReporter.address, true);

    await mockUSDC.mint(liquidityProvider.address, 5_000);
    await mockUSDC.mint(traveler.address, 500);

    await mockUSDC.connect(liquidityProvider).approve(await insurancePool.getAddress(), 5_000_000_000);
    const depositTx = await insurancePool.connect(liquidityProvider).depositLiquidity(5_000_000_000);
    const depositReceipt = await depositTx.wait();

    await mockUSDC.connect(traveler).approve(await policyManager.getAddress(), 500_000_000);

    const latestBlock = await ethers.provider.getBlock("latest");
    const departureTimestamp = BigInt(latestBlock!.timestamp + 3600);

    const buyPolicyTx = await policyManager
      .connect(traveler)
      .buyPolicy("SQ318", departureTimestamp, 0, 200_000_000, 24 * 3600, 360, 10_000_000);
    const buyPolicyReceipt = await buyPolicyTx.wait();

    await ethers.provider.send("evm_setNextBlockTimestamp", [Number(departureTimestamp + 5n)]);
    await ethers.provider.send("evm_mine", []);

    const performUpkeepTx = await oracleCoordinator
      .connect(automationForwarder)
      .performUpkeep(ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [1n]));
    const performUpkeepReceipt = await performUpkeepTx.wait();

    const fulfillOracleCheckTx = await oracleCoordinator.connect(oracleReporter).fulfillOracleCheck(1, 2, 420);
    const fulfillOracleCheckReceipt = await fulfillOracleCheckTx.wait();

    expectGasBudget(depositReceipt!.gasUsed, BigInt(GAS_BENCHMARKS.depositLiquidity.gasBudget), "depositLiquidity");
    expectGasBudget(buyPolicyReceipt!.gasUsed, BigInt(GAS_BENCHMARKS.buyPolicy.gasBudget), "buyPolicy");
    expectGasBudget(performUpkeepReceipt!.gasUsed, BigInt(GAS_BENCHMARKS.oracleRequest.gasBudget), "performUpkeep");
    expectGasBudget(
      fulfillOracleCheckReceipt!.gasUsed,
      BigInt(GAS_BENCHMARKS.oracleFulfillment.gasBudget),
      "fulfillOracleCheck",
    );

    expectEthCostBudget(
      depositReceipt!.gasUsed,
      ethers.parseEther(GAS_BENCHMARKS.depositLiquidity.maxCostEthAt20Gwei.toFixed(4)),
      "depositLiquidity",
    );
    expectEthCostBudget(
      buyPolicyReceipt!.gasUsed,
      ethers.parseEther(GAS_BENCHMARKS.buyPolicy.maxCostEthAt20Gwei.toFixed(4)),
      "buyPolicy",
    );
    expectEthCostBudget(
      performUpkeepReceipt!.gasUsed,
      ethers.parseEther(GAS_BENCHMARKS.oracleRequest.maxCostEthAt20Gwei.toFixed(4)),
      "performUpkeep",
    );
    expectEthCostBudget(
      fulfillOracleCheckReceipt!.gasUsed,
      ethers.parseEther(GAS_BENCHMARKS.oracleFulfillment.maxCostEthAt20Gwei.toFixed(4)),
      "fulfillOracleCheck",
    );
  });
});
