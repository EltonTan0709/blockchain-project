import type { Address } from "viem";
import deployedContracts from "~~/contracts/deployedContracts";
import scaffoldConfig from "~~/scaffold.config";
import { CONTRACTS } from "~~/utils/scaffold-eth/contract";

const normalizeAddress = (value: string | undefined, label: string) => {
  if (!value) {
    return undefined;
  }

  const trimmedValue = value.trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(trimmedValue)) {
    throw new Error(`${label} must be a valid 20-byte hex address.`);
  }

  return trimmedValue as Address;
};

const targetNetwork = scaffoldConfig.targetNetworks[0];
const configuredContracts = (
  deployedContracts as Record<
    number,
    {
      InsurancePool?: { address: string };
      OracleCoordinator?: { address: string };
      PolicyManager?: { address: string };
      ChainlinkDemoOracleConsumer?: { address: string };
    }
  >
)[targetNetwork.id];

export const getRuntimeContractAddresses = () => {
  return {
    policyManagerAddress:
      normalizeAddress(process.env.RUNTIME_POLICY_MANAGER_ADDRESS, "RUNTIME_POLICY_MANAGER_ADDRESS") ??
      (configuredContracts?.PolicyManager?.address as Address | undefined) ??
      (CONTRACTS.PolicyManager as Address),
    insurancePoolAddress:
      normalizeAddress(process.env.RUNTIME_INSURANCE_POOL_ADDRESS, "RUNTIME_INSURANCE_POOL_ADDRESS") ??
      (configuredContracts?.InsurancePool?.address as Address | undefined) ??
      (CONTRACTS.InsurancePool as Address),
    oracleCoordinatorAddress:
      normalizeAddress(process.env.RUNTIME_ORACLE_COORDINATOR_ADDRESS, "RUNTIME_ORACLE_COORDINATOR_ADDRESS") ??
      (configuredContracts?.OracleCoordinator?.address as Address | undefined),
    chainlinkDemoOracleConsumerAddress:
      normalizeAddress(
        process.env.RUNTIME_CHAINLINK_DEMO_ORACLE_CONSUMER_ADDRESS,
        "RUNTIME_CHAINLINK_DEMO_ORACLE_CONSUMER_ADDRESS",
      ) ?? (configuredContracts?.ChainlinkDemoOracleConsumer?.address as Address | undefined),
  };
};
