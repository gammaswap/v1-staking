import { ethers } from 'hardhat';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { PANIC_CODES } from '@nomicfoundation/hardhat-chai-matchers/panic';
import { expect } from 'chai';
import { setup, coreTrackers } from './utils/deploy';
import { increase, latest } from './utils/time'
import { expandDecimals } from './utils/bignumber';
import { impersonateAndFund } from './utils/misc';
import { BonusDistributor, FeeTracker, GS, ERC20Mock, RestrictedToken, RewardDistributor, RewardTracker, StakingRouter, Vester, Token } from '../typechain-types';

const secondsPerYear = 365 * 24 * 60 * 60
const AddressZero = ethers.ZeroAddress

describe('Vester', function() {
  let gs: Token
  let esGs: RestrictedToken
  let bnGs: RestrictedToken
  let weth: ERC20Mock
  let rewardTracker: RewardTracker
  let rewardDistributor: RewardDistributor
  let bonusTracker: RewardTracker
  let bonusDistributor: BonusDistributor
  let feeTracker: FeeTracker
  let vester: Vester
  let stakingRouter: StakingRouter
  let routerAsSigner: HardhatEthersSigner

  beforeEach(async () => {
    const baseContracts = await loadFixture(setup);
    gs = baseContracts.gs;
    esGs = baseContracts.esGs;
    bnGs = baseContracts.bnGs;
    weth = baseContracts.weth;

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
    expect(await vester.name()).eq("Vested GS")
    expect(await vester.symbol()).eq("vGS")
    expect(await vester.vestingDuration()).eq(secondsPerYear)
    expect(await vester.esToken()).eq(esGs.target)
    expect(await vester.pairToken()).eq(feeTracker.target)
    expect(await vester.claimableToken()).eq(gs.target)
    expect(await vester.rewardTracker()).eq(rewardTracker.target)
    expect(await vester.hasPairToken()).eq(true)
    expect(await vester.hasRewardTracker()).eq(true)
    expect(await vester.hasMaxVestableAmount()).eq(true)
    expect(await vester.maxWithdrawableAmount()).eq(0)
  })

  it("setCumulativeRewardDeductions", async () => {
    const [deployer, user0] = await ethers.getSigners()
    await expect(vester.setCumulativeRewardDeductions(user0.address, 200))
      .to.be.revertedWith("Vester: forbidden")

    await vester.connect(routerAsSigner).setHandler(deployer.address, true)

    expect(await vester.cumulativeRewardDeductions(user0.address)).eq(0)
    await vester.setCumulativeRewardDeductions(user0.address, 200)
    expect(await vester.cumulativeRewardDeductions(user0.address)).eq(200)
  })

  it("setBonusRewards", async () => {
    const [deployer, user0] = await ethers.getSigners()
    await expect(vester.setBonusRewards(user0.address, 200))
      .to.be.revertedWith("Vester: forbidden")

    await vester.connect(routerAsSigner).setHandler(deployer.address, true)

    expect(await vester.bonusRewards(user0.address)).eq(0)
    await vester.setBonusRewards(user0.address, 200)
    expect(await vester.bonusRewards(user0.address)).eq(200)
  })

  it("deposit, claim, withdraw", async () => {
    const [deployer, user0] = await ethers.getSigners()

    await expect(vester.connect(user0).deposit(0))
      .to.be.revertedWith("Vester: invalid _amount")

    await expect(vester.connect(user0).deposit(expandDecimals(1000, 18)))
      .to.be.revertedWith("ERC20: transfer amount exceeds balance")

    await esGs.connect(user0).approve(vester.target, expandDecimals(1000, 18))

    await expect(vester.connect(user0).deposit(expandDecimals(1000, 18)))
    .to.be.revertedWith("ERC20: transfer amount exceeds balance")

    expect(await vester.balanceOf(user0.address)).eq(0)
    expect(await vester.getTotalVested(user0.address)).eq(0)
    expect(await vester.cumulativeClaimAmounts(user0.address)).eq(0)
    expect(await vester.claimedAmounts(user0.address)).eq(0)
    expect(await vester.claimable(user0.address)).eq(0)
    expect(await vester.pairAmounts(user0.address)).eq(0)
    expect(await vester.lastVestingTimes(user0.address)).eq(0)
    
    await esGs.mint(user0.address, expandDecimals(1000, 18))
    await expect(vester.connect(user0).deposit(expandDecimals(1000, 18)))
      .to.be.revertedWith("Vester: max vestable amount exceeded")

    await vester.connect(routerAsSigner).setBonusRewards(user0.address, expandDecimals(1000, 18));  // Provide pair tokens
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
      .to.be.revertedWith("ERC20: transfer amount exceeds balance")

    await gs.mint(vester.target, expandDecimals(2000, 18))
    expect(await vester.maxWithdrawableAmount()).eq(expandDecimals(1000, 18)) // 2000 - 1000

    await vester.connect(user0).claim()
    expect(await vester.maxWithdrawableAmount()).eq(expandDecimals(1000, 18))
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
    expect(await vester.maxWithdrawableAmount()).eq(expandDecimals(1000, 18))
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
    await vester.connect(routerAsSigner).setBonusRewards(user0.address, expandDecimals(2000, 18));  // Provide pair tokens
    await vester.connect(user0).deposit(expandDecimals(500, 18))

    await increase(24 * 60 * 60)

    expect(await vester.claimable(user0.address)).gt("6840000000000000000") // 1000 / 365 + 1500 / 365 => 6.849
    expect(await vester.claimable(user0.address)).lt("6860000000000000000")
    expect(await vester.maxWithdrawableAmount()).eq(expandDecimals(500, 18))

    expect(await esGs.balanceOf(user0.address)).eq(0)
    expect(await gs.balanceOf(user0.address)).eq(gsAmount)

    await vester.connect(user0).withdraw()

    expect(await esGs.balanceOf(user0.address)).gt(expandDecimals(989, 18))
    expect(await esGs.balanceOf(user0.address)).lt(expandDecimals(990, 18))
    expect(await gs.balanceOf(user0.address)).gt(expandDecimals(510, 18))
    expect(await gs.balanceOf(user0.address)).lt(expandDecimals(512, 18))
    expect(await vester.maxWithdrawableAmount()).gt(expandDecimals(500 + 989, 18))
    expect(await vester.maxWithdrawableAmount()).lt(expandDecimals(500 + 990, 18))

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
    expect(await vester.maxWithdrawableAmount()).gt(expandDecimals(500 + 989 - 1000, 18))
    expect(await vester.maxWithdrawableAmount()).lt(expandDecimals(500 + 990 - 1000, 18))

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

    // withdraw tokens
    await gs.connect(deployer).burn(vester.target, expandDecimals(500, 18))
    await expect(vester.maxWithdrawableAmount()).to.be.revertedWith("Vester: Insufficient funds");

    await gs.connect(deployer).mint(vester.target, expandDecimals(500, 18))
    await vester.connect(routerAsSigner).withdrawToken(gs.target, deployer, 0)

    expect(await vester.maxWithdrawableAmount()).eq(0)
    expect(await gs.balanceOf(deployer)).gt(expandDecimals(489, 18))  // 500 + 989 - 1000
    expect(await gs.balanceOf(deployer)).lt(expandDecimals(490, 18))

    await gs.connect(deployer).mint(vester.target, expandDecimals(100, 18))
    expect(await vester.maxWithdrawableAmount()).eq(expandDecimals(100, 18))
    await expect(vester.connect(routerAsSigner).withdrawToken(gs.target, deployer, expandDecimals(500, 18)))
      .to.emit(gs, "Transfer")
      .withArgs(vester.target, deployer.address, expandDecimals(100, 18))
    expect(await vester.maxWithdrawableAmount()).eq(0)
  })

  it("depositForAccount, claimForAccount", async () => {
    const [deployer, user0, user1, user2, user3, user4] = await ethers.getSigners()
    await vester.connect(routerAsSigner).setHandler(deployer.address, true)

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

    await vester.connect(routerAsSigner).setHandler(user2.address, true)
    await vester.connect(routerAsSigner).setBonusRewards(user0.address,  expandDecimals(1000, 18))
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
      .to.be.revertedWith("ERC20: transfer amount exceeds balance")

    await gs.mint(vester.target, expandDecimals(2000, 18))

    await expect(vester.connect(user3).claimForAccount(user0.address, user4.address))
      .to.be.revertedWith("Vester: forbidden")

    await vester.connect(routerAsSigner).setHandler(user3.address, true)

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

    await esGs.connect(user0).approve(vester.target, expandDecimals(1000, 18))

    expect(await vester.balanceOf(user0.address)).eq(0)
    expect(await vester.getTotalVested(user0.address)).eq(0)
    expect(await vester.cumulativeClaimAmounts(user0.address)).eq(0)
    expect(await vester.claimedAmounts(user0.address)).eq(0)
    expect(await vester.claimable(user0.address)).eq(0)
    expect(await vester.pairAmounts(user0.address)).eq(0)
    expect(await vester.lastVestingTimes(user0.address)).eq(0)

    await esGs.mint(user0.address, expandDecimals(1000, 18))
    await vester.connect(routerAsSigner).setBonusRewards(user0.address, expandDecimals(2000, 18));
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
      .to.be.revertedWith("ERC20: transfer amount exceeds balance")

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
    const [deployer, user0, user1, user2, user3] = await ethers.getSigners()

    // await esGs.setHandler(wallet.address, true)
    await esGs.mint(rewardDistributor.target, expandDecimals(50000 * 12, 18))
    await rewardDistributor.connect(routerAsSigner).setTokensPerInterval("20667989410000000") // 0.02066798941 esGs per second
    await rewardDistributor.connect(routerAsSigner).setPaused(false)
    await bonusDistributor.connect(routerAsSigner).setBonusMultiplier(10000)

    expect(await vester.name()).eq("Vested GS")
    expect(await vester.symbol()).eq("vGS")
    expect(await vester.vestingDuration()).eq(secondsPerYear)
    expect(await vester.esToken()).eq(esGs.target)
    expect(await vester.pairToken()).eq(feeTracker.target)
    expect(await vester.claimableToken()).eq(gs.target)
    expect(await vester.rewardTracker()).eq(rewardTracker.target)
    expect(await vester.hasPairToken()).eq(true)
    expect(await vester.hasRewardTracker()).eq(true)
    expect(await vester.hasMaxVestableAmount()).eq(true)

    await gs.mint(vester.target, expandDecimals(2000, 18))

    await gs.mint(user0.address, expandDecimals(1000, 18))
    await gs.mint(user1.address, expandDecimals(500, 18))
    await gs.connect(user0).approve(rewardTracker.target, expandDecimals(1000, 18))
    await gs.connect(user1).approve(rewardTracker.target, expandDecimals(500, 18))

    await stakingRouter.connect(user0).stakeGs(expandDecimals(1000, 18))
    await stakingRouter.connect(user1).stakeGs(expandDecimals(500, 18))

    await increase(24 * 60 * 60)

    expect(await rewardTracker.claimable(user0.address)).gt(expandDecimals(1190, 18))
    expect(await rewardTracker.claimable(user0.address)).lt(expandDecimals(1191, 18))
    expect(await rewardTracker.claimable(user1.address)).gt(expandDecimals(594, 18))
    expect(await rewardTracker.claimable(user1.address)).lt(expandDecimals(596, 18))

    expect(await vester.getMaxVestableAmount(user0.address)).eq(0)
    expect(await vester.getMaxVestableAmount(user1.address)).eq(0)

    expect(await esGs.balanceOf(user0.address)).eq(0)
    expect(await esGs.balanceOf(user1.address)).eq(0)
    expect(await esGs.balanceOf(user2.address)).eq(0)
    expect(await esGs.balanceOf(user3.address)).eq(0)

    await rewardTracker.connect(user0).claim(user2.address)
    await rewardTracker.connect(user1).claim(user3.address)

    expect(await esGs.balanceOf(user0.address)).eq(0)
    expect(await esGs.balanceOf(user1.address)).eq(0)
    expect(await esGs.balanceOf(user2.address)).gt(expandDecimals(1190, 18))
    expect(await esGs.balanceOf(user2.address)).lt(expandDecimals(1191, 18))
    expect(await esGs.balanceOf(user3.address)).gt(expandDecimals(594, 18))
    expect(await esGs.balanceOf(user3.address)).lt(expandDecimals(596, 18))

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

    await increase(24 * 60 * 60)

    await rewardTracker.connect(user0).claim(user2.address)
    await rewardTracker.connect(user1).claim(user3.address)

    expect(await vester.getMaxVestableAmount(user0.address)).gt(expandDecimals(2380, 18))
    expect(await vester.getMaxVestableAmount(user0.address)).lt(expandDecimals(2382, 18))
    expect(await vester.getMaxVestableAmount(user1.address)).gt(expandDecimals(1189, 18))
    expect(await vester.getMaxVestableAmount(user1.address)).lt(expandDecimals(1191, 18))

    expect(await vester.getPairAmount(user0.address, expandDecimals(1, 18))).gt("410000000000000000") // 0.41, 1000 / 2380 => ~0.42
    expect(await vester.getPairAmount(user0.address, expandDecimals(1, 18))).lt("430000000000000000") // 0.43
    expect(await vester.getPairAmount(user1.address, expandDecimals(1, 18))).gt("410000000000000000") // 0.41, 1000 / 2380 => ~0.42
    expect(await vester.getPairAmount(user1.address, expandDecimals(1, 18))).lt("430000000000000000") // 0.43

    await esGs.mint(user0.address, expandDecimals(2385, 18))
    await expect(vester.connect(user0).deposit(expandDecimals(2385, 18)))
      .to.be.revertedWithPanic(PANIC_CODES.ARITHMETIC_UNDER_OR_OVERFLOW)

    await gs.mint(user0.address, expandDecimals(500, 18))
    await gs.connect(user0).approve(rewardTracker.target, expandDecimals(500, 18))
    await stakingRouter.connect(user0).stakeGs(expandDecimals(500, 18))

    await expect(vester.connect(user0).deposit(expandDecimals(2385, 18)))
      .to.be.revertedWith("Vester: max vestable amount exceeded")

    await gs.mint(user2.address, expandDecimals(1, 18))
    await expect(vester.connect(user2).deposit(expandDecimals(1, 18)))
      .to.be.revertedWith("Vester: max vestable amount exceeded")

    expect(await esGs.balanceOf(user0.address)).eq(expandDecimals(2385, 18))
    expect(await esGs.balanceOf(vester.target)).eq(0)
    expect(await feeTracker.balanceOf(user0.address)).eq(expandDecimals(1500, 18))
    expect(await feeTracker.balanceOf(vester.target)).eq(0)

    await vester.connect(user0).deposit(expandDecimals(2380, 18))

    expect(await esGs.balanceOf(user0.address)).eq(expandDecimals(5, 18))
    expect(await esGs.balanceOf(vester.target)).eq(expandDecimals(2380, 18))
    expect(await feeTracker.balanceOf(user0.address)).gt(expandDecimals(499, 18))
    expect(await feeTracker.balanceOf(user0.address)).lt(expandDecimals(501, 18))
    expect(await feeTracker.balanceOf(vester.target)).gt(expandDecimals(999, 18))
    expect(await feeTracker.balanceOf(vester.target)).lt(expandDecimals(1001, 18))

    await stakingRouter.connect(user1).unstakeGs(expandDecimals(499, 18))

    await increase(24 * 60 * 60)

    await rewardTracker.connect(user0).claim(user2.address)
    await rewardTracker.connect(user1).claim(user3.address)

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

    await increase(30 * 24 * 60 * 60)

    await vester.connect(user0).withdraw()

    expect(await feeTracker.balanceOf(user0.address)).eq(expandDecimals(1500, 18))
    expect(await gs.balanceOf(user0.address)).gt(expandDecimals(201, 18)) // 2380 / 12 = ~198
    expect(await gs.balanceOf(user0.address)).lt(expandDecimals(203, 18))
    expect(await esGs.balanceOf(user0.address)).gt(expandDecimals(2182, 18)) // 5 + 2380 - 202  = 2183
    expect(await esGs.balanceOf(user0.address)).lt(expandDecimals(2183, 18))
  })

  it("handles existing pair tokens", async () => {
    const [deployer, user0, user1, user2, user3] = await ethers.getSigners()

    await esGs.mint(rewardDistributor.target, expandDecimals(50000 * 12, 18))
    await rewardDistributor.connect(routerAsSigner).setTokensPerInterval("20667989410000000") // 0.02066798941 esGs per second
    await rewardDistributor.connect(routerAsSigner).setPaused(false)
    await bonusDistributor.connect(routerAsSigner).setBonusMultiplier(10000)

    expect(await vester.name()).eq("Vested GS")
    expect(await vester.symbol()).eq("vGS")
    expect(await vester.vestingDuration()).eq(secondsPerYear)
    expect(await vester.esToken()).eq(esGs.target)
    expect(await vester.pairToken()).eq(feeTracker.target)
    expect(await vester.claimableToken()).eq(gs.target)
    expect(await vester.rewardTracker()).eq(rewardTracker.target)
    expect(await vester.hasPairToken()).eq(true)
    expect(await vester.hasRewardTracker()).eq(true)
    expect(await vester.hasMaxVestableAmount()).eq(true)

    await gs.mint(vester.target, expandDecimals(2000, 18))

    await gs.mint(user0.address, expandDecimals(1000, 18))
    await gs.mint(user1.address, expandDecimals(500, 18))
    await gs.connect(user0).approve(rewardTracker.target, expandDecimals(1000, 18))
    await gs.connect(user1).approve(rewardTracker.target, expandDecimals(500, 18))

    await stakingRouter.connect(user0).stakeGs(expandDecimals(1000, 18))
    await stakingRouter.connect(user1).stakeGs(expandDecimals(500, 18))

    await increase(24 * 60 * 60)

    expect(await rewardTracker.claimable(user0.address)).gt(expandDecimals(1190, 18))
    expect(await rewardTracker.claimable(user0.address)).lt(expandDecimals(1191, 18))
    expect(await rewardTracker.claimable(user1.address)).gt(expandDecimals(594, 18))
    expect(await rewardTracker.claimable(user1.address)).lt(expandDecimals(596, 18))

    expect(await vester.getMaxVestableAmount(user0.address)).eq(0)
    expect(await vester.getMaxVestableAmount(user1.address)).eq(0)

    expect(await esGs.balanceOf(user0.address)).eq(0)
    expect(await esGs.balanceOf(user1.address)).eq(0)
    expect(await esGs.balanceOf(user2.address)).eq(0)
    expect(await esGs.balanceOf(user3.address)).eq(0)

    await rewardTracker.connect(user0).claim(user2.address)
    await rewardTracker.connect(user1).claim(user3.address)

    expect(await esGs.balanceOf(user0.address)).eq(0)
    expect(await esGs.balanceOf(user1.address)).eq(0)
    expect(await esGs.balanceOf(user2.address)).gt(expandDecimals(1190, 18))
    expect(await esGs.balanceOf(user2.address)).lt(expandDecimals(1191, 18))
    expect(await esGs.balanceOf(user3.address)).gt(expandDecimals(594, 18))
    expect(await esGs.balanceOf(user3.address)).lt(expandDecimals(596, 18))

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

    await increase(24 * 60 * 60)

    await rewardTracker.connect(user0).claim(user2.address)
    await rewardTracker.connect(user1).claim(user3.address)

    expect(await esGs.balanceOf(user2.address)).gt(expandDecimals(2380, 18))
    expect(await esGs.balanceOf(user2.address)).lt(expandDecimals(2382, 18))
    expect(await esGs.balanceOf(user3.address)).gt(expandDecimals(1189, 18))
    expect(await esGs.balanceOf(user3.address)).lt(expandDecimals(1191, 18))

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

    expect(await feeTracker.balanceOf(user0.address)).eq(expandDecimals(1000, 18))
    await esGs.mint(user0.address, expandDecimals(2380, 18))
    await vester.connect(user0).deposit(expandDecimals(2380, 18))

    expect(await feeTracker.balanceOf(user0.address)).gt(0)
    expect(await feeTracker.balanceOf(user0.address)).lt(expandDecimals(1, 18))

    await increase(24 * 60 * 60)

    expect(await rewardTracker.claimable(user0.address)).gt(expandDecimals(1190, 18))
    expect(await rewardTracker.claimable(user0.address)).lt(expandDecimals(1191, 18))

    expect(await vester.getMaxVestableAmount(user0.address)).gt(expandDecimals(2380, 18))
    expect(await vester.getMaxVestableAmount(user0.address)).lt(expandDecimals(2382, 18))

    await rewardTracker.connect(user0).claim(user2.address)

    expect(await vester.getMaxVestableAmount(user0.address)).gt(expandDecimals(3571, 18))
    expect(await vester.getMaxVestableAmount(user0.address)).lt(expandDecimals(3572, 18))

    expect(await vester.getPairAmount(user0.address, expandDecimals(3570, 18))).gt(expandDecimals(999, 18))
    expect(await vester.getPairAmount(user0.address, expandDecimals(3570, 18))).lt(expandDecimals(1000, 18))

    const feeTrackerBalance = await feeTracker.balanceOf(user0.address)

    await esGs.mint(user0.address, expandDecimals(1190, 18))
    await vester.connect(user0).deposit(expandDecimals(1190, 18))

    expect(feeTrackerBalance).eq(await feeTracker.balanceOf(user0.address))

    await expect(stakingRouter.connect(user0).unstakeGs(expandDecimals(2, 18)))
      .to.be.revertedWithPanic(PANIC_CODES.ARITHMETIC_UNDER_OR_OVERFLOW)

    await vester.connect(user0).withdraw()

    await stakingRouter.connect(user0).unstakeGs(expandDecimals(2, 18))
  })
})