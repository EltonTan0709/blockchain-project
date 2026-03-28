import { createConfig } from "ponder";
import type { Abi } from "viem";
import deployedContracts from "../nextjs/contracts/deployedContracts";
import scaffoldConfig from "../nextjs/scaffold.config";

type IndexedContractConfig = {
  abi: Abi;
  address: `0x${string}`;
  deployedOnBlock?: number;
};

const targetNetwork = scaffoldConfig.targetNetworks[0];
const rpcOverrides = scaffoldConfig.rpcOverrides as Record<number, string> | undefined;
const deployedContractsForNetwork = (deployedContracts as Record<number, Record<string, IndexedContractConfig>>)[
  targetNetwork.id
];

if (!deployedContractsForNetwork) {
  throw new Error(`No deployed contracts found for network ID ${targetNetwork.id}. Deploy the contracts first.`);
}

const getIndexedContract = (contractName: "InsurancePool" | "PolicyManager" | "OracleCoordinator") => {
  const contract = deployedContractsForNetwork[contractName] as IndexedContractConfig | undefined;

  if (!contract) {
    throw new Error(`Missing deployed contract config for ${contractName} on network ID ${targetNetwork.id}.`);
  }

  return contract;
};

const rpcUrl =
  process.env[`PONDER_RPC_URL_${targetNetwork.id}`] ??
  rpcOverrides?.[targetNetwork.id] ??
  targetNetwork.rpcUrls.default.http[0];
const insurancePool = getIndexedContract("InsurancePool");
const policyManager = getIndexedContract("PolicyManager");
const oracleCoordinator = getIndexedContract("OracleCoordinator");

export default createConfig({
  chains: {
    [targetNetwork.name]: {
      id: targetNetwork.id,
      rpc: rpcUrl,
    },
  },
  contracts: {
    InsurancePool: {
      chain: targetNetwork.name,
      abi: insurancePool.abi,
      address: insurancePool.address,
      includeTransactionReceipts: true,
      startBlock: insurancePool.deployedOnBlock ?? 0,
    },
    PolicyManager: {
      chain: targetNetwork.name,
      abi: policyManager.abi,
      address: policyManager.address,
      includeTransactionReceipts: true,
      startBlock: policyManager.deployedOnBlock ?? 0,
    },
    OracleCoordinator: {
      chain: targetNetwork.name,
      abi: oracleCoordinator.abi,
      address: oracleCoordinator.address,
      includeTransactionReceipts: true,
      startBlock: oracleCoordinator.deployedOnBlock ?? 0,
    },
  },
});
