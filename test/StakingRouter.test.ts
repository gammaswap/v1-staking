import { ethers } from 'hardhat';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { PANIC_CODES } from '@nomicfoundation/hardhat-chai-matchers/panic';
import { expect } from 'chai';
import { setup, coreTrackers, poolTrackers } from './utils/deploy';
import { increase, latest } from './utils/time'
import { expandDecimals } from './utils/bignumber';
import { impersonateAndFund, reportGasUsed } from './utils/misc';
import { BonusDistributor, FeeTracker, GS, ERC20Mock, RestrictedToken, RewardDistributor, RewardTracker, StakingRouter, Vester, LoanTracker, VesterNoReserve, Token } from '../typechain-types';

describe("StakingRouter", function () {
  let gs: Token
  let esGs: RestrictedToken
  let bnGs: RestrictedToken
  let weth: ERC20Mock
  let rewardTracker: RewardTracker
  let rewardDistributor: RewardDistributor
  let loanRewardTracker: RewardTracker
  let loanRewardDistributor: RewardDistributor
  let bonusTracker: RewardTracker
  let bonusDistributor: BonusDistributor
  let feeTracker: FeeTracker
  let feeDistributor: RewardDistributor
  let vester: Vester
  let loanVester: VesterNoReserve
  let stakingRouter: StakingRouter
  let routerAsSigner: HardhatEthersSigner
  let gsPool: ERC20Mock

  beforeEach(async () => {
    const baseContracts = await loadFixture(setup);
    gs = baseContracts.gs;
    esGs = baseContracts.esGs;
    bnGs = baseContracts.bnGs;
    weth = baseContracts.weth;
    gsPool = baseContracts.gsPool;

    stakingRouter = baseContracts.stakingRouter
    routerAsSigner = await impersonateAndFund(stakingRouter.target.toString());

    const coreTracker = await coreTrackers(stakingRouter);
    rewardTracker = coreTracker.rewardTracker;
    rewardDistributor = coreTracker.rewardDistributor;
    loanRewardTracker = coreTracker.loanRewardTracker;
    loanRewardDistributor = coreTracker.loanRewardDistributor;
    bonusTracker = coreTracker.bonusTracker;
    bonusDistributor = coreTracker.bonusDistributor;
    feeTracker = coreTracker.feeTracker;
    feeDistributor = coreTracker.feeDistributor;
    vester = coreTracker.vester;
    loanVester = coreTracker.loanVester;

    await esGs.mint(rewardDistributor.target, expandDecimals(50000, 18))
    await rewardDistributor.connect(routerAsSigner).setTokensPerInterval("20667989410000000") // 0.02066798941 esGs per second
    await rewardDistributor.connect(routerAsSigner).setPaused(false)
    await bonusDistributor.connect(routerAsSigner).setBonusMultiplier(10000)
    await bnGs.connect(routerAsSigner).mint(bonusDistributor, expandDecimals(1500, 18))
    await weth.mint(feeDistributor.target, expandDecimals(100, 18))
    await bonusDistributor.connect(routerAsSigner).setPaused(false)
    await feeDistributor.connect(routerAsSigner).setTokensPerInterval("41335970000000") // 0.00004133597 WETH per second
    await feeDistributor.connect(routerAsSigner).setPaused(false)
  })

  it("inits", async () => {
    expect(await stakingRouter.feeRewardToken()).eq(weth.target)
    expect(await stakingRouter.gs()).eq(gs.target)
    expect(await stakingRouter.esGs()).eq(esGs.target)
    expect(await stakingRouter.bnGs()).eq(bnGs.target)

    expect((await stakingRouter.coreTracker()).rewardTracker).eq(rewardTracker.target)
    expect((await stakingRouter.coreTracker()).rewardDistributor).eq(rewardDistributor.target)
    expect((await stakingRouter.coreTracker()).bonusTracker).eq(bonusTracker.target)
    expect((await stakingRouter.coreTracker()).bonusDistributor).eq(bonusDistributor.target)
    expect((await stakingRouter.coreTracker()).feeTracker).eq(feeTracker.target)
    expect((await stakingRouter.coreTracker()).feeDistributor).eq(feeDistributor.target)
    expect((await stakingRouter.coreTracker()).vester).eq(vester.target)
  })

  it("StakingAdmin", async () => {
    const IRewardTrackerInterface = "0x5a511ae0";
    const ILoanTrackerInterface = "0x3c68ad7c";
    const IRewardDistributorInterface = "0xfb600f23";
    const IVesterInterface = "0x25160dff";

    const [deployer] = await ethers.getSigners();
    expect(await rewardTracker.supportsInterface(IRewardTrackerInterface)).equals(true)
    expect(await rewardDistributor.supportsInterface(IRewardDistributorInterface)).equals(true)
    expect(await loanRewardTracker.supportsInterface(IRewardTrackerInterface)).equals(true)
    expect(await loanRewardDistributor.supportsInterface(IRewardDistributorInterface)).equals(true)
    expect(await bonusTracker.supportsInterface(IRewardTrackerInterface)).equals(true)
    expect(await bonusDistributor.supportsInterface(IRewardDistributorInterface)).equals(true)
    expect(await feeTracker.supportsInterface(IRewardTrackerInterface)).equals(true)
    expect(await feeDistributor.supportsInterface(IRewardDistributorInterface)).equals(true)
    expect(await vester.supportsInterface(IVesterInterface)).equals(true)
    expect(await loanVester.supportsInterface(IVesterInterface)).equals(true)

    const functionData = bonusDistributor.interface.encodeFunctionData('setBonusMultiplier', [10000])
    await stakingRouter.connect(deployer).execute(bonusDistributor, functionData)
  })

  it("stakeGsForAccount, stakeGs, stakeEsGs, unstakeGs, unstakeEsGs, claim, compound, compoundForAccount", async () => {
    const [,, user0, user1, user2] = await ethers.getSigners(); // user0 = manager

    await gs.mint(user0.address, expandDecimals(1500, 18))
    expect(await gs.balanceOf(user0.address)).eq(expandDecimals(1500, 18))

    await gs.connect(user0).approve(rewardTracker.target, expandDecimals(1000, 18))
    await expect(stakingRouter.connect(user2).stakeGsForAccount(user1.address, expandDecimals(1000, 18)))
      .to.be.revertedWith("StakingRouter: forbidden")

    await gs.connect(user0).approve(rewardTracker.target, expandDecimals(1000, 18))
    await expect(stakingRouter.connect(user0).stakeGsForAccount(user1.address, expandDecimals(800, 18)))
      .to.emit(stakingRouter, "StakedGs")
      .withArgs(user1.address, gs.target, expandDecimals(800, 18))
    expect(await gs.balanceOf(user0.address)).eq(expandDecimals(700, 18))
    expect(await stakingRouter.getAverageStakedAmount(ethers.ZeroAddress, ethers.ZeroAddress, user1.address)).eq(0n);

    await gs.mint(user1.address, expandDecimals(200, 18))
    expect(await gs.balanceOf(user1.address)).eq(expandDecimals(200, 18))
    await gs.connect(user1).approve(rewardTracker.target, expandDecimals(200, 18))
    await stakingRouter.connect(user1).stakeGs(expandDecimals(200, 18))
    expect(await gs.balanceOf(user1.address)).eq(0)
    expect(await rewardTracker.stakedAmounts(user0.address)).eq(0)
    expect(await rewardTracker.depositBalances(user0.address, gs.target)).eq(0)
    expect(await rewardTracker.stakedAmounts(user1.address)).eq(expandDecimals(1000, 18))
    expect(await rewardTracker.depositBalances(user1.address, gs.target)).eq(expandDecimals(1000, 18))
    expect(await stakingRouter.getAverageStakedAmount(ethers.ZeroAddress, ethers.ZeroAddress, user1.address)).eq(expandDecimals(800, 18));

    expect(await bonusTracker.stakedAmounts(user0.address)).eq(0)
    expect(await bonusTracker.depositBalances(user0.address, rewardTracker.target)).eq(0)
    expect(await bonusTracker.stakedAmounts(user1.address)).eq(expandDecimals(1000, 18))
    expect(await bonusTracker.depositBalances(user1.address, rewardTracker.target)).eq(expandDecimals(1000, 18))

    expect(await feeTracker.stakedAmounts(user0.address)).eq(0)
    expect(await feeTracker.depositBalances(user0.address, bonusTracker.target)).eq(0)
    expect(await feeTracker.stakedAmounts(user1.address)).eq(expandDecimals(1000, 18))
    expect(await feeTracker.depositBalances(user1.address, bonusTracker.target)).eq(expandDecimals(1000, 18))

    await increase(24 * 60 * 60)

    expect(await rewardTracker.claimable(user0.address)).eq(0)
    expect(await rewardTracker.claimable(user1.address)).gt(expandDecimals(1785, 18)) // 50000 / 28 => ~1785
    expect(await rewardTracker.claimable(user1.address)).lt(expandDecimals(1786, 18))

    expect(await bonusTracker.claimable(user0.address)).eq(0)
    expect(await bonusTracker.claimable(user1.address)).gt("2730000000000000000") // 2.73, 1000 / 365 => ~2.74
    expect(await bonusTracker.claimable(user1.address)).lt("2750000000000000000") // 2.75

    expect(await feeTracker.claimable(user0.address)).eq(0)
    expect(await feeTracker.claimable(user1.address)).gt("3560000000000000000") // 3.56, 100 / 28 => ~3.57
    expect(await feeTracker.claimable(user1.address)).lt("3580000000000000000") // 3.58

    expect(await stakingRouter.getAverageStakedAmount(ethers.ZeroAddress, ethers.ZeroAddress, user1.address)).eq(expandDecimals(800, 18));

    await increase(20)

    await esGs.mint(user2.address, expandDecimals(500, 18))
    await expect(stakingRouter.connect(user2).stakeEsGs(expandDecimals(500, 18)))
      .to.emit(stakingRouter, "StakedGs")
      .withArgs(user2.address, esGs.target, expandDecimals(500, 18))

    expect(await rewardTracker.stakedAmounts(user0.address)).eq(0)
    expect(await rewardTracker.depositBalances(user0.address, gs.target)).eq(0)
    expect(await rewardTracker.stakedAmounts(user1.address)).eq(expandDecimals(1000, 18))
    expect(await rewardTracker.depositBalances(user1.address, gs.target)).eq(expandDecimals(1000, 18))
    expect(await rewardTracker.stakedAmounts(user2.address)).eq(expandDecimals(500, 18))
    expect(await rewardTracker.depositBalances(user2.address, esGs.target)).eq(expandDecimals(500, 18))

    expect(await bonusTracker.stakedAmounts(user0.address)).eq(0)
    expect(await bonusTracker.depositBalances(user0.address, rewardTracker.target)).eq(0)
    expect(await bonusTracker.stakedAmounts(user1.address)).eq(expandDecimals(1000, 18))
    expect(await bonusTracker.depositBalances(user1.address, rewardTracker.target)).eq(expandDecimals(1000, 18))
    expect(await bonusTracker.stakedAmounts(user2.address)).eq(expandDecimals(500, 18))
    expect(await bonusTracker.depositBalances(user2.address, rewardTracker.target)).eq(expandDecimals(500, 18))

    expect(await feeTracker.stakedAmounts(user0.address)).eq(0)
    expect(await feeTracker.depositBalances(user0.address, bonusTracker.target)).eq(0)
    expect(await feeTracker.stakedAmounts(user1.address)).eq(expandDecimals(1000, 18))
    expect(await feeTracker.depositBalances(user1.address, bonusTracker.target)).eq(expandDecimals(1000, 18))
    expect(await feeTracker.stakedAmounts(user2.address)).eq(expandDecimals(500, 18))
    expect(await feeTracker.depositBalances(user2.address, bonusTracker.target)).eq(expandDecimals(500, 18))

    await increase(24 * 60 * 60)

    expect(await rewardTracker.claimable(user0.address)).eq(0)
    expect(await rewardTracker.claimable(user1.address)).gt(expandDecimals(1785 + 1190, 18))
    expect(await rewardTracker.claimable(user1.address)).lt(expandDecimals(1786 + 1191, 18))
    expect(await rewardTracker.claimable(user2.address)).gt(expandDecimals(595, 18))
    expect(await rewardTracker.claimable(user2.address)).lt(expandDecimals(596, 18))

    expect(await bonusTracker.claimable(user0.address)).eq(0)
    expect(await bonusTracker.claimable(user1.address)).gt("5470000000000000000") // 5.47, 1000 / 365 * 2 => ~5.48
    expect(await bonusTracker.claimable(user1.address)).lt("5490000000000000000")
    expect(await bonusTracker.claimable(user2.address)).gt("1360000000000000000") // 1.36, 500 / 365 => ~1.37
    expect(await bonusTracker.claimable(user2.address)).lt("1380000000000000000")

    expect(await feeTracker.claimable(user0.address)).eq(0)
    expect(await feeTracker.claimable(user1.address)).gt("5940000000000000000") // 5.94, 3.57 + 100 / 28 / 3 * 2 => ~5.95
    expect(await feeTracker.claimable(user1.address)).lt("5960000000000000000")
    expect(await feeTracker.claimable(user2.address)).gt("1180000000000000000") // 1.18, 100 / 28 / 3 => ~1.19
    expect(await feeTracker.claimable(user2.address)).lt("1200000000000000000")

    expect(await esGs.balanceOf(user1.address)).eq(0)
    expect(await weth.balanceOf(user1.address)).eq(0)
    await stakingRouter.connect(user1).claim(true, true, true)
    expect(await esGs.balanceOf(user1.address)).gt(expandDecimals(1785 + 1190, 18))
    expect(await esGs.balanceOf(user1.address)).lt(expandDecimals(1786 + 1191, 18))
    expect(await weth.balanceOf(user1.address)).gt("5940000000000000000")
    expect(await weth.balanceOf(user1.address)).lt("5960000000000000000")
    expect(await stakingRouter.getAverageStakedAmount(ethers.ZeroAddress, esGs.target, user1.address)).gt(expandDecimals(999, 18));
    expect(await stakingRouter.getAverageStakedAmount(ethers.ZeroAddress, esGs.target, user1.address)).lt(expandDecimals(1000, 18));

    expect(await esGs.balanceOf(user2.address)).eq(0)
    expect(await weth.balanceOf(user2.address)).eq(0)
    await stakingRouter.connect(user2).claim(true, true, true)
    expect(await esGs.balanceOf(user2.address)).gt(expandDecimals(595, 18))
    expect(await esGs.balanceOf(user2.address)).lt(expandDecimals(596, 18))
    expect(await weth.balanceOf(user2.address)).gt("1180000000000000000")
    expect(await weth.balanceOf(user2.address)).lt("1200000000000000000")

    await increase(24 * 60 * 60)

    const tx0 = await stakingRouter.connect(user1).compound()
    await reportGasUsed(tx0, "compound gas used")

    await increase(24 * 60 * 60)

    await expect(stakingRouter.connect(user1).compoundForAccount(user2))
      .to.be.revertedWith("StakingRouter: forbidden");
    await stakingRouter.connect(user1).compound()
    await stakingRouter.connect(user0).compoundForAccount(user2);

    expect(await rewardTracker.stakedAmounts(user1.address)).gt(expandDecimals(3643, 18))
    expect(await rewardTracker.stakedAmounts(user1.address)).lt(expandDecimals(3645, 18))
    expect(await rewardTracker.depositBalances(user1.address, gs.target)).eq(expandDecimals(1000, 18))
    expect(await rewardTracker.depositBalances(user1.address, esGs.target)).gt(expandDecimals(2643, 18))
    expect(await rewardTracker.depositBalances(user1.address, esGs.target)).lt(expandDecimals(2645, 18))

    expect(await bonusTracker.stakedAmounts(user1.address)).gt(expandDecimals(3643, 18))
    expect(await bonusTracker.stakedAmounts(user1.address)).lt(expandDecimals(3645, 18))

    expect(await feeTracker.stakedAmounts(user1.address)).gt(expandDecimals(3657, 18))
    expect(await feeTracker.stakedAmounts(user1.address)).lt(expandDecimals(3659, 18))
    expect(await feeTracker.depositBalances(user1.address, bonusTracker.target)).gt(expandDecimals(3643, 18))
    expect(await feeTracker.depositBalances(user1.address, bonusTracker.target)).lt(expandDecimals(3645, 18))
    expect(await feeTracker.depositBalances(user1.address, bnGs.target)).gt("14100000000000000000") // 14.1
    expect(await feeTracker.depositBalances(user1.address, bnGs.target)).lt("14300000000000000000") // 14.3

    expect(await gs.balanceOf(user1.address)).eq(0)
    await expect(stakingRouter.connect(user1).unstakeGs(expandDecimals(300, 18)))
      .to.emit(stakingRouter, "UnstakedGs")
      .withArgs(user1.address, gs.target, expandDecimals(300, 18))
    expect(await gs.balanceOf(user1.address)).eq(expandDecimals(300, 18))

    expect(await rewardTracker.stakedAmounts(user1.address)).gt(expandDecimals(3343, 18))
    expect(await rewardTracker.stakedAmounts(user1.address)).lt(expandDecimals(3345, 18))
    expect(await rewardTracker.depositBalances(user1.address, gs.target)).eq(expandDecimals(700, 18))
    expect(await rewardTracker.depositBalances(user1.address, esGs.target)).gt(expandDecimals(2643, 18))
    expect(await rewardTracker.depositBalances(user1.address, esGs.target)).lt(expandDecimals(2645, 18))

    expect(await bonusTracker.stakedAmounts(user1.address)).gt(expandDecimals(3343, 18))
    expect(await bonusTracker.stakedAmounts(user1.address)).lt(expandDecimals(3345, 18))

    expect(await feeTracker.stakedAmounts(user1.address)).gt(expandDecimals(3357, 18))
    expect(await feeTracker.stakedAmounts(user1.address)).lt(expandDecimals(3359, 18))
    expect(await feeTracker.depositBalances(user1.address, bonusTracker.target)).gt(expandDecimals(3343, 18))
    expect(await feeTracker.depositBalances(user1.address, bonusTracker.target)).lt(expandDecimals(3345, 18))
    expect(await feeTracker.depositBalances(user1.address, bnGs.target)).gt("13000000000000000000") // 13
    expect(await feeTracker.depositBalances(user1.address, bnGs.target)).lt("13100000000000000000") // 13.1

    const esGsBalance1 = await esGs.balanceOf(user1.address)
    const esGsUnstakeBalance1 = await rewardTracker.depositBalances(user1.address, esGs.target)
    await expect(stakingRouter.connect(user1).unstakeEsGs(esGsUnstakeBalance1))
      .to.emit(stakingRouter, "UnstakedGs")
      .withArgs(user1.address, esGs.target, esGsUnstakeBalance1)

    expect(await esGs.balanceOf(user1.address)).eq(esGsBalance1 + esGsUnstakeBalance1)
    expect(await rewardTracker.stakedAmounts(user1.address)).eq(expandDecimals(700, 18))
    expect(await rewardTracker.depositBalances(user1.address, gs.target)).eq(expandDecimals(700, 18))
    expect(await rewardTracker.depositBalances(user1.address, esGs.target)).eq(0)

    expect(await bonusTracker.stakedAmounts(user1.address)).eq(expandDecimals(700, 18))

    expect(await feeTracker.stakedAmounts(user1.address)).gt(expandDecimals(702, 18))
    expect(await feeTracker.stakedAmounts(user1.address)).lt(expandDecimals(703, 18))
    expect(await feeTracker.depositBalances(user1.address, bonusTracker.target)).eq(expandDecimals(700, 18))
    expect(await feeTracker.depositBalances(user1.address, bnGs.target)).gt("2720000000000000000") // 2.72
    expect(await feeTracker.depositBalances(user1.address, bnGs.target)).lt("2740000000000000000") // 2.74

    await expect(stakingRouter.connect(user1).unstakeEsGs(expandDecimals(1, 18)))
      .to.be.revertedWith("RewardTracker: _amount exceeds depositBalance")/**/
  })

  it("stakeLpForAccount, stakeLp, unstakeLpForAccount, unstakeLp, claimPool", async () => {
    const [,, manager, user0, user1] = await ethers.getSigners();
    const {
      rewardTracker: poolRewardTracker,
      rewardDistributor: poolRewardDistributor
    } = await poolTrackers(stakingRouter, gsPool.target.toString(), esGs.target.toString(), (await stakingRouter.esGsb()).toString())
    await poolRewardDistributor.connect(routerAsSigner).setTokensPerInterval("20667989410000000")
    await poolRewardDistributor.connect(routerAsSigner).setPaused(false)
    await esGs.mint(poolRewardDistributor, expandDecimals(50000, 18));

    await gsPool.mint(user0, expandDecimals(1000, 18));
    await gsPool.mint(user1, expandDecimals(1000, 18));
    await gsPool.mint(manager, expandDecimals(1000, 18));
    await gsPool.mint(stakingRouter.target, expandDecimals(1000, 18));

    await gsPool.connect(user0).approve(poolRewardTracker, expandDecimals(1000, 18));
    // await gsPool.connect(user1).approve(poolRewardTracker, expandDecimals(1000, 18));
    await gsPool.connect(manager).approve(poolRewardTracker, expandDecimals(1000, 18));

    await expect(stakingRouter.connect(user1).stakeLpForAccount(user0, gsPool, esGs.target, expandDecimals(1000, 18)))
      .to.be.revertedWith("StakingRouter: forbidden");
    await expect(stakingRouter.connect(user0).stakeLp(ethers.ZeroAddress, ethers.ZeroAddress, expandDecimals(1000, 18)))
      .to.be.revertedWith("StakingRouter: pool tracker not found")
    await expect(stakingRouter.connect(user0).stakeLp(gsPool, esGs.target, expandDecimals(1000, 18)))
      .to.emit(stakingRouter, "StakedLp")
      .withArgs(user0.address, gsPool.target, expandDecimals(1000, 18))

    await expect(stakingRouter.connect(manager).stakeLpForAccount(user1, ethers.ZeroAddress, ethers.ZeroAddress, expandDecimals(1000, 18)))
      .to.be.revertedWith("StakingRouter: pool tracker not found")
    await stakingRouter.connect(manager).stakeLpForAccount(user1, gsPool, esGs.target, expandDecimals(1000, 18));
    expect(await poolRewardTracker.balanceOf(user0)).eq(expandDecimals(1000, 18));
    expect(await poolRewardTracker.stakedAmounts(user0)).eq(expandDecimals(1000, 18));
    expect(await poolRewardTracker.depositBalances(user0, gsPool)).eq(expandDecimals(1000, 18));
    expect(await poolRewardTracker.balanceOf(user1)).eq(expandDecimals(1000, 18));
    expect(await poolRewardTracker.stakedAmounts(user1)).eq(expandDecimals(1000, 18));
    expect(await poolRewardTracker.depositBalances(user1, gsPool)).eq(expandDecimals(1000, 18));

    await increase(24 * 60 * 60)

    expect(await poolRewardTracker.claimable(user0)).gt(expandDecimals(892, 18));
    expect(await poolRewardTracker.claimable(user0)).lt(expandDecimals(893, 18));
    expect(await poolRewardTracker.claimable(user1)).gt(expandDecimals(892, 18));
    expect(await poolRewardTracker.claimable(user1)).lt(expandDecimals(893, 18));

    await gsPool.mint(user0, expandDecimals(1000, 18));
    await gsPool.connect(user0).approve(poolRewardTracker, expandDecimals(1000, 18));
    await stakingRouter.connect(user0).stakeLp(gsPool, esGs.target, expandDecimals(1000, 18));
    await expect(stakingRouter.unstakeLpForAccount(user1, gsPool, esGs.target, expandDecimals(500, 18)))
      .to.emit(stakingRouter, "UnstakedLp")
      .withArgs(user1.address, gsPool.target, expandDecimals(500, 18))

    await increase(24 * 60 * 60)

    expect(await poolRewardTracker.claimable(user0)).gt(expandDecimals(892 + 1428, 18));
    expect(await poolRewardTracker.claimable(user0)).lt(expandDecimals(893 + 1429, 18));
    expect(await poolRewardTracker.claimable(user1)).gt(expandDecimals(892 + 357, 18));
    expect(await poolRewardTracker.claimable(user1)).lt(expandDecimals(893 + 358, 18));
    expect(await stakingRouter.getAverageStakedAmount(gsPool.target, esGs.target, user0.address)).eq(expandDecimals(1000, 18));
    expect(await stakingRouter.getAverageStakedAmount(gsPool.target, esGs.target, user1.address)).eq(expandDecimals(1000, 18));

    await stakingRouter.connect(user0).unstakeLp(gsPool, esGs.target, expandDecimals(1000, 18));
    expect(await poolRewardTracker.balanceOf(user0)).eq(expandDecimals(1000, 18));
    expect(await poolRewardTracker.stakedAmounts(user0)).eq(expandDecimals(1000, 18));
    expect(await poolRewardTracker.depositBalances(user0, gsPool)).eq(expandDecimals(1000, 18));
    expect(await poolRewardTracker.balanceOf(user1)).eq(expandDecimals(500, 18));
    expect(await poolRewardTracker.stakedAmounts(user1)).eq(expandDecimals(500, 18));
    expect(await poolRewardTracker.depositBalances(user1, gsPool)).eq(expandDecimals(500, 18));

    // Try with unregistered pool
    await expect(stakingRouter.connect(user0).claimPool(ethers.ZeroAddress, ethers.ZeroAddress, true, true))
      .to.rejectedWith("StakingRouter: pool tracker not found")
    await expect(stakingRouter.connect(user0).claimPool(ethers.ZeroAddress, ethers.ZeroAddress, false, true))
      .to.rejectedWith("StakingRouter: pool vester not found")

    await stakingRouter.connect(user0).claimPool(gsPool, esGs.target, true, true);
    await stakingRouter.connect(user1).claimPool(gsPool, esGs.target, true, true);
  
    expect(await esGs.balanceOf(user0)).gt(expandDecimals(892 + 1428, 18));
    expect(await esGs.balanceOf(user0)).lt(expandDecimals(893 + 1429, 18));
    expect(await esGs.balanceOf(user1)).gt(expandDecimals(892 + 357, 18));
    expect(await esGs.balanceOf(user1)).lt(expandDecimals(893 + 358, 18));
    expect(await stakingRouter.getAverageStakedAmount(gsPool.target, esGs.target, user0.address)).gt(expandDecimals(1615, 18));
    expect(await stakingRouter.getAverageStakedAmount(gsPool.target, esGs.target, user0.address)).lt(expandDecimals(1616, 18));
    expect(await stakingRouter.getAverageStakedAmount(gsPool.target, esGs.target, user1.address)).gt(expandDecimals(857, 18));
    expect(await stakingRouter.getAverageStakedAmount(gsPool.target, esGs.target, user1.address)).lt(expandDecimals(858, 18));
  })

  it("vestEsGs, vestEsTokenForPool, withdrawEsGs, withdrawEsTokenForPool", async () => {
    const [,,, user0, user1] = await ethers.getSigners();
    const {
      vester: poolVester
    } = await poolTrackers(stakingRouter, gsPool.target.toString(), esGs.target.toString(), (await stakingRouter.esGsb()).toString())
    await gs.mint(vester, expandDecimals(1000, 18))
    await gs.mint(poolVester, expandDecimals(1000, 18))

    await esGs.mint(user0, expandDecimals(1000, 18));
    await esGs.mint(user1, expandDecimals(1000, 18));
    await esGs.connect(user0).approve(vester, expandDecimals(1000, 18));
    await esGs.connect(user1).approve(poolVester, expandDecimals(1000, 18));

    await expect(stakingRouter.connect(user0).vestEsGs(expandDecimals(1000, 18)))
      .to.be.revertedWith("Vester: max vestable amount exceeded");
    await vester.connect(routerAsSigner).setBonusRewards(user0, expandDecimals(1000, 18));
    await stakingRouter.connect(user0).vestEsGs(expandDecimals(1000, 18));

    await expect(stakingRouter.connect(user1).vestEsTokenForPool(ethers.ZeroAddress, ethers.ZeroAddress, expandDecimals(1000, 18)))
      .to.be.revertedWith("StakingRouter: pool vester not found");
    await expect(stakingRouter.connect(user1).vestEsTokenForPool(gsPool, esGs.target, expandDecimals(1000, 18)))
      .to.be.revertedWith("Vester: max vestable amount exceeded");
    await poolVester.connect(routerAsSigner).setBonusRewards(user1, expandDecimals(1000, 18));
    await stakingRouter.connect(user1).vestEsTokenForPool(gsPool, esGs.target, expandDecimals(1000, 18));

    await increase(30 * 24 * 60 * 60)

    await stakingRouter.connect(user0).withdrawEsGs();
    await expect(stakingRouter.connect(user1).withdrawEsTokenForPool(ethers.ZeroAddress, ethers.ZeroAddress))
      .to.rejectedWith("StakingRouter: pool vester not found");

    await stakingRouter.connect(user1).withdrawEsTokenForPool(gsPool, esGs.target);
    expect(await gs.balanceOf(user0)).gt(expandDecimals(82, 18))  // 1000 * 30 / 365 -> 82.19
    expect(await gs.balanceOf(user0)).lt(expandDecimals(83, 18))
    expect(await gs.balanceOf(user1)).gt(expandDecimals(82, 18))
    expect(await gs.balanceOf(user1)).lt(expandDecimals(83, 18))
  })
})
