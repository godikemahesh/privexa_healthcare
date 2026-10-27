require('@nomicfoundation/hardhat-ethers')
require('@nomicfoundation/hardhat-chai-matchers')

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: { version: '0.8.24', settings: { optimizer: { enabled: true, runs: 200 } } },
  networks: {
    // Local demonstration chain only. Not a production or multi-party network.
    localhost: { url: process.env.CHAIN_RPC_URL || 'http://127.0.0.1:8545' },
    hardhat: { chainId: 31337 },
    // Public test network for hosted demos. Test ETH only; never use a wallet that holds real funds.
    ...(process.env.SEPOLIA_RPC_URL && process.env.DEPLOYER_PRIVATE_KEY
      ? { sepolia: { url: process.env.SEPOLIA_RPC_URL, accounts: [process.env.DEPLOYER_PRIVATE_KEY] } }
      : {}),
  },
}
