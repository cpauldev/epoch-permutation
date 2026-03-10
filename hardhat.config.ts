import { defineConfig } from "hardhat/config";
import hardhatEthers from "@nomicfoundation/hardhat-ethers";
import hardhatEthersChaiMatchers from "@nomicfoundation/hardhat-ethers-chai-matchers";
import hardhatMocha from "@nomicfoundation/hardhat-mocha";
import hardhatTypechain from "@nomicfoundation/hardhat-typechain";

export default defineConfig({
  plugins: [
    hardhatEthers,
    hardhatEthersChaiMatchers,
    hardhatMocha,
    hardhatTypechain,
  ],
  solidity: {
    version: "0.8.34",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      type: "edr-simulated",
      chainType: "l1",
      chainId: 31337,
    },
  },
  paths: {
    sources: "./implementations/evm/contracts",
    tests: "./implementations/evm/test",
    cache: "./cache/evm",
    artifacts: "./artifacts/evm",
  },
  typechain: {
    outDir: "./implementations/evm/typechain-types",
  },
  test: {
    mocha: {
      timeout: 120_000,
    },
  },
});
