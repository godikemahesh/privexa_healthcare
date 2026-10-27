const { expect } = require('chai')
const { ethers } = require('hardhat')

describe('AuditAnchor', () => {
  async function deploy() {
    const [owner, other] = await ethers.getSigners()
    const c = await ethers.deployContract('AuditAnchor')
    return { c, owner, other }
  }
  const fp = ethers.sha256(ethers.toUtf8Bytes('{"action":"data_access","outcome":"allow"}'))

  it('anchors a fingerprint and emits an event', async () => {
    const { c } = await deploy()
    const tx = await c.anchor(fp)
    const r = await tx.wait()
    await expect(tx).to.emit(c, 'Anchored').withArgs(fp, r.blockNumber, (v) => v > 0n)
    const [anchored, block] = await c.isAnchored(fp)
    expect(anchored).to.equal(true)
    expect(block).to.equal(BigInt(r.blockNumber))
    expect(await c.anchorCount()).to.equal(1n)
  })

  it('reports unknown fingerprints as not anchored', async () => {
    const { c } = await deploy()
    const [anchored, block] = await c.isAnchored(ethers.keccak256('0x01'))
    expect(anchored).to.equal(false)
    expect(block).to.equal(0n)
  })

  it('rejects duplicate anchors', async () => {
    const { c } = await deploy()
    await c.anchor(fp)
    await expect(c.anchor(fp)).to.be.revertedWithCustomError(c, 'AlreadyAnchored').withArgs(fp)
  })

  it('rejects the zero fingerprint', async () => {
    const { c } = await deploy()
    await expect(c.anchor(ethers.ZeroHash)).to.be.revertedWithCustomError(c, 'InvalidFingerprint')
  })

  it('only allows the owner to anchor', async () => {
    const { c, other } = await deploy()
    await expect(c.connect(other).anchor(fp)).to.be.revertedWithCustomError(c, 'NotAuthorized')
  })
})
