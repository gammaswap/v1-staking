import { ethers } from 'hardhat';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { PANIC_CODES } from '@nomicfoundation/hardhat-chai-matchers/panic';
import { anyUint } from '@nomicfoundation/hardhat-chai-matchers/withArgs';
import { expect } from 'chai';
import { setup, coreTrackers } from './utils/deploy';
import { increase } from './utils/time'
import { expandDecimals } from './utils/bignumber';
import { impersonateAndFund } from './utils/misc';
import { BonusDistributor, GS, RestrictedToken, RewardDistributor, RewardTracker, StakingRouter, Token } from '../typechain-types';

describe("BonusDistributor", function () {
  let gs: Token
  let esGs: RestrictedToken
  let bnGs: RestrictedToken
  let rewardTracker: RewardTracker
  let rewardDistributor: RewardDistributor
  let bonusTracker: RewardTracker
  let bonusDistributor: BonusDistributor
  let stakingRouter: StakingRouter
  let routerAsSigner: HardhatEthersSigner

  beforeEach(async () => {
    const baseContracts = await loadFixture(setup);
    gs = baseContracts.gs;
    esGs = baseContracts.esGs;
    bnGs = baseContracts.bnGs;
    stakingRouter = baseContracts.stakingRouter;

    const coreTracker = await coreTrackers(stakingRouter);
    rewardTracker = coreTracker.rewardTracker;
    rewardDistributor = coreTracker.rewardDistributor;
    bonusTracker = coreTracker.bonusTracker;
    bonusDistributor = coreTracker.bonusDistributor;

    routerAsSigner = await impersonateAndFund(stakingRouter.target.toString());

    await bonusDistributor.connect(routerAsSigner).setBonusMultiplier(10000)
  })

  it("initial states", async () => {
    expect(await rewardDistributor.rewardToken()).equals(esGs.target)
    expect(await rewardDistributor.rewardTracker()).equals(rewardTracker.target)
    expect(await rewardDistributor.tokensPerInterval()).equals(0)
    expect(await rewardDistributor.lastDistributionTime()).greaterThan(0)
    expect(await rewardDistributor.paused()).equals(true)
    expect(await rewardDistributor.maxWithdrawableAmount()).equals(0)

    expect(await bonusDistributor.rewardToken()).equals(bnGs.target)
    expect(await bonusDistributor.rewardTracker()).equals(bonusTracker.target)
    expect(await bonusDistributor.tokensPerInterval()).equals(0)
    expect(await bonusDistributor.lastDistributionTime()).greaterThan(0)
    expect(await bonusDistributor.paused()).equals(true)
    expect(await bonusDistributor.maxWithdrawableAmount()).equals(0)
  })

  it("Max basis points", async () => {
    expect(await bonusDistributor.bonusMultiplierBasisPoints()).equals(10000)

    await expect(bonusDistributor.connect(routerAsSigner).setBonusMultiplier(200001))
      .to.revertedWith("BonusDistributor: invalid multiplier points")

    await (await bonusDistributor.connect(routerAsSigner).setBonusMultiplier(200000)).wait()

    expect(await bonusDistributor.bonusMultiplierBasisPoints()).equals(200000)
  })

  it("distributes bonus", async () => {
    const [deployer, user0, user1] = await ethers.getSigners()
    await esGs.mint(rewardDistributor.target, expandDecimals(5000, 18))
    await bnGs.mint(bonusDistributor.target, expandDecimals(1500, 18))
    await rewardDistributor.connect(routerAsSigner).setTokensPerInterval("20667989410000000") // 0.02066798941 esGs per second
    await rewardDistributor.connect(routerAsSigner).setPaused(false)
    await bonusDistributor.connect(routerAsSigner).setPaused(false)
    await gs.mint(user0.address, expandDecimals(1000, 18))

    await gs.connect(user0).approve(rewardTracker.target, expandDecimals(1001, 18))
    await expect(rewardTracker.connect(routerAsSigner).stakeForAccount(user0.address, user0.address, gs.target, expandDecimals(1001, 18)))
      .to.be.revertedWith("ERC20: transfer amount exceeds balance")
    await rewardTracker.connect(routerAsSigner).stakeForAccount(user0.address, user0.address, gs.target, expandDecimals(1000, 18))
    await expect(bonusTracker.connect(routerAsSigner).stakeForAccount(user0.address, user0.address, rewardTracker.target, expandDecimals(1001, 18)))
      .to.be.revertedWithPanic(PANIC_CODES.ARITHMETIC_UNDER_OR_OVERFLOW);
    await bonusTracker.connect(routerAsSigner).stakeForAccount(user0.address, user0.address, rewardTracker.target, expandDecimals(1000, 18))

    await increase(24 * 60 * 60)

    expect(await rewardTracker.claimable(user0.address)).gt(expandDecimals(1785, 18)) // 0.02066798941 * 24 * 60 * 60 => ~1785
    expect(await rewardTracker.claimable(user0.address)).lt(expandDecimals(1786, 18))
    expect(await bonusTracker.claimable(user0.address)).gt(BigInt("2730000000000000000")) // 2.73, 1000 / 365 => ~2.74
    expect(await bonusTracker.claimable(user0.address)).lt(BigInt("2750000000000000000")) // 2.75

    await esGs.mint(user1.address, expandDecimals(500, 18))
    await esGs.connect(user1).approve(rewardTracker.target, expandDecimals(500, 18))
    await rewardTracker.connect(routerAsSigner).stakeForAccount(user1.address, user1.address, esGs.target, expandDecimals(500, 18))
    await bonusTracker.connect(routerAsSigner).stakeForAccount(user1.address, user1.address, rewardTracker.target, expandDecimals(500, 18))

    await increase(24 * 60 * 60)

    expect(await rewardTracker.claimable(user0.address)).gt(expandDecimals(1785 + 1190, 18))
    expect(await rewardTracker.claimable(user0.address)).lt(expandDecimals(1786 + 1191, 18))

    expect(await rewardTracker.claimable(user1.address)).gt(expandDecimals(595, 18))
    expect(await rewardTracker.claimable(user1.address)).lt(expandDecimals(596, 18))

    expect(await bonusTracker.claimable(user0.address)).gt(BigInt("5470000000000000000")) // 5.47, 1000 / 365 * 2 => ~5.48
    expect(await bonusTracker.claimable(user0.address)).lt(BigInt("5490000000000000000")) // 5.49

    expect(await bonusTracker.claimable(user1.address)).gt(BigInt("1360000000000000000")) // 1.36, 500 / 365 => ~1.37
    expect(await bonusTracker.claimable(user1.address)).lt(BigInt("1380000000000000000")) // 1.38

    expect(await rewardDistributor.maxWithdrawableAmount()).gt(expandDecimals(1428, 18))  // 5000 - (1786 + 1191 + 595)
    expect(await rewardDistributor.maxWithdrawableAmount()).lt(expandDecimals(1429, 18))
    expect(await bonusDistributor.maxWithdrawableAmount()).gt(expandDecimals(1493, 18)) // 1500 - (5.48 + 1.37)
    expect(await bonusDistributor.maxWithdrawableAmount()).lt(expandDecimals(1494, 18))
  })

  it('pause/resume emissions', async () => {
    const [deployer, user0] = await ethers.getSigners()
    await esGs.mint(rewardDistributor.target, expandDecimals(50000, 18))
    await rewardDistributor.connect(routerAsSigner).setTokensPerInterval("20667989410000000") // 0.02066798941 esGs per second
    await rewardDistributor.connect(routerAsSigner).setPaused(false)
    await gs.mint(user0.address, expandDecimals(1000, 18))

    expect(await rewardDistributor.paused()).equals(false);

    await gs.connect(user0).approve(rewardTracker.target, expandDecimals(1001, 18))
    await rewardTracker.connect(routerAsSigner).stakeForAccount(user0.address, user0.address, gs.target, expandDecimals(1000, 18))

    await increase(24 * 60 * 60)

    await expect(rewardDistributor.connect(routerAsSigner).setPaused(true))
      .to.emit(rewardDistributor, 'StatusChange')
      .withArgs(rewardTracker.target, anyUint, true);

    let claimable = await rewardTracker.claimable(user0.address);
    expect(claimable).gt(expandDecimals(1785, 18)) // 50000 / 28 => ~1785
    expect(claimable).lt(expandDecimals(1786, 18))

    const esGsBalanceBeforeClaim = await esGs.balanceOf(user0.address);
    await rewardTracker.connect(user0).claim(user0.address);
    const esGsBalanceAfterClaim = await esGs.balanceOf(user0.address);
    expect(esGsBalanceAfterClaim - esGsBalanceBeforeClaim).eq(claimable);
    expect(await rewardTracker.claimable(user0.address)).eq(0);

    await increase(24 * 60 * 60);

    // No more rewards earned
    expect(await rewardTracker.claimable(user0.address)).eq(0);

    await increase(30 * 24 * 60 * 60);
    await rewardDistributor.connect(routerAsSigner).setPaused(false);

    await increase(24 * 60 * 60);

    // Now earning rewards again
    expect(await rewardTracker.claimable(user0.address)).gt(expandDecimals(1785, 18))
    expect(await rewardTracker.claimable(user0.address)).lt(expandDecimals(1786, 18))

    await rewardDistributor.connect(routerAsSigner).setPaused(true);

    await increase(24 * 60 * 60);

    expect(await rewardTracker.claimable(user0.address)).gt(expandDecimals(1785, 18))
    expect(await rewardTracker.claimable(user0.address)).lt(expandDecimals(1786, 18))

    await rewardDistributor.connect(routerAsSigner).setPaused(false);

    expect(await rewardTracker.claimable(user0.address)).gt(expandDecimals(1785, 18))
    expect(await rewardTracker.claimable(user0.address)).lt(expandDecimals(1786, 18))

    await increase(24 * 60 * 60);

    expect(await rewardTracker.claimable(user0.address)).gt(expandDecimals(3570, 18))
    expect(await rewardTracker.claimable(user0.address)).lt(expandDecimals(3572, 18))

    await rewardDistributor.connect(routerAsSigner).withdrawToken(esGs.target, deployer, 0)
    expect(await rewardDistributor.maxWithdrawableAmount()).equals(0)

    const esGsBalance = await esGs.balanceOf(deployer)
    expect(esGsBalance).gt(expandDecimals(44642, 18))  // 50000 - (1786 + 3572) ~= 44642
    expect(esGsBalance).lt(expandDecimals(44643, 18))

    await rewardDistributor.connect(routerAsSigner).withdrawToken(esGs.target, deployer, expandDecimals(1000, 18))
    expect(await esGs.balanceOf(deployer)).equals(esGsBalance)
  })
})