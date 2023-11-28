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
import { BonusDistributor, GS, RestrictedToken, RewardDistributor, RewardTracker, StakingRouter } from '../typechain-types';

describe("BonusDistributor", function () {
  let gs: GS
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

  it("distributes bonus", async () => {
    const [deployer, user0, user1] = await ethers.getSigners()
    await esGs.mint(rewardDistributor.target, expandDecimals(50000, 18))
    await bnGs.mint(bonusDistributor.target, expandDecimals(1500, 18))
    await rewardDistributor.connect(routerAsSigner).setTokensPerInterval("20667989410000000") // 0.02066798941 esGs per second
    await gs.mint(user0.address, expandDecimals(1000, 18))

    await gs.connect(user0).approve(rewardTracker.target, expandDecimals(1001, 18))
    await expect(rewardTracker.connect(routerAsSigner).stakeForAccount(user0.address, user0.address, gs.target, expandDecimals(1001, 18)))
      .to.be.revertedWith("ERC20: transfer amount exceeds balance")
    await rewardTracker.connect(routerAsSigner).stakeForAccount(user0.address, user0.address, gs.target, expandDecimals(1000, 18))
    await expect(bonusTracker.connect(routerAsSigner).stakeForAccount(user0.address, user0.address, rewardTracker.target, expandDecimals(1001, 18)))
      .to.be.revertedWithPanic(PANIC_CODES.ARITHMETIC_UNDER_OR_OVERFLOW);
    await bonusTracker.connect(routerAsSigner).stakeForAccount(user0.address, user0.address, rewardTracker.target, expandDecimals(1000, 18))

    await increase(24 * 60 * 60)

    expect(await rewardTracker.claimable(user0.address)).gt(expandDecimals(1785, 18)) // 50000 / 28 => ~1785
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
  })

  it('pause/resume emissions', async () => {
    const [deployer, user0] = await ethers.getSigners()
    await esGs.mint(rewardDistributor.target, expandDecimals(50000, 18))
    await rewardDistributor.connect(routerAsSigner).setTokensPerInterval("20667989410000000") // 0.02066798941 esGs per second
    await gs.mint(user0.address, expandDecimals(1000, 18))

    expect(await rewardDistributor.paused()).equals(false);
    expect(await bonusDistributor.paused()).equals(false);

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
  })
})