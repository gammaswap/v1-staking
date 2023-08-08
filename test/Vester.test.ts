import { ethers } from 'hardhat';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { PANIC_CODES } from '@nomicfoundation/hardhat-chai-matchers/panic';
import { expect } from 'chai';
import { setup, coreTrackers } from './utils/deploy';
import { increase, latest } from './utils/time'
import { expandDecimals } from './utils/bignumber';
import { impersonateAndFund } from './utils/misc';
import { BonusDistributor, ERC20, FeeTracker, GS, RestrictedToken, RewardDistributor, RewardTracker, StakingRouter, Vester } from '../typechain-types';

const secondsPerYear = 365 * 24 * 60 * 60
const AddressZero = ethers.ZeroAddress

describe('Vester', function() {
  let gs: GS
  let esGs: RestrictedToken
  let bnGs: RestrictedToken
  let weth: ERC20
  let rewardTracker: RewardTracker
  let rewardDistributor: RewardDistributor
  let bonusTracker: RewardTracker
  let bonusDistributor: BonusDistributor
  let feeTracker: FeeTracker
  let vester: Vester
  let stakingRouter: StakingRouter
  let routerAsSigner: HardhatEthersSigner

  beforeEach(async () => {
    const [deployer] = await ethers.getSigners()
    const baseContracts = await loadFixture(setup);
    gs = baseContracts.gs;
    esGs = baseContracts.esGs;
    bnGs = baseContracts.bnGs;
    weth = baseContracts.weth;

    await esGs.setHandler(deployer.address, true)
    await gs.setHandler(deployer.address, true)

    stakingRouter = baseContracts.stakingRouter
    routerAsSigner = await impersonateAndFund(stakingRouter.target.toString());

    const coreTracker = await coreTrackers(stakingRouter);
    rewardTracker = coreTracker.rewardTracker;
    rewardDistributor = coreTracker.rewardDistributor;
    bonusTracker = coreTracker.bonusTracker;
    bonusDistributor = coreTracker.bonusDistributor;
    feeTracker = coreTracker.feeTracker;
    vester = coreTracker.vester;
  })

  it("inits", async () => {
    expect(await vester.name()).eq("Vested gs")
    expect(await vester.symbol()).eq("vegs")
    expect(await vester.vestingDuration()).eq(secondsPerYear)
    expect(await vester.esToken()).eq(esGs.target)
    expect(await vester.pairToken()).eq(AddressZero)
    expect(await vester.claimableToken()).eq(gs.target)
    expect(await vester.rewardTracker()).eq(AddressZero)
    expect(await vester.hasPairToken()).eq(false)
    expect(await vester.hasRewardTracker()).eq(false)
    expect(await vester.hasMaxVestableAmount()).eq(false)
  })

  it("setCumulativeRewardDeductions", async () => {
    const [deployer, user0] = await ethers.getSigners()
    await expect(vester.setCumulativeRewardDeductions(user0.address, 200))
      .to.be.revertedWith("Vester: forbidden")

    await vester.setHandler(deployer.address, true)

    expect(await vester.cumulativeRewardDeductions(user0.address)).eq(0)
    await vester.setCumulativeRewardDeductions(user0.address, 200)
    expect(await vester.cumulativeRewardDeductions(user0.address)).eq(200)
  })

  it("setBonusRewards", async () => {
    const [deployer, user0] = await ethers.getSigners()
    await expect(vester.setBonusRewards(user0.address, 200))
      .to.be.revertedWith("Vester: forbidden")

    await vester.setHandler(deployer.address, true)

    expect(await vester.bonusRewards(user0.address)).eq(0)
    await vester.setBonusRewards(user0.address, 200)
    expect(await vester.bonusRewards(user0.address)).eq(200)
  })

  it("deposit, claim, withdraw", async () => {
    const [deployer, user0] = await ethers.getSigners()
    await esGs.setHandler(vester.target, true)

    await expect(vester.connect(user0).deposit(0))
      .to.be.revertedWith("Vester: invalid _amount")

    await expect(vester.connect(user0).deposit(expandDecimals(1000, 18)))
      .to.be.revertedWith("BaseToken: transfer amount exceeds allowance")

    await esGs.connect(user0).approve(vester.target, expandDecimals(1000, 18))

    await expect(vester.connect(user0).deposit(expandDecimals(1000, 18)))
      .to.be.revertedWith("BaseToken: transfer amount exceeds balance")

    expect(await vester.balanceOf(user0.address)).eq(0)
    expect(await vester.getTotalVested(user0.address)).eq(0)
    expect(await vester.cumulativeClaimAmounts(user0.address)).eq(0)
    expect(await vester.claimedAmounts(user0.address)).eq(0)
    expect(await vester.claimable(user0.address)).eq(0)
    expect(await vester.pairAmounts(user0.address)).eq(0)
    expect(await vester.lastVestingTimes(user0.address)).eq(0)

    await esGs.mint(user0.address, expandDecimals(1000, 18))
    await vester.connect(user0).deposit(expandDecimals(1000, 18))

    let blockTime = await latest();

    expect(await vester.balanceOf(user0.address)).eq(expandDecimals(1000, 18))
    expect(await vester.getTotalVested(user0.address)).eq(expandDecimals(1000, 18))
    expect(await vester.cumulativeClaimAmounts(user0.address)).eq(0)
    expect(await vester.claimedAmounts(user0.address)).eq(0)
    expect(await vester.claimable(user0.address)).eq(0)
    expect(await vester.pairAmounts(user0.address)).eq(0)
    expect(await vester.lastVestingTimes(user0.address)).eq(blockTime)

    await increase(24 * 60 * 60)

    expect(await esGs.balanceOf(user0.address)).eq(0)
    expect(await gs.balanceOf(user0.address)).eq(0)
    expect(await vester.balanceOf(user0.address)).eq(expandDecimals(1000, 18))
    expect(await vester.getTotalVested(user0.address)).eq(expandDecimals(1000, 18))
    expect(await vester.cumulativeClaimAmounts(user0.address)).eq(0)
    expect(await vester.claimedAmounts(user0.address)).eq(0)
    expect(await vester.claimable(user0.address)).gt("2730000000000000000") // 1000 / 365 => ~2.739
    expect(await vester.claimable(user0.address)).lt("2750000000000000000")
    expect(await vester.pairAmounts(user0.address)).eq(0)
    expect(await vester.lastVestingTimes(user0.address)).eq(blockTime)

    await expect(vester.connect(user0).claim())
      .to.be.revertedWith("BaseToken: transfer amount exceeds balance")

    await gs.mint(vester.target, expandDecimals(2000, 18))

    await vester.connect(user0).claim()
    blockTime = await latest()

    expect(await esGs.balanceOf(user0.address)).eq(0)
    expect(await gs.balanceOf(user0.address)).gt("2730000000000000000")
    expect(await gs.balanceOf(user0.address)).lt("2750000000000000000")

    let gsAmount = await gs.balanceOf(user0.address)
    expect(await vester.balanceOf(user0.address)).eq(expandDecimals(1000, 18) - gsAmount)

    expect(await vester.getTotalVested(user0.address)).eq(expandDecimals(1000, 18))
    expect(await vester.cumulativeClaimAmounts(user0.address)).eq(gsAmount)
    expect(await vester.claimedAmounts(user0.address)).eq(gsAmount)
    expect(await vester.claimable(user0.address)).eq(0)
    expect(await vester.pairAmounts(user0.address)).eq(0)
    expect(await vester.lastVestingTimes(user0.address)).eq(blockTime)

    await increase(48 * 60 * 60)

    expect(await vester.cumulativeClaimAmounts(user0.address)).eq(gsAmount)
    expect(await vester.claimedAmounts(user0.address)).eq(gsAmount)
    expect(await vester.claimable(user0.address)).gt("5478000000000000000") // 1000 / 365 * 2 => ~5.479
    expect(await vester.claimable(user0.address)).lt("5480000000000000000")

    await increase(Math.floor(Number(365 / 2 - 1)) * 24 * 60 * 60)

    expect(await vester.cumulativeClaimAmounts(user0.address)).eq(gsAmount)
    expect(await vester.claimedAmounts(user0.address)).eq(gsAmount)
    expect(await vester.claimable(user0.address)).gt(expandDecimals(500, 18)) // 1000 / 2 => 500
    expect(await vester.claimable(user0.address)).lt(expandDecimals(502, 18))

    await vester.connect(user0).claim()
    blockTime = await latest()

    expect(await esGs.balanceOf(user0.address)).eq(0)
    expect(await gs.balanceOf(user0.address)).gt(expandDecimals(503, 18))
    expect(await gs.balanceOf(user0.address)).lt(expandDecimals(505, 18))

    gsAmount = await gs.balanceOf(user0.address)
    expect(await vester.balanceOf(user0.address)).eq(expandDecimals(1000, 18) - gsAmount)

    expect(await vester.getTotalVested(user0.address)).eq(expandDecimals(1000, 18))
    expect(await vester.cumulativeClaimAmounts(user0.address)).eq(gsAmount)
    expect(await vester.claimedAmounts(user0.address)).eq(gsAmount)
    expect(await vester.claimable(user0.address)).eq(0)
    expect(await vester.pairAmounts(user0.address)).eq(0)
    expect(await vester.lastVestingTimes(user0.address)).eq(blockTime)

    await increase(24 * 60 * 60)

    // vesting rate should be the same even after claiming
    expect(await vester.claimable(user0.address)).gt("2730000000000000000") // 1000 / 365 => ~2.739
    expect(await vester.claimable(user0.address)).lt("2750000000000000000")

    await esGs.mint(user0.address, expandDecimals(500, 18))
    await esGs.connect(user0).approve(vester.target, expandDecimals(500, 18))
    await vester.connect(user0).deposit(expandDecimals(500, 18))

    await increase(24 * 60 * 60)

    expect(await vester.claimable(user0.address)).gt("6840000000000000000") // 1000 / 365 + 1500 / 365 => 6.849
    expect(await vester.claimable(user0.address)).lt("6860000000000000000")

    expect(await esGs.balanceOf(user0.address)).eq(0)
    expect(await gs.balanceOf(user0.address)).eq(gsAmount)

    await vester.connect(user0).withdraw()

    expect(await esGs.balanceOf(user0.address)).gt(expandDecimals(989, 18))
    expect(await esGs.balanceOf(user0.address)).lt(expandDecimals(990, 18))
    expect(await gs.balanceOf(user0.address)).gt(expandDecimals(510, 18))
    expect(await gs.balanceOf(user0.address)).lt(expandDecimals(512, 18))

    expect(await vester.balanceOf(user0.address)).eq(0)
    expect(await vester.getTotalVested(user0.address)).eq(0)
    expect(await vester.cumulativeClaimAmounts(user0.address)).eq(0)
    expect(await vester.claimedAmounts(user0.address)).eq(0)
    expect(await vester.claimable(user0.address)).eq(0)
    expect(await vester.pairAmounts(user0.address)).eq(0)
    expect(await vester.lastVestingTimes(user0.address)).eq(0)

    await esGs.connect(user0).approve(vester.target, expandDecimals(1000, 18))
    await esGs.mint(user0.address, expandDecimals(1000, 18))
    await vester.connect(user0).deposit(expandDecimals(1000, 18))

    blockTime = await latest()

    await increase(24 * 60 * 60)

    expect(await vester.balanceOf(user0.address)).eq(expandDecimals(1000, 18))
    expect(await vester.getTotalVested(user0.address)).eq(expandDecimals(1000, 18))
    expect(await vester.cumulativeClaimAmounts(user0.address)).eq(0)
    expect(await vester.claimedAmounts(user0.address)).eq(0)
    expect(await vester.claimable(user0.address)).gt("2730000000000000000") // 1000 / 365 => ~2.739
    expect(await vester.claimable(user0.address)).lt("2750000000000000000")
    expect(await vester.pairAmounts(user0.address)).eq(0)
    expect(await vester.lastVestingTimes(user0.address)).eq(blockTime)

    await vester.connect(user0).claim()
  })

  it("depositForAccount, claimForAccount", async () => {
    const [deployer, user0, user1, user2, user3, user4] = await ethers.getSigners()
    await esGs.setHandler(vester.target, true)
    await vester.setHandler(deployer.address, true)

    await esGs.connect(user0).approve(vester.target, expandDecimals(1000, 18))

    expect(await vester.balanceOf(user0.address)).eq(0)
    expect(await vester.getTotalVested(user0.address)).eq(0)
    expect(await vester.cumulativeClaimAmounts(user0.address)).eq(0)
    expect(await vester.claimedAmounts(user0.address)).eq(0)
    expect(await vester.claimable(user0.address)).eq(0)
    expect(await vester.pairAmounts(user0.address)).eq(0)
    expect(await vester.lastVestingTimes(user0.address)).eq(0)

    await esGs.mint(user0.address, expandDecimals(1000, 18))

    await expect(vester.connect(user2).depositForAccount(user0.address, expandDecimals(1000, 18)))
      .to.be.revertedWith("Vester: forbidden")

    await vester.setHandler(user2.address, true)
    await vester.connect(user2).depositForAccount(user0.address, expandDecimals(1000, 18))

    let blockTime = await latest()

    expect(await vester.balanceOf(user0.address)).eq(expandDecimals(1000, 18))
    expect(await vester.getTotalVested(user0.address)).eq(expandDecimals(1000, 18))
    expect(await vester.cumulativeClaimAmounts(user0.address)).eq(0)
    expect(await vester.claimedAmounts(user0.address)).eq(0)
    expect(await vester.claimable(user0.address)).eq(0)
    expect(await vester.pairAmounts(user0.address)).eq(0)
    expect(await vester.lastVestingTimes(user0.address)).eq(blockTime)

    await increase(24 * 60 * 60)

    expect(await esGs.balanceOf(user0.address)).eq(0)
    expect(await gs.balanceOf(user0.address)).eq(0)
    expect(await vester.balanceOf(user0.address)).eq(expandDecimals(1000, 18))
    expect(await vester.getTotalVested(user0.address)).eq(expandDecimals(1000, 18))
    expect(await vester.cumulativeClaimAmounts(user0.address)).eq(0)
    expect(await vester.claimedAmounts(user0.address)).eq(0)
    expect(await vester.claimable(user0.address)).gt("2730000000000000000") // 1000 / 365 => ~2.739
    expect(await vester.claimable(user0.address)).lt("2750000000000000000")
    expect(await vester.pairAmounts(user0.address)).eq(0)
    expect(await vester.lastVestingTimes(user0.address)).eq(blockTime)

    await expect(vester.connect(user0).claim())
      .to.be.revertedWith("BaseToken: transfer amount exceeds balance")

    await gs.mint(vester.target, expandDecimals(2000, 18))

    await expect(vester.connect(user3).claimForAccount(user0.address, user4.address))
      .to.be.revertedWith("Vester: forbidden")

    await vester.setHandler(user3.address, true)

    await vester.connect(user3).claimForAccount(user0.address, user4.address)
    blockTime = await latest()

    expect(await esGs.balanceOf(user4.address)).eq(0)
    expect(await gs.balanceOf(user4.address)).gt("2730000000000000000")
    expect(await gs.balanceOf(user4.address)).lt("2750000000000000000")

    expect(await esGs.balanceOf(user0.address)).eq(0)
    expect(await gs.balanceOf(user0.address)).eq(0)
    expect(await vester.balanceOf(user0.address)).gt(expandDecimals(996, 18))
    expect(await vester.balanceOf(user0.address)).lt(expandDecimals(998, 18))
    expect(await vester.getTotalVested(user0.address)).eq(expandDecimals(1000, 18))
    expect(await vester.cumulativeClaimAmounts(user0.address)).gt("2730000000000000000")
    expect(await vester.cumulativeClaimAmounts(user0.address)).lt("2750000000000000000")
    expect(await vester.claimedAmounts(user0.address)).gt("2730000000000000000")
    expect(await vester.claimedAmounts(user0.address)).lt("2750000000000000000")
    expect(await vester.claimable(user0.address)).eq(0)
    expect(await vester.pairAmounts(user0.address)).eq(0)
    expect(await vester.lastVestingTimes(user0.address)).eq(blockTime)
  })

  it("handles multiple deposits", async () => {
    const [deployer, user0] = await ethers.getSigners()
    await esGs.setHandler(vester.target, true)
    await vester.setHandler(deployer.address, true)

    await esGs.connect(user0).approve(vester.target, expandDecimals(1000, 18))

    expect(await vester.balanceOf(user0.address)).eq(0)
    expect(await vester.getTotalVested(user0.address)).eq(0)
    expect(await vester.cumulativeClaimAmounts(user0.address)).eq(0)
    expect(await vester.claimedAmounts(user0.address)).eq(0)
    expect(await vester.claimable(user0.address)).eq(0)
    expect(await vester.pairAmounts(user0.address)).eq(0)
    expect(await vester.lastVestingTimes(user0.address)).eq(0)

    await esGs.mint(user0.address, expandDecimals(1000, 18))
    await vester.connect(user0).deposit(expandDecimals(1000, 18))

    let blockTime = await latest()

    expect(await vester.balanceOf(user0.address)).eq(expandDecimals(1000, 18))
    expect(await vester.getTotalVested(user0.address)).eq(expandDecimals(1000, 18))
    expect(await vester.cumulativeClaimAmounts(user0.address)).eq(0)
    expect(await vester.claimedAmounts(user0.address)).eq(0)
    expect(await vester.claimable(user0.address)).eq(0)
    expect(await vester.pairAmounts(user0.address)).eq(0)
    expect(await vester.lastVestingTimes(user0.address)).eq(blockTime)

    await increase(24 * 60 * 60)

    expect(await esGs.balanceOf(user0.address)).eq(0)
    expect(await gs.balanceOf(user0.address)).eq(0)
    expect(await vester.balanceOf(user0.address)).eq(expandDecimals(1000, 18))
    expect(await vester.getTotalVested(user0.address)).eq(expandDecimals(1000, 18))
    expect(await vester.cumulativeClaimAmounts(user0.address)).eq(0)
    expect(await vester.claimedAmounts(user0.address)).eq(0)
    expect(await vester.claimable(user0.address)).gt("2730000000000000000") // 1000 / 365 => ~2.739
    expect(await vester.claimable(user0.address)).lt("2750000000000000000")
    expect(await vester.pairAmounts(user0.address)).eq(0)
    expect(await vester.lastVestingTimes(user0.address)).eq(blockTime)

    await expect(vester.connect(user0).claim())
      .to.be.revertedWith("BaseToken: transfer amount exceeds balance")

    await gs.mint(vester.target, expandDecimals(2000, 18))

    await increase(24 * 60 * 60)

    expect(await vester.balanceOf(user0.address)).eq(expandDecimals(1000, 18))

    await esGs.mint(user0.address, expandDecimals(500, 18))
    await esGs.connect(user0).approve(vester.target, expandDecimals(500, 18))
    await vester.connect(user0).deposit(expandDecimals(500, 18))
    blockTime = await latest()

    expect(await vester.balanceOf(user0.address)).gt(expandDecimals(1494, 18))
    expect(await vester.balanceOf(user0.address)).lt(expandDecimals(1496, 18))
    expect(await vester.getTotalVested(user0.address)).eq(expandDecimals(1500, 18))
    expect(await vester.cumulativeClaimAmounts(user0.address)).gt("5470000000000000000") // 5.47, 1000 / 365 * 2 => ~5.48
    expect(await vester.cumulativeClaimAmounts(user0.address)).lt("5490000000000000000") // 5.49
    expect(await vester.claimedAmounts(user0.address)).eq(0)
    expect(await vester.claimable(user0.address)).gt("5470000000000000000")
    expect(await vester.claimable(user0.address)).lt("5490000000000000000")
    expect(await vester.pairAmounts(user0.address)).eq(0)
    expect(await vester.lastVestingTimes(user0.address)).eq(blockTime)

    await vester.connect(user0).withdraw()

    expect(await esGs.balanceOf(user0.address)).gt(expandDecimals(1494, 18))
    expect(await esGs.balanceOf(user0.address)).lt(expandDecimals(1496, 18))
    expect(await gs.balanceOf(user0.address)).gt("5470000000000000000")
    expect(await gs.balanceOf(user0.address)).lt("5490000000000000000")
    expect(await vester.balanceOf(user0.address)).eq(0)
    expect(await vester.getTotalVested(user0.address)).eq(0)
    expect(await vester.cumulativeClaimAmounts(user0.address)).eq(0) // 5.47, 1000 / 365 * 2 => ~5.48
    expect(await vester.claimedAmounts(user0.address)).eq(0)
    expect(await vester.claimable(user0.address)).eq(0)
    expect(await vester.pairAmounts(user0.address)).eq(0)
    expect(await vester.lastVestingTimes(user0.address)).eq(0)
  })

  it("handles pairing", async () => {
    const [wallet, user0, user1, user2, user3, user4] = await ethers.getSigners()

    // await esGs.setHandler(wallet.address, true)
    await esGs.mint(rewardDistributor.target, expandDecimals(50000 * 12, 18))
    await rewardDistributor.connect(routerAsSigner).setTokensPerInterval("20667989410000000") // 0.02066798941 esGmx per second

    await bonusDistributor.connect(routerAsSigner).setBonusMultiplier(10000)
    // allow stakedGmxTracker to stake esGmx
    await esGs.setHandler(stakedGmxTracker.address, true)
    // allow feeGmxTracker to stake bnGmx
    await bnGmx.setHandler(feeGmxTracker.address, true)
    // allow rewardRouter to burn bnGmx
    await bnGmx.setMinter(rewardRouter.address, true)

    const vester = await deployContract("Vester", [
      "Vested GMX",
      "veGMX",
      secondsPerYear,
      esGmx.address,
      feeGmxTracker.address,
      gmx.address,
      stakedGmxTracker.address
    ])
    await esGmx.setMinter(vester.address, true)
    await vester.setHandler(wallet.address, true)

    expect(await vester.name()).eq("Vested GMX")
    expect(await vester.symbol()).eq("veGMX")
    expect(await vester.vestingDuration()).eq(secondsPerYear)
    expect(await vester.esToken()).eq(esGmx.address)
    expect(await vester.pairToken()).eq(feeGmxTracker.address)
    expect(await vester.claimableToken()).eq(gmx.address)
    expect(await vester.rewardTracker()).eq(stakedGmxTracker.address)
    expect(await vester.hasPairToken()).eq(true)
    expect(await vester.hasRewardTracker()).eq(true)
    expect(await vester.hasMaxVestableAmount()).eq(true)

    // allow vester to transfer feeGmxTracker tokens
    await feeGmxTracker.setHandler(vester.address, true)
    // allow vester to transfer esGmx tokens
    await esGmx.setHandler(vester.address, true)

    await gmx.mint(vester.address, expandDecimals(2000, 18))

    await gmx.mint(user0.address, expandDecimals(1000, 18))
    await gmx.mint(user1.address, expandDecimals(500, 18))
    await gmx.connect(user0).approve(stakedGmxTracker.address, expandDecimals(1000, 18))
    await gmx.connect(user1).approve(stakedGmxTracker.address, expandDecimals(500, 18))

    await rewardRouter.connect(user0).stakeGmx(expandDecimals(1000, 18))
    await rewardRouter.connect(user1).stakeGmx(expandDecimals(500, 18))

    await increaseTime(provider, 24 * 60 * 60)
    await mineBlock(provider)

    expect(await stakedGmxTracker.claimable(user0.address)).gt(expandDecimals(1190, 18))
    expect(await stakedGmxTracker.claimable(user0.address)).lt(expandDecimals(1191, 18))
    expect(await stakedGmxTracker.claimable(user1.address)).gt(expandDecimals(594, 18))
    expect(await stakedGmxTracker.claimable(user1.address)).lt(expandDecimals(596, 18))

    expect(await vester.getMaxVestableAmount(user0.address)).eq(0)
    expect(await vester.getMaxVestableAmount(user1.address)).eq(0)

    expect(await esGmx.balanceOf(user0.address)).eq(0)
    expect(await esGmx.balanceOf(user1.address)).eq(0)
    expect(await esGmx.balanceOf(user2.address)).eq(0)
    expect(await esGmx.balanceOf(user3.address)).eq(0)

    await stakedGmxTracker.connect(user0).claim(user2.address)
    await stakedGmxTracker.connect(user1).claim(user3.address)

    expect(await esGmx.balanceOf(user0.address)).eq(0)
    expect(await esGmx.balanceOf(user1.address)).eq(0)
    expect(await esGmx.balanceOf(user2.address)).gt(expandDecimals(1190, 18))
    expect(await esGmx.balanceOf(user2.address)).lt(expandDecimals(1191, 18))
    expect(await esGmx.balanceOf(user3.address)).gt(expandDecimals(594, 18))
    expect(await esGmx.balanceOf(user3.address)).lt(expandDecimals(596, 18))

    expect(await vester.getMaxVestableAmount(user0.address)).gt(expandDecimals(1190, 18))
    expect(await vester.getMaxVestableAmount(user0.address)).lt(expandDecimals(1191, 18))
    expect(await vester.getMaxVestableAmount(user1.address)).gt(expandDecimals(594, 18))
    expect(await vester.getMaxVestableAmount(user1.address)).lt(expandDecimals(596, 18))
    expect(await vester.getMaxVestableAmount(user2.address)).eq(0)
    expect(await vester.getMaxVestableAmount(user3.address)).eq(0)

    expect(await vester.getPairAmount(user0.address, expandDecimals(1, 18))).gt("830000000000000000") // 0.83, 1000 / 1190 => ~0.84
    expect(await vester.getPairAmount(user0.address, expandDecimals(1, 18))).lt("850000000000000000") // 0.85
    expect(await vester.getPairAmount(user1.address, expandDecimals(1, 18))).gt("830000000000000000") // 0.83, 500 / 595 => ~0.84
    expect(await vester.getPairAmount(user1.address, expandDecimals(1, 18))).lt("850000000000000000") // 0.85
    expect(await vester.getPairAmount(user2.address, expandDecimals(1, 18))).eq(0)
    expect(await vester.getPairAmount(user3.address, expandDecimals(1, 18))).eq(0)

    await increaseTime(provider, 24 * 60 * 60)
    await mineBlock(provider)

    await stakedGmxTracker.connect(user0).claim(user2.address)
    await stakedGmxTracker.connect(user1).claim(user3.address)

    expect(await vester.getMaxVestableAmount(user0.address)).gt(expandDecimals(2380, 18))
    expect(await vester.getMaxVestableAmount(user0.address)).lt(expandDecimals(2382, 18))
    expect(await vester.getMaxVestableAmount(user1.address)).gt(expandDecimals(1189, 18))
    expect(await vester.getMaxVestableAmount(user1.address)).lt(expandDecimals(1191, 18))

    expect(await vester.getPairAmount(user0.address, expandDecimals(1, 18))).gt("410000000000000000") // 0.41, 1000 / 2380 => ~0.42
    expect(await vester.getPairAmount(user0.address, expandDecimals(1, 18))).lt("430000000000000000") // 0.43
    expect(await vester.getPairAmount(user1.address, expandDecimals(1, 18))).gt("410000000000000000") // 0.41, 1000 / 2380 => ~0.42
    expect(await vester.getPairAmount(user1.address, expandDecimals(1, 18))).lt("430000000000000000") // 0.43

    await esGmx.mint(user0.address, expandDecimals(2385, 18))
    await expect(vester.connect(user0).deposit(expandDecimals(2385, 18)))
      .to.be.revertedWith("RewardTracker: transfer amount exceeds balance")

    await gmx.mint(user0.address, expandDecimals(500, 18))
    await gmx.connect(user0).approve(stakedGmxTracker.address, expandDecimals(500, 18))
    await rewardRouter.connect(user0).stakeGmx(expandDecimals(500, 18))

    await expect(vester.connect(user0).deposit(expandDecimals(2385, 18)))
      .to.be.revertedWith("Vester: max vestable amount exceeded")

    await gmx.mint(user2.address, expandDecimals(1, 18))
    await expect(vester.connect(user2).deposit(expandDecimals(1, 18)))
      .to.be.revertedWith("Vester: max vestable amount exceeded")

    expect(await esGmx.balanceOf(user0.address)).eq(expandDecimals(2385, 18))
    expect(await esGmx.balanceOf(vester.address)).eq(0)
    expect(await feeGmxTracker.balanceOf(user0.address)).eq(expandDecimals(1500, 18))
    expect(await feeGmxTracker.balanceOf(vester.address)).eq(0)

    await vester.connect(user0).deposit(expandDecimals(2380, 18))

    expect(await esGmx.balanceOf(user0.address)).eq(expandDecimals(5, 18))
    expect(await esGmx.balanceOf(vester.address)).eq(expandDecimals(2380, 18))
    expect(await feeGmxTracker.balanceOf(user0.address)).gt(expandDecimals(499, 18))
    expect(await feeGmxTracker.balanceOf(user0.address)).lt(expandDecimals(501, 18))
    expect(await feeGmxTracker.balanceOf(vester.address)).gt(expandDecimals(999, 18))
    expect(await feeGmxTracker.balanceOf(vester.address)).lt(expandDecimals(1001, 18))

    await rewardRouter.connect(user1).unstakeGmx(expandDecimals(499, 18))

    await increaseTime(provider, 24 * 60 * 60)
    await mineBlock(provider)

    await stakedGmxTracker.connect(user0).claim(user2.address)
    await stakedGmxTracker.connect(user1).claim(user3.address)

    expect(await vester.getMaxVestableAmount(user0.address)).gt(expandDecimals(4164, 18))
    expect(await vester.getMaxVestableAmount(user0.address)).lt(expandDecimals(4166, 18))
    expect(await vester.getMaxVestableAmount(user1.address)).gt(expandDecimals(1190, 18))
    expect(await vester.getMaxVestableAmount(user1.address)).lt(expandDecimals(1192, 18))

    // (1000 * 2380 / 4164) + (1500 * 1784 / 4164) => 1214.21709894
    // 1214.21709894 / 4164 => ~0.29

    expect(await vester.getPairAmount(user0.address, expandDecimals(1, 18))).gt("280000000000000000") // 0.28
    expect(await vester.getPairAmount(user0.address, expandDecimals(1, 18))).lt("300000000000000000") // 0.30
    expect(await vester.getPairAmount(user1.address, expandDecimals(1, 18))).gt("410000000000000000") // 0.41, 1000 / 2380 => ~0.42
    expect(await vester.getPairAmount(user1.address, expandDecimals(1, 18))).lt("430000000000000000") // 0.43

    await increaseTime(provider, 30 * 24 * 60 * 60)
    await mineBlock(provider)

    await vester.connect(user0).withdraw()

    expect(await feeGmxTracker.balanceOf(user0.address)).eq(expandDecimals(1500, 18))
    expect(await gmx.balanceOf(user0.address)).gt(expandDecimals(201, 18)) // 2380 / 12 = ~198
    expect(await gmx.balanceOf(user0.address)).lt(expandDecimals(203, 18))
    expect(await esGmx.balanceOf(user0.address)).gt(expandDecimals(2182, 18)) // 5 + 2380 - 202  = 2183
    expect(await esGmx.balanceOf(user0.address)).lt(expandDecimals(2183, 18))
  })

  it("handles existing pair tokens", async () => {
    stakedGmxTracker = await deployContract("RewardTracker", ["Staked GMX", "sGMX"])
    stakedGmxDistributor = await deployContract("RewardDistributor", [esGmx.address, stakedGmxTracker.address])
    await stakedGmxTracker.initialize([gmx.address, esGmx.address], stakedGmxDistributor.address)
    await stakedGmxDistributor.updateLastDistributionTime()

    bonusGmxTracker = await deployContract("RewardTracker", ["Staked + Bonus GMX", "sbGMX"])
    bonusGmxDistributor = await deployContract("BonusDistributor", [bnGmx.address, bonusGmxTracker.address])
    await bonusGmxTracker.initialize([stakedGmxTracker.address], bonusGmxDistributor.address)
    await bonusGmxDistributor.updateLastDistributionTime()

    feeGmxTracker = await deployContract("RewardTracker", ["Staked + Bonus + Fee GMX", "sbfGMX"])
    feeGmxDistributor = await deployContract("RewardDistributor", [eth.address, feeGmxTracker.address])
    await feeGmxTracker.initialize([bonusGmxTracker.address, bnGmx.address], feeGmxDistributor.address)
    await feeGmxDistributor.updateLastDistributionTime()

    await stakedGmxTracker.setInPrivateTransferMode(true)
    await stakedGmxTracker.setInPrivateStakingMode(true)
    await bonusGmxTracker.setInPrivateTransferMode(true)
    await bonusGmxTracker.setInPrivateStakingMode(true)
    await bonusGmxTracker.setInPrivateClaimingMode(true)
    await feeGmxTracker.setInPrivateTransferMode(true)
    await feeGmxTracker.setInPrivateStakingMode(true)

    await esGmx.setMinter(wallet.address, true)
    await esGmx.mint(stakedGmxDistributor.address, expandDecimals(50000 * 12, 18))
    await stakedGmxDistributor.setTokensPerInterval("20667989410000000") // 0.02066798941 esGmx per second

    const rewardRouter = await deployContract("RewardRouter", [])
    await rewardRouter.initialize(
      eth.address,
      gmx.address,
      esGmx.address,
      bnGmx.address,
      AddressZero,
      stakedGmxTracker.address,
      bonusGmxTracker.address,
      feeGmxTracker.address,
      AddressZero,
      AddressZero,
      AddressZero
    )

    // allow rewardRouter to stake in stakedGmxTracker
    await stakedGmxTracker.setHandler(rewardRouter.address, true)
    // allow bonusGmxTracker to stake stakedGmxTracker
    await stakedGmxTracker.setHandler(bonusGmxTracker.address, true)
    // allow rewardRouter to stake in bonusGmxTracker
    await bonusGmxTracker.setHandler(rewardRouter.address, true)
    // allow bonusGmxTracker to stake feeGmxTracker
    await bonusGmxTracker.setHandler(feeGmxTracker.address, true)
    await bonusGmxDistributor.setBonusMultiplier(10000)
    // allow rewardRouter to stake in feeGmxTracker
    await feeGmxTracker.setHandler(rewardRouter.address, true)
    // allow stakedGmxTracker to stake esGmx
    await esGmx.setHandler(stakedGmxTracker.address, true)
    // allow feeGmxTracker to stake bnGmx
    await bnGmx.setHandler(feeGmxTracker.address, true)
    // allow rewardRouter to burn bnGmx
    await bnGmx.setMinter(rewardRouter.address, true)

    const vester = await deployContract("Vester", [
      "Vested GMX",
      "veGMX",
      secondsPerYear,
      esGmx.address,
      feeGmxTracker.address,
      gmx.address,
      stakedGmxTracker.address
    ])
    await esGmx.setMinter(vester.address, true)
    await vester.setHandler(wallet.address, true)

    expect(await vester.name()).eq("Vested GMX")
    expect(await vester.symbol()).eq("veGMX")
    expect(await vester.vestingDuration()).eq(secondsPerYear)
    expect(await vester.esToken()).eq(esGmx.address)
    expect(await vester.pairToken()).eq(feeGmxTracker.address)
    expect(await vester.claimableToken()).eq(gmx.address)
    expect(await vester.rewardTracker()).eq(stakedGmxTracker.address)
    expect(await vester.hasPairToken()).eq(true)
    expect(await vester.hasRewardTracker()).eq(true)
    expect(await vester.hasMaxVestableAmount()).eq(true)

    // allow vester to transfer feeGmxTracker tokens
    await feeGmxTracker.setHandler(vester.address, true)
    // allow vester to transfer esGmx tokens
    await esGmx.setHandler(vester.address, true)

    await gmx.mint(vester.address, expandDecimals(2000, 18))

    await gmx.mint(user0.address, expandDecimals(1000, 18))
    await gmx.mint(user1.address, expandDecimals(500, 18))
    await gmx.connect(user0).approve(stakedGmxTracker.address, expandDecimals(1000, 18))
    await gmx.connect(user1).approve(stakedGmxTracker.address, expandDecimals(500, 18))

    await rewardRouter.connect(user0).stakeGmx(expandDecimals(1000, 18))
    await rewardRouter.connect(user1).stakeGmx(expandDecimals(500, 18))

    await increaseTime(provider, 24 * 60 * 60)
    await mineBlock(provider)

    expect(await stakedGmxTracker.claimable(user0.address)).gt(expandDecimals(1190, 18))
    expect(await stakedGmxTracker.claimable(user0.address)).lt(expandDecimals(1191, 18))
    expect(await stakedGmxTracker.claimable(user1.address)).gt(expandDecimals(594, 18))
    expect(await stakedGmxTracker.claimable(user1.address)).lt(expandDecimals(596, 18))

    expect(await vester.getMaxVestableAmount(user0.address)).eq(0)
    expect(await vester.getMaxVestableAmount(user1.address)).eq(0)

    expect(await esGmx.balanceOf(user0.address)).eq(0)
    expect(await esGmx.balanceOf(user1.address)).eq(0)
    expect(await esGmx.balanceOf(user2.address)).eq(0)
    expect(await esGmx.balanceOf(user3.address)).eq(0)

    await stakedGmxTracker.connect(user0).claim(user2.address)
    await stakedGmxTracker.connect(user1).claim(user3.address)

    expect(await esGmx.balanceOf(user0.address)).eq(0)
    expect(await esGmx.balanceOf(user1.address)).eq(0)
    expect(await esGmx.balanceOf(user2.address)).gt(expandDecimals(1190, 18))
    expect(await esGmx.balanceOf(user2.address)).lt(expandDecimals(1191, 18))
    expect(await esGmx.balanceOf(user3.address)).gt(expandDecimals(594, 18))
    expect(await esGmx.balanceOf(user3.address)).lt(expandDecimals(596, 18))

    expect(await vester.getMaxVestableAmount(user0.address)).gt(expandDecimals(1190, 18))
    expect(await vester.getMaxVestableAmount(user0.address)).lt(expandDecimals(1191, 18))
    expect(await vester.getMaxVestableAmount(user1.address)).gt(expandDecimals(594, 18))
    expect(await vester.getMaxVestableAmount(user1.address)).lt(expandDecimals(596, 18))
    expect(await vester.getMaxVestableAmount(user2.address)).eq(0)
    expect(await vester.getMaxVestableAmount(user3.address)).eq(0)

    expect(await vester.getPairAmount(user0.address, expandDecimals(1, 18))).gt("830000000000000000") // 0.83, 1000 / 1190 => ~0.84
    expect(await vester.getPairAmount(user0.address, expandDecimals(1, 18))).lt("850000000000000000") // 0.85
    expect(await vester.getPairAmount(user1.address, expandDecimals(1, 18))).gt("830000000000000000") // 0.83, 500 / 595 => ~0.84
    expect(await vester.getPairAmount(user1.address, expandDecimals(1, 18))).lt("850000000000000000") // 0.85
    expect(await vester.getPairAmount(user2.address, expandDecimals(1, 18))).eq(0)
    expect(await vester.getPairAmount(user3.address, expandDecimals(1, 18))).eq(0)

    await increaseTime(provider, 24 * 60 * 60)
    await mineBlock(provider)

    await stakedGmxTracker.connect(user0).claim(user2.address)
    await stakedGmxTracker.connect(user1).claim(user3.address)

    expect(await esGmx.balanceOf(user2.address)).gt(expandDecimals(2380, 18))
    expect(await esGmx.balanceOf(user2.address)).lt(expandDecimals(2382, 18))
    expect(await esGmx.balanceOf(user3.address)).gt(expandDecimals(1189, 18))
    expect(await esGmx.balanceOf(user3.address)).lt(expandDecimals(1191, 18))

    expect(await vester.getMaxVestableAmount(user0.address)).gt(expandDecimals(2380, 18))
    expect(await vester.getMaxVestableAmount(user0.address)).lt(expandDecimals(2382, 18))
    expect(await vester.getMaxVestableAmount(user1.address)).gt(expandDecimals(1189, 18))
    expect(await vester.getMaxVestableAmount(user1.address)).lt(expandDecimals(1191, 18))

    expect(await vester.getPairAmount(user0.address, expandDecimals(1, 18))).gt("410000000000000000") // 0.41, 1000 / 2380 => ~0.42
    expect(await vester.getPairAmount(user0.address, expandDecimals(1, 18))).lt("430000000000000000") // 0.43
    expect(await vester.getPairAmount(user1.address, expandDecimals(1, 18))).gt("410000000000000000") // 0.41, 1000 / 2380 => ~0.42
    expect(await vester.getPairAmount(user1.address, expandDecimals(1, 18))).lt("430000000000000000") // 0.43

    expect(await vester.getPairAmount(user0.address, expandDecimals(2380, 18))).gt(expandDecimals(999, 18))
    expect(await vester.getPairAmount(user0.address, expandDecimals(2380, 18))).lt(expandDecimals(1000, 18))
    expect(await vester.getPairAmount(user1.address, expandDecimals(1189, 18))).gt(expandDecimals(499, 18))
    expect(await vester.getPairAmount(user1.address, expandDecimals(1189, 18))).lt(expandDecimals(500, 18))

    expect(await feeGmxTracker.balanceOf(user0.address)).eq(expandDecimals(1000, 18))
    await esGmx.mint(user0.address, expandDecimals(2380, 18))
    await vester.connect(user0).deposit(expandDecimals(2380, 18))

    expect(await feeGmxTracker.balanceOf(user0.address)).gt(0)
    expect(await feeGmxTracker.balanceOf(user0.address)).lt(expandDecimals(1, 18))

    await increaseTime(provider, 24 * 60 * 60)
    await mineBlock(provider)

    expect(await stakedGmxTracker.claimable(user0.address)).gt(expandDecimals(1190, 18))
    expect(await stakedGmxTracker.claimable(user0.address)).lt(expandDecimals(1191, 18))

    expect(await vester.getMaxVestableAmount(user0.address)).gt(expandDecimals(2380, 18))
    expect(await vester.getMaxVestableAmount(user0.address)).lt(expandDecimals(2382, 18))

    await stakedGmxTracker.connect(user0).claim(user2.address)

    expect(await vester.getMaxVestableAmount(user0.address)).gt(expandDecimals(3571, 18))
    expect(await vester.getMaxVestableAmount(user0.address)).lt(expandDecimals(3572, 18))

    expect(await vester.getPairAmount(user0.address, expandDecimals(3570, 18))).gt(expandDecimals(999, 18))
    expect(await vester.getPairAmount(user0.address, expandDecimals(3570, 18))).lt(expandDecimals(1000, 18))

    const feeGmxTrackerBalance = await feeGmxTracker.balanceOf(user0.address)

    await esGmx.mint(user0.address, expandDecimals(1190, 18))
    await vester.connect(user0).deposit(expandDecimals(1190, 18))

    expect(feeGmxTrackerBalance).eq(await feeGmxTracker.balanceOf(user0.address))

    await expect(rewardRouter.connect(user0).unstakeGmx(expandDecimals(2, 18)))
      .to.be.revertedWith("RewardTracker: burn amount exceeds balance")

    await vester.connect(user0).withdraw()

    await rewardRouter.connect(user0).unstakeGmx(expandDecimals(2, 18))
  })
})