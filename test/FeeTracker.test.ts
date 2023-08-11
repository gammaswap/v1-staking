import { ethers } from 'hardhat';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { PANIC_CODES } from '@nomicfoundation/hardhat-chai-matchers/panic';
import { expect } from 'chai';
import { setup, coreTrackers } from './utils/deploy';
import { increase } from './utils/time'
import { expandDecimals } from './utils/bignumber';
import { impersonateAndFund } from './utils/misc';
import { GS, RestrictedToken, RewardDistributor, FeeTracker, RewardTracker, ERC20 } from '../typechain-types';

describe('FeeTracker', function() {
  let feeTracker: FeeTracker
  let weth: ERC20
  let gs: GS
  let esGs: RestrictedToken
  let bnGs: RestrictedToken
  let feeDistributor: RewardDistributor
  let bonusTracker: RewardTracker
  let routerAsSigner: HardhatEthersSigner

  beforeEach(async () => {
    const baseContracts = await loadFixture(setup);
    weth = baseContracts.weth
    gs = baseContracts.gs;
    esGs = baseContracts.esGs;
    bnGs = baseContracts.bnGs;
    const router = baseContracts.stakingRouter;

    const coreTracker = await coreTrackers(router);
    bonusTracker = coreTracker.bonusTracker;
    feeTracker = coreTracker.feeTracker;
    feeDistributor = coreTracker.feeDistributor;

    routerAsSigner = await impersonateAndFund(router.target.toString());
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
});