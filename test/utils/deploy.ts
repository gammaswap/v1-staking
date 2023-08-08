import { ethers } from "hardhat"
import { BonusDistributor, FeeTracker, LoanTracker, RewardDistributor, RewardTracker, StakingRouter, Vester, VesterNoReserve } from "../../typechain-types";

export async function setup() {
  const [deployer, factory, manager] = await ethers.getSigners();

  const GS = await ethers.getContractFactory('GS');
  const gs = await GS.deploy();

  const Token = await ethers.getContractFactory('RestrictedToken');
  const weth = await Token.deploy('Wrapped Ether', 'weth');
  const esGs = await Token.deploy('Escrowed GS', 'esGS');
  const esGsb = await Token.deploy('Escrowed GS for Borrowers', 'esGSb');
  const bnGs = await Token.deploy('Bonus GS', 'bnGS');
  const gsPool = await Token.deploy('GammaPool', 'GSPool');

  const RewardTrackerDeployer = await ethers.getContractFactory('RewardTrackerDeployer');
  const rewardTrackerDeployer = await RewardTrackerDeployer.deploy();

  const FeeTrackerDeployer = await ethers.getContractFactory('FeeTrackerDeployer');
  const feeTrackerDeployer = await FeeTrackerDeployer.deploy();

  const RewardDistributorDeployer = await ethers.getContractFactory('RewardDistributorDeployer');
  const rewardDistributorDeployer = await RewardDistributorDeployer.deploy();

  const VesterDeployer = await ethers.getContractFactory('VesterDeployer');
  const vesterDeployer = await VesterDeployer.deploy();

  const StakingRouter = await ethers.getContractFactory('StakingRouter');
  const stakingRouter = await StakingRouter.deploy(
    weth.target,
    gs.target,
    esGs.target,
    esGsb.target,
    bnGs.target,
    factory.address,
    manager.address,
    rewardTrackerDeployer.target,
    feeTrackerDeployer.target,
    rewardDistributorDeployer.target,
    vesterDeployer.target,
  );

  await esGs.setManager(stakingRouter.target, true);
  await esGsb.setManager(stakingRouter.target, true);

  await stakingRouter.setupGsStaking();

  await stakingRouter.setupPoolStaking(gsPool.target, 1); // refId should be non-zero

  return { gs, weth, esGs, esGsb, bnGs, gsPool, rewardTrackerDeployer, feeTrackerDeployer, rewardDistributorDeployer, vesterDeployer, stakingRouter };
}

export async function coreTrackers(stakingRouter: StakingRouter) {
  const RewardTrackerFactory = await ethers.getContractFactory('RewardTracker');
  const FeeTrackerFactory = await ethers.getContractFactory('FeeTracker');
  const RewardDistributorFactory = await ethers.getContractFactory('RewardDistributor');
  const BonusDistributorFactory = await ethers.getContractFactory('BonusDistributor');
  const VesterFactory = await ethers.getContractFactory('Vester');
  const LoanVesterFactory = await ethers.getContractFactory('VesterNoReserve');

  const coreTrackerAddresses = await stakingRouter.coreTracker();
  const coreTracker = {
    rewardTracker: RewardTrackerFactory.attach(coreTrackerAddresses.rewardTracker) as RewardTracker,
    rewardDistributor: RewardDistributorFactory.attach(coreTrackerAddresses.rewardDistributor) as RewardDistributor,
    loanRewardTracker: RewardTrackerFactory.attach(coreTrackerAddresses.loanRewardTracker) as RewardTracker,
    loanRewardDistributor: RewardDistributorFactory.attach(coreTrackerAddresses.loanRewardDistributor) as RewardDistributor,
    bonusTracker: RewardTrackerFactory.attach(coreTrackerAddresses.bonusTracker) as RewardTracker,
    bonusDistributor: BonusDistributorFactory.attach(coreTrackerAddresses.bonusDistributor) as BonusDistributor,
    feeTracker: FeeTrackerFactory.attach(coreTrackerAddresses.feeTracker) as FeeTracker,
    feeDistributor: RewardDistributorFactory.attach(coreTrackerAddresses.feeDistributor) as RewardDistributor,
    vester: VesterFactory.attach(coreTrackerAddresses.vester) as Vester,
    loanVester: LoanVesterFactory.attach(coreTrackerAddresses.loanVester) as VesterNoReserve,
  };

  return coreTracker;
}

export async function poolTrackers(stakingRouter: StakingRouter, gsPool: string) {
  const RewardTrackerFactory = await ethers.getContractFactory('RewardTracker');
  const LoanTrackerFactory = await ethers.getContractFactory('LoanTracker');
  const RewardDistributorFactory = await ethers.getContractFactory('RewardDistributor');
  const VesterFactory = await ethers.getContractFactory('Vester');

  const poolTrackerAddresses = await stakingRouter.poolTrackers(gsPool);
  const poolTracker = {
    rewardTracker: RewardTrackerFactory.attach(poolTrackerAddresses.rewardTracker) as RewardTracker,
    rewardDistributor: RewardDistributorFactory.attach(poolTrackerAddresses.rewardDistributor) as RewardDistributor,
    loanRewardTracker: LoanTrackerFactory.attach(poolTrackerAddresses.loanRewardTracker) as LoanTracker,
    loanRewardDistributor: RewardDistributorFactory.attach(poolTrackerAddresses.loanRewardDistributor) as RewardDistributor,
    vester: VesterFactory.attach(poolTrackerAddresses.vester) as Vester,
  }

  return poolTracker;
}
