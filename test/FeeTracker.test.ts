import { ethers } from 'hardhat';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { PANIC_CODES } from '@nomicfoundation/hardhat-chai-matchers/panic';
import { expect } from 'chai';
import { setup, coreTrackers } from './utils/deploy';
import { increase } from './utils/time'
import { expandDecimals } from './utils/bignumber';
import { impersonateAndFund } from './utils/misc';
import { GS, RestrictedToken, ERC20Mock, RewardDistributor, FeeTracker, RewardTracker, ERC20, StakingRouter } from '../typechain-types';

describe('FeeTracker', function() {
  let feeTracker: FeeTracker
  let weth: ERC20Mock
  let gs: GS
  let esGs: RestrictedToken
  let bnGs: RestrictedToken
  let feeDistributor: RewardDistributor
  let rewardTracker: RewardTracker
  let bonusTracker: RewardTracker
  let stakingRouter: StakingRouter
  let routerAsSigner: HardhatEthersSigner

  beforeEach(async () => {
    const baseContracts = await loadFixture(setup);
    weth = baseContracts.weth
    gs = baseContracts.gs;
    esGs = baseContracts.esGs;
    bnGs = baseContracts.bnGs;
    stakingRouter = baseContracts.stakingRouter;

    const coreTracker = await coreTrackers(stakingRouter);
    rewardTracker = coreTracker.rewardTracker;
    bonusTracker = coreTracker.bonusTracker;
    feeTracker = coreTracker.feeTracker;
    feeDistributor = coreTracker.feeDistributor;

    routerAsSigner = await impersonateAndFund(stakingRouter.target.toString());
  });

  it('inits', async () => {
    expect(await feeTracker.isInitialized()).eq(true)
    expect(await feeTracker.isDepositToken(bonusTracker.target)).eq(true)
    expect(await feeTracker.isDepositToken(bnGs.target)).eq(true)
    expect(await feeTracker.distributor()).eq(feeDistributor.target)
    expect(await feeTracker.rewardToken()).eq(weth.target)

    await expect(feeTracker.connect(routerAsSigner).initialize([gs.target, esGs.target], feeDistributor.target))
      .to.be.revertedWith('FeeTracker: already initialized')
  })

  it('setBonusLimit', async () => {
    expect(await feeTracker.bnRateCap()).eq(10000);
  })

  it('MP max cap, rewards', async () => {
    const [, user0, user1] = await ethers.getSigners();
    await gs.mint(user0.address, expandDecimals(1500, 18));
    await bnGs.mint(user0.address, expandDecimals(1500, 18));
    await esGs.mint(user1.address, expandDecimals(1000, 18));

    await weth.mint(feeDistributor.target, expandDecimals(50000, 18))
    await feeDistributor.connect(routerAsSigner).setTokensPerInterval("10000000000000000") // 0.01 weth per second
    await feeTracker.connect(routerAsSigner).setInPrivateStakingMode(false);

    // User0 stake
    await gs.connect(user0).approve(rewardTracker.target, expandDecimals(1000, 18));
    await stakingRouter.connect(user0).stakeGs(expandDecimals(1000, 18));
    await feeTracker.connect(user0).stake(bnGs.target, expandDecimals(1500, 18));
    expect(await feeTracker.balanceOf(user0.address)).to.eq(expandDecimals(2500, 18));

    // User1 stake
    await esGs.connect(user0).approve(rewardTracker.target, expandDecimals(1000, 18));
    await stakingRouter.connect(user1).stakeEsGs(expandDecimals(1000, 18));
    expect(await feeTracker.balanceOf(user1.address)).to.eq(expandDecimals(1000, 18));

    await increase(24 * 60 * 60)

    expect(await feeTracker.inactivePoints(user0.address)).to.eq(expandDecimals(500, 18));
    expect(await feeTracker.totalInactivePoints()).to.eq(expandDecimals(500, 18));

    expect(await feeTracker.claimable(user0.address)).to.gte(expandDecimals(576, 18))
    expect(await feeTracker.claimable(user0.address)).to.lte(expandDecimals(577, 18))
    expect(await feeTracker.claimable(user1.address)).to.gte(expandDecimals(288, 18))
    expect(await feeTracker.claimable(user1.address)).to.lte(expandDecimals(289, 18))

    // User0 unstake
    await stakingRouter.connect(user0).unstakeGs(expandDecimals(200, 18));
    expect(await feeTracker.balanceOf(user0.address)).to.eq(expandDecimals(2000, 18));
    expect(await feeTracker.inactivePoints(user0.address)).to.eq(expandDecimals(400, 18));
    expect(await feeTracker.totalInactivePoints()).to.eq(expandDecimals(400, 18));

    await increase(24 * 60 * 60);

    expect(await feeTracker.claimable(user0.address)).to.gte(expandDecimals(576 + 531, 18))
    expect(await feeTracker.claimable(user0.address)).to.lte(expandDecimals(577 + 532, 18))
    expect(await feeTracker.claimable(user1.address)).to.gte(expandDecimals(288 + 332, 18))
    expect(await feeTracker.claimable(user1.address)).to.lte(expandDecimals(289 + 333, 18))

    // User0 restake
    await gs.connect(user0).approve(rewardTracker.target, expandDecimals(700, 18));
    await stakingRouter.connect(user0).stakeGs(expandDecimals(700, 18));

    expect(await feeTracker.balanceOf(user0.address)).to.eq(expandDecimals(2700, 18));
    expect(await feeTracker.inactivePoints(user0.address)).to.eq(0);
    expect(await feeTracker.totalInactivePoints()).to.eq(0);

    await increase(24 * 60 * 60);

    expect(await feeTracker.claimable(user0.address)).to.gte(expandDecimals(576 + 531 + 630, 18))
    expect(await feeTracker.claimable(user0.address)).to.lte(expandDecimals(577 + 532 + 631, 18))
    expect(await feeTracker.claimable(user1.address)).to.gte(expandDecimals(288 + 332 + 233, 18))
    expect(await feeTracker.claimable(user1.address)).to.lte(expandDecimals(289 + 333 + 234, 18))
  })
});