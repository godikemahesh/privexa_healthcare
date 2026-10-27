// Deploys AuditAnchor and writes its address for the Privexa API (deployments/<network>.json).
const fs = require('fs')
const path = require('path')
const { ethers, network } = require('hardhat')

async function main() {
  const c = await ethers.deployContract('AuditAnchor')
  await c.waitForDeployment()
  const address = await c.getAddress()
  const { chainId } = await ethers.provider.getNetwork()
  const out = path.join(__dirname, '..', 'deployments', `${network.name}.json`)
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, JSON.stringify({ address, chainId: Number(chainId), network: network.name, deployedAt: new Date().toISOString() }, null, 2))
  console.log(`AuditAnchor deployed to ${address} on chain ${chainId} (${network.name}). Wrote ${out}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
