import { ethers } from 'hardhat';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { PANIC_CODES } from '@nomicfoundation/hardhat-chai-matchers/panic';
import { expect } from 'chai';
import { setup, coreTrackers } from './utils/deploy';
import { increase } from './utils/time'
import { expandDecimals } from './utils/bignumber';
import { impersonateAndFund } from './utils/misc';
import { GS, RestrictedToken, RewardDistributor, RewardTracker } from '../typechain-types';

describe('RewardTracker', function() {
  let rewardTracker: RewardTracker
  let gs: GS
  let esGs: RestrictedToken
  let rewardDistributor: RewardDistributor
  let routerAsSigner: HardhatEthersSigner

  beforeEach(async () => {
    const baseContracts = await loadFixture(setup);
    gs = baseContracts.gs;
    esGs = baseContracts.esGs;
    const router = baseContracts.stakingRouter;

    const coreTracker = await coreTrackers(router);
    rewardTracker = coreTracker.rewardTracker;
    rewardDistributor = coreTracker.rewardDistributor;

    routerAsSigner = await impersonateAndFund(router.target.toString());
  });

  it('inits', async () => {
    expect(await rewardTracker.isInitialized()).eq(true)
    expect(await rewardTracker.isDepositToken(gs.target)).eq(true)
    expect(await rewardTracker.isDepositToken(esGs.target)).eq(true)
    expect(await rewardTracker.distributor()).eq(rewardDistributor.target)
    expect(await rewardTracker.distributor()).eq(rewardDistributor.target)
    expect(await rewardTracker.rewardToken()).eq(esGs.target)

    await expect(rewardTracker.connect(routerAsSigner).initialize([gs.target, esGs.target], rewardDistributor.target))
      .to.be.revertedWith('RewardTracker: already initialized')
  })

  it("setDepositToken", async () => {
    const [, user0, user1] = await ethers.getSigners()
    await expect(rewardTracker.connect(user0).setDepositToken(user1.address, true))
      .to.be.revertedWith("Ownable: caller is not the owner")

    expect(await rewardTracker.isDepositToken(user1.address)).eq(false)
    await rewardTracker.connect(routerAsSigner).setDepositToken(user1.address, true)
    expect(await rewardTracker.isDepositToken(user1.address)).eq(true)
    await rewardTracker.connect(routerAsSigner).setDepositToken(user1.address, false)
    expect(await rewardTracker.isDepositToken(user1.address)).eq(false)
  })

  it("setInPrivateTransferMode", async () => {
    const [, user0] = await ethers.getSigners()
    await expect(rewardTracker.connect(user0).setInPrivateTransferMode(true))
      .to.be.revertedWith("Ownable: caller is not the owner")

    expect(await rewardTracker.inPrivateTransferMode()).eq(true)
    await rewardTracker.connect(routerAsSigner).setInPrivateTransferMode(false)
    expect(await rewardTracker.inPrivateTransferMode()).eq(false)
  })

  it("setInPrivateStakingMode", async () => {
    const [, user0] = await ethers.getSigners()
    await expect(rewardTracker.connect(user0).setInPrivateStakingMode(true))
      .to.be.revertedWith("Ownable: caller is not the owner")

    expect(await rewardTracker.inPrivateStakingMode()).eq(true)
    await rewardTracker.connect(routerAsSigner).setInPrivateStakingMode(false)
    expect(await rewardTracker.inPrivateStakingMode()).eq(false)
  })

  it("setHandler", async () => {
    const [, user0, user1] = await ethers.getSigners()
    await expect(rewardTracker.connect(user0).setHandler(user1.address, true))
      .to.be.revertedWith("Ownable: caller is not the owner")

    expect(await rewardTracker.isHandler(user1.address)).eq(false)
    await rewardTracker.connect(routerAsSigner).setHandler(user1.address, true)
    expect(await rewardTracker.isHandler(user1.address)).eq(true)
  })

  it("stake, unstake, claim", async () => {
    const [deployer, user0, user1, user2, user3] = await ethers.getSigners()

    await esGs.mint(rewardDistributor.target, expandDecimals(50000, 18))
    await rewardDistributor.connect(routerAsSigner).setTokensPerInterval("20667989410000000") // 0.02066798941 esGs per second
    await gs.mint(user0.address, expandDecimals(1000, 18))

    await expect(rewardTracker.connect(user0).stake(gs.target, expandDecimals(1000, 18)))
      .to.be.revertedWith("RewardTracker: action not enabled")

    await rewardTracker.connect(routerAsSigner).setInPrivateStakingMode(false)

    await expect(rewardTracker.connect(user0).stake(user1.address, 0))
      .to.be.revertedWith("RewardTracker: invalid _amount")

    await expect(rewardTracker.connect(user0).stake(user1.address, expandDecimals(1000, 18)))
      .to.be.revertedWith("RewardTracker: invalid _depositToken")

    await expect(rewardTracker.connect(user0).stake(gs.target, expandDecimals(1000, 18)))
      .to.be.revertedWith("ERC20: insufficient allowance")

    await gs.connect(user0).approve(rewardTracker.target, expandDecimals(1000, 18))
    await rewardTracker.connect(user0).stake(gs.target, expandDecimals(1000, 18))
    expect(await rewardTracker.stakedAmounts(user0.address)).eq(expandDecimals(1000, 18))
    expect(await rewardTracker.depositBalances(user0.address, gs.target)).eq(expandDecimals(1000, 18))

    await increase(24 * 60 * 60)

    expect(await rewardTracker.claimable(user0.address)).gt(expandDecimals(1785, 18)) // 50000 / 28 => ~1785
    expect(await rewardTracker.claimable(user0.address)).lt(expandDecimals(1786, 18))

    await esGs.mint(user1.address, expandDecimals(500, 18))
    await esGs.connect(user1).approve(rewardTracker.target, expandDecimals(500, 18))
    await rewardTracker.connect(user1).stake(esGs.target, expandDecimals(500, 18))
    expect(await rewardTracker.stakedAmounts(user1.address)).eq(expandDecimals(500, 18))
    expect(await rewardTracker.stakedAmounts(user0.address)).eq(expandDecimals(1000, 18))
    expect(await rewardTracker.depositBalances(user0.address, gs.target)).eq(expandDecimals(1000, 18))
    expect(await rewardTracker.depositBalances(user0.address, esGs.target)).eq(0)
    expect(await rewardTracker.depositBalances(user1.address, gs.target)).eq(0)
    expect(await rewardTracker.depositBalances(user1.address, esGs.target)).eq(expandDecimals(500, 18))
    expect(await rewardTracker.totalDepositSupply(gs.target)).eq(expandDecimals(1000, 18))
    expect(await rewardTracker.totalDepositSupply(esGs.target)).eq(expandDecimals(500, 18))

    expect(await rewardTracker.averageStakedAmounts(user0.address)).eq(0)
    expect(await rewardTracker.cumulativeRewards(user0.address)).eq(0)
    expect(await rewardTracker.averageStakedAmounts(user1.address)).eq(0)
    expect(await rewardTracker.cumulativeRewards(user1.address)).eq(0)

    await increase(24 * 60 * 60)

    expect(await rewardTracker.claimable(user0.address)).gt(expandDecimals(1785 + 1190, 18))
    expect(await rewardTracker.claimable(user0.address)).lt(expandDecimals(1786 + 1191, 18))

    expect(await rewardTracker.claimable(user1.address)).gt(expandDecimals(595, 18))
    expect(await rewardTracker.claimable(user1.address)).lt(expandDecimals(596, 18))

    await expect(rewardTracker.connect(user0).unstake(esGs.target, expandDecimals(1001, 18)))
      .to.be.revertedWith("RewardTracker: _amount exceeds stakedAmount");

    await expect(rewardTracker.connect(user0).unstake(esGs.target, expandDecimals(1000, 18)))
      .to.be.revertedWith("RewardTracker: _amount exceeds depositBalance");

    await expect(rewardTracker.connect(user0).unstake(gs.target, expandDecimals(1001, 18)))
      .to.be.revertedWith("RewardTracker: _amount exceeds stakedAmount");

    expect(await gs.balanceOf(user0.address)).eq(0)
    await rewardTracker.connect(user0).unstake(gs.target, expandDecimals(1000, 18))
    expect(await gs.balanceOf(user0.address)).eq(expandDecimals(1000, 18))
    expect(await rewardTracker.totalDepositSupply(gs.target)).eq(0)
    expect(await rewardTracker.totalDepositSupply(esGs.target)).eq(expandDecimals(500, 18))

    expect(await rewardTracker.averageStakedAmounts(user0.address)).eq(expandDecimals(1000, 18))
    expect(await rewardTracker.cumulativeRewards(user0.address)).gt(expandDecimals(1785+ 1190, 18))
    expect(await rewardTracker.cumulativeRewards(user0.address)).lt(expandDecimals(1786+ 1191, 18))
    expect(await rewardTracker.averageStakedAmounts(user1.address)).eq(0)
    expect(await rewardTracker.cumulativeRewards(user1.address)).eq(0)

    await expect(rewardTracker.connect(user0).unstake(gs.target, 1))
      .to.be.revertedWith("RewardTracker: _amount exceeds stakedAmount");

    expect(await esGs.balanceOf(user0.address)).eq(0)
    await rewardTracker.connect(user0).claim(user2.address)
    expect(await esGs.balanceOf(user2.address)).gt(expandDecimals(1785 + 1190, 18))
    expect(await esGs.balanceOf(user2.address)).lt(expandDecimals(1786 + 1191, 18))

    await increase(24 * 60 * 60)

    expect(await rewardTracker.claimable(user0.address)).eq(0)

    expect(await rewardTracker.claimable(user1.address)).gt(expandDecimals(595 + 1785, 18))
    expect(await rewardTracker.claimable(user1.address)).lt(expandDecimals(596 + 1786, 18))

    await gs.mint(user1.address, expandDecimals(300, 18))
    await gs.connect(user1).approve(rewardTracker.target, expandDecimals(300, 18))
    await rewardTracker.connect(user1).stake(gs.target, expandDecimals(300, 18))
    expect(await rewardTracker.totalDepositSupply(gs.target)).eq(expandDecimals(300, 18))
    expect(await rewardTracker.totalDepositSupply(esGs.target)).eq(expandDecimals(500, 18))

    expect(await rewardTracker.averageStakedAmounts(user0.address)).eq(expandDecimals(1000, 18))
    expect(await rewardTracker.cumulativeRewards(user0.address)).gt(expandDecimals(1785+ 1190, 18))
    expect(await rewardTracker.cumulativeRewards(user0.address)).lt(expandDecimals(1786+ 1191, 18))
    expect(await rewardTracker.averageStakedAmounts(user1.address)).eq(expandDecimals(500, 18))
    expect(await rewardTracker.cumulativeRewards(user1.address)).gt(expandDecimals(595 + 1785, 18))
    expect(await rewardTracker.cumulativeRewards(user1.address)).lt(expandDecimals(596 + 1786, 18))

    await expect(rewardTracker.connect(user1).unstake(gs.target, expandDecimals(301, 18)))
      .to.be.revertedWith("RewardTracker: _amount exceeds depositBalance");

    await expect(rewardTracker.connect(user1).unstake(esGs.target, expandDecimals(501, 18)))
      .to.be.revertedWith("RewardTracker: _amount exceeds depositBalance");

    await increase(2 * 24 * 60 * 60)

    await rewardTracker.connect(user0).claim(user2.address)
    await rewardTracker.connect(user1).claim(user3.address)

    expect(await rewardTracker.averageStakedAmounts(user0.address)).eq(expandDecimals(1000, 18))
    expect(await rewardTracker.cumulativeRewards(user0.address)).gt(expandDecimals(1785 + 1190, 18))
    expect(await rewardTracker.cumulativeRewards(user0.address)).lt(expandDecimals(1786 + 1191, 18))
    expect(await rewardTracker.averageStakedAmounts(user1.address)).gt(expandDecimals(679, 18))
    expect(await rewardTracker.averageStakedAmounts(user1.address)).lt(expandDecimals(681, 18))
    expect(await rewardTracker.cumulativeRewards(user1.address)).gt(expandDecimals(595 + 1785 + 1785 * 2, 18))
    expect(await rewardTracker.cumulativeRewards(user1.address)).lt(expandDecimals(596 + 1786 + 1786 * 2, 18))

    await increase(2 * 24 * 60 * 60)

    await rewardTracker.connect(user0).claim(user2.address)
    await rewardTracker.connect(user1).claim(user3.address)

    expect(await rewardTracker.averageStakedAmounts(user0.address)).eq(expandDecimals(1000, 18))
    expect(await rewardTracker.cumulativeRewards(user0.address)).gt(expandDecimals(1785 + 1190, 18))
    expect(await rewardTracker.cumulativeRewards(user0.address)).lt(expandDecimals(1786 + 1191, 18))
    expect(await rewardTracker.averageStakedAmounts(user1.address)).gt(expandDecimals(724, 18))
    expect(await rewardTracker.averageStakedAmounts(user1.address)).lt(expandDecimals(726, 18))
    expect(await rewardTracker.cumulativeRewards(user1.address)).gt(expandDecimals(595 + 1785 + 1785 * 4, 18))
    expect(await rewardTracker.cumulativeRewards(user1.address)).lt(expandDecimals(596 + 1786 + 1786 * 4, 18))

    expect(await esGs.balanceOf(user2.address)).eq(await rewardTracker.cumulativeRewards(user0.address))
    expect(await esGs.balanceOf(user3.address)).eq(await rewardTracker.cumulativeRewards(user1.address))

    expect(await gs.balanceOf(user1.address)).eq(0)
    expect(await esGs.balanceOf(user1.address)).eq(0)
    await rewardTracker.connect(user1).unstake(gs.target, expandDecimals(300, 18))
    expect(await gs.balanceOf(user1.address)).eq(expandDecimals(300, 18))
    expect(await esGs.balanceOf(user1.address)).eq(0)
    await rewardTracker.connect(user1).unstake(esGs.target, expandDecimals(500, 18))
    expect(await gs.balanceOf(user1.address)).eq(expandDecimals(300, 18))
    expect(await esGs.balanceOf(user1.address)).eq(expandDecimals(500, 18))
    expect(await rewardTracker.totalDepositSupply(gs.target)).eq(0)
    expect(await rewardTracker.totalDepositSupply(esGs.target)).eq(0)

    await rewardTracker.connect(user0).claim(user2.address)
    await rewardTracker.connect(user1).claim(user3.address)

    const distributed = expandDecimals(50000, 18) - (await esGs.balanceOf(rewardDistributor.target))
    const cumulativeReward0 = await rewardTracker.cumulativeRewards(user0.address)
    const cumulativeReward1 = await rewardTracker.cumulativeRewards(user1.address)
    const totalCumulativeReward = cumulativeReward0 + cumulativeReward1

    expect(distributed).gt(totalCumulativeReward - expandDecimals(1, 18))
    expect(distributed).lt(totalCumulativeReward + expandDecimals(1, 18))
  })

  it("stakeForAccount, unstakeForAccount, claimForAccount", async () => {
    const [deployer, user0, user1, user2, user3] = await ethers.getSigners()

    await esGs.mint(rewardDistributor.target, expandDecimals(50000, 18))
    await rewardDistributor.connect(routerAsSigner).setTokensPerInterval("20667989410000000") // 0.02066798941 esgs per second
    await gs.mint(deployer.address, expandDecimals(1000, 18))

    await rewardTracker.connect(routerAsSigner).setInPrivateStakingMode(true)
    await expect(rewardTracker.connect(user0).stake(gs.target, expandDecimals(1000, 18)))
      .to.be.revertedWith("RewardTracker: action not enabled")

    await expect(rewardTracker.connect(user2).stakeForAccount(deployer.address, user0.address, gs.target, expandDecimals(1000, 18)))
      .to.be.revertedWith("RewardTracker: forbidden")

    await rewardTracker.connect(routerAsSigner).setHandler(user2.address, true)
    await expect(rewardTracker.connect(user2).stakeForAccount(deployer.address, user0.address, gs.target, expandDecimals(1000, 18)))
      .to.be.revertedWith("ERC20: insufficient allowance")

    await gs.connect(deployer).approve(rewardTracker.target, expandDecimals(1000, 18))

    await rewardTracker.connect(user2).stakeForAccount(deployer.address, user0.address, gs.target, expandDecimals(1000, 18))
    expect(await rewardTracker.stakedAmounts(user0.address)).eq(expandDecimals(1000, 18))
    expect(await rewardTracker.depositBalances(user0.address, gs.target)).eq(expandDecimals(1000, 18))

    await increase(24 * 60 * 60)

    expect(await rewardTracker.claimable(user0.address)).gt(expandDecimals(1785, 18)) // 50000 / 28 => ~1785
    expect(await rewardTracker.claimable(user0.address)).lt(expandDecimals(1786, 18))

    await rewardTracker.connect(routerAsSigner).setHandler(user2.address, false)
    await expect(rewardTracker.connect(user2).unstakeForAccount(user0.address, esGs.target, expandDecimals(1000, 18), user1.address))
      .to.be.revertedWith("RewardTracker: forbidden")

    await rewardTracker.connect(routerAsSigner).setHandler(user2.address, true)

    await expect(rewardTracker.connect(user2).unstakeForAccount(user0.address, esGs.target, expandDecimals(1000, 18), user1.address))
      .to.be.revertedWith("RewardTracker: _amount exceeds depositBalance")

    await expect(rewardTracker.connect(user2).unstakeForAccount(user0.address, gs.target, expandDecimals(1001, 18), user1.address))
      .to.be.revertedWith("RewardTracker: _amount exceeds stakedAmount")

    expect(await gs.balanceOf(user0.address)).eq(0)
    expect(await rewardTracker.stakedAmounts(user0.address)).eq(expandDecimals(1000, 18))
    expect(await rewardTracker.depositBalances(user0.address, gs.target)).eq(expandDecimals(1000, 18))

    await rewardTracker.connect(routerAsSigner).setInPrivateTransferMode(false)

    expect(await rewardTracker.balanceOf(user0.address)).eq(expandDecimals(1000, 18))
    await rewardTracker.connect(user0).transfer(user1.address, expandDecimals(50, 18))
    expect(await rewardTracker.balanceOf(user0.address)).eq(expandDecimals(950, 18))
    expect(await rewardTracker.balanceOf(user1.address)).eq(expandDecimals(50, 18))

    await rewardTracker.connect(routerAsSigner).setInPrivateTransferMode(true)
    await expect(rewardTracker.connect(user0).transfer(user1.address, expandDecimals(50, 18)))
      .to.be.revertedWith("RewardTracker: forbidden")

    await rewardTracker.connect(routerAsSigner).setHandler(user2.address, false)
    await expect(rewardTracker.connect(user2).transferFrom(user1.address, user0.address, expandDecimals(50, 18)))
      .to.be.revertedWithPanic(PANIC_CODES.ARITHMETIC_UNDER_OR_OVERFLOW)

    await rewardTracker.connect(routerAsSigner).setHandler(user2.address, true)
    await rewardTracker.connect(user2).transferFrom(user1.address, user0.address, expandDecimals(50, 18))
    expect(await rewardTracker.balanceOf(user0.address)).eq(expandDecimals(1000, 18))
    expect(await rewardTracker.balanceOf(user1.address)).eq(0)

    await rewardTracker.connect(user2).unstakeForAccount(user0.address, gs.target, expandDecimals(100, 18), user1.address)

    expect(await gs.balanceOf(user1.address)).eq(expandDecimals(100, 18))
    expect(await rewardTracker.stakedAmounts(user0.address)).eq(expandDecimals(900, 18))
    expect(await rewardTracker.depositBalances(user0.address, gs.target)).eq(expandDecimals(900, 18))

    await expect(rewardTracker.connect(user3).claimForAccount(user0.address, user3.address))
      .to.be.revertedWith("RewardTracker: forbidden")

    expect(await rewardTracker.claimable(user0.address)).gt(expandDecimals(1785, 18))
    expect(await rewardTracker.claimable(user0.address)).lt(expandDecimals(1787, 18))
    expect(await esGs.balanceOf(user0.address)).eq(0)
    expect(await esGs.balanceOf(user3.address)).eq(0)

    await rewardTracker.connect(user2).claimForAccount(user0.address, user3.address)

    expect(await rewardTracker.claimable(user0.address)).eq(0)
    expect(await esGs.balanceOf(user3.address)).gt(expandDecimals(1785, 18))
    expect(await esGs.balanceOf(user3.address)).lt(expandDecimals(1787, 18))
  })
})