import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { deployContract } from './utils/deploy';
import { increase } from './utils/time'
import { expandDecimals } from './utils/bignumber';

describe("BonusDistributor", function () {
  let gs
  let esGs
  let bnGs
  let rewardTracker
  let rewardDistributor
  let bonusTracker
  let bonusDistributor

  beforeEach(async () => {
    const [deployer, rewardRouter] = await ethers.getSigners()
    gs = await deployContract("GS", []);
    esGs = await deployContract("EsGs", []);
    bnGs = await deployContract("EsGS", []);

    rewardTracker = await deployContract("RewardTracker", ["Staked GS", "stGS"])
    rewardDistributor = await deployContract("RewardDistributor", [esGs.target, rewardTracker.target])
    await rewardDistributor.updateLastDistributionTime()

    bonusTracker = await deployContract("RewardTracker", ["Staked + Bonus GS", "sbGS"])
    bonusDistributor = await deployContract("BonusDistributor", [bnGs.target, bonusTracker.target])
    await bonusDistributor.updateLastDistributionTime()

    await rewardTracker.initialize([gs.target, esGs.target], rewardDistributor.target)
    await bonusTracker.initialize([rewardTracker.target], bonusDistributor.address)

    await rewardTracker.setInPrivateTransferMode(true)
    await rewardTracker.setInPrivateStakingMode(true)
    await bonusTracker.setInPrivateTransferMode(true)
    await bonusTracker.setInPrivateStakingMode(true)

    await rewardTracker.setHandler(rewardRouter.address, true)
    await rewardTracker.setHandler(bonusTracker.target, true)
    await bonusTracker.setHandler(rewardRouter.address, true)
    await bonusDistributor.setBonusMultiplier(10000)
  })

  it("distributes bonus", async () => {
    const [deployer, rewardRouter, user0, user1] = await ethers.getSigners()
    await esGs.setHandler(deployer.address, true)
    await esGs.mint(rewardDistributor.target, expandDecimals(50000, 18))
    await bnGs.setMinter(deployer.address, true)
    await bnGs.mint(bonusDistributor.address, expandDecimals(1500, 18))
    await rewardDistributor.setTokensPerInterval("20667989410000000") // 0.02066798941 esGs per second
    await gs.setHandler(deployer.address, true)
    await gs.mint(user0.address, expandDecimals(1000, 18))

    await gs.connect(user0).approve(rewardTracker.target, expandDecimals(1001, 18))
    await expect(rewardTracker.connect(rewardRouter).stakeForAccount(user0.address, user0.address, gs.target, expandDecimals(1001, 18)))
      .to.be.revertedWith("BaseToken: transfer amount exceeds balance")
    await rewardTracker.connect(rewardRouter).stakeForAccount(user0.address, user0.address, gs.target, expandDecimals(1000, 18))
    await expect(bonusTracker.connect(rewardRouter).stakeForAccount(user0.address, user0.address, rewardTracker.target, expandDecimals(1001, 18)))
      .to.be.revertedWith("RewardTracker: transfer amount exceeds balance")
    await bonusTracker.connect(rewardRouter).stakeForAccount(user0.address, user0.address, rewardTracker.target, expandDecimals(1000, 18))

    await increase(24 * 60 * 60)

    expect(await rewardTracker.claimable(user0.address)).gt(expandDecimals(1785, 18)) // 50000 / 28 => ~1785
    expect(await rewardTracker.claimable(user0.address)).lt(expandDecimals(1786, 18))
    expect(await bonusTracker.claimable(user0.address)).gt(BigInt("2730000000000000000")) // 2.73, 1000 / 365 => ~2.74
    expect(await bonusTracker.claimable(user0.address)).lt(BigInt("2750000000000000000")) // 2.75

    await esGs.mint(user1.address, expandDecimals(500, 18))
    await esGs.connect(user1).approve(rewardTracker.address, expandDecimals(500, 18))
    await rewardTracker.connect(rewardRouter).stakeForAccount(user1.address, user1.address, esGs.target, expandDecimals(500, 18))
    await bonusTracker.connect(rewardRouter).stakeForAccount(user1.address, user1.address, rewardTracker.target, expandDecimals(500, 18))

    await increase(24 * 60 * 60)

    expect(await rewardTracker.claimable(user0.address)).gt(expandDecimals(1785 + 1190, 18))
    expect(await rewardTracker.claimable(user0.address)).lt(expandDecimals(1786 + 1191, 18))

    expect(await rewardTracker.claimable(user1.address)).gt(expandDecimals(595, 18))
    expect(await rewardTracker.claimable(user1.address)).lt(expandDecimals(596, 18))

    expect(await bonusTracker.claimable(user0.address)).gt(BigInt("5470000000000000000")) // 5.47, 1000 / 365 * 2 => ~5.48
    expect(await bonusTracker.claimable(user0.address)).lt(BigInt("5490000000000000000")) // 5.49

    expect(await bonusTracker.claimable(user1.address)).gt(BigInt("1360000000000000000")) // 1.36, 500 / 365 => ~1.37
    expect(await bonusTracker.claimable(user1.address)).lt(BigInt("1380000000000000000")) // 1.38
  })
})