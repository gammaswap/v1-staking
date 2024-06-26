import { ethers } from "hardhat"
import { BonusDistributor, FeeTracker, LoanTracker, RewardDistributor, RewardTracker, StakingRouter, Vester, VesterNoReserve } from "../../typechain-types";

export async function setup() {
  const [deployer, factory, manager] = await ethers.getSigners();

  // const GS = await ethers.getContractFactory('GS');
  // const gs = await GS.deploy(ethers.ZeroAddress);

  const ERC20 = await ethers.getContractFactory('ERC20Mock');
  const RestrictedToken = await ethers.getContractFactory('RestrictedToken');
  const Token = await ethers.getContractFactory('Token');

  const weth = await ERC20.deploy('Wrapped Ether', 'weth');
  const gs = await Token.deploy('GS', 'GS');
  const esGs = await RestrictedToken.deploy('Escrowed GS', 'esGS', 0);
  const esGsb = await RestrictedToken.deploy('Escrowed GS for Borrowers', 'esGSb', 0);
  const bnGs = await RestrictedToken.deploy('Bonus GS', 'bnGS', 1);
  const gsPool = await ERC20.deploy('GammaPool', 'GSPool');

  const RewardTracker = await ethers.getContractFactory('RewardTracker');
  const rewardTracker = await RewardTracker.deploy();
  const LoanTracker = await ethers.getContractFactory('LoanTracker');
  const loanTracker = await LoanTracker.deploy();
  const FeeTracker = await ethers.getContractFactory('FeeTracker');
  const feeTracker = await FeeTracker.deploy();
  const RewardDistributor = await ethers.getContractFactory('RewardDistributor');
  const rewardDistributor = await RewardDistributor.deploy();
  const BonusDistributor = await ethers.getContractFactory('BonusDistributor');
  const bonusDistributor = await BonusDistributor.deploy();
  const Vester = await ethers.getContractFactory('Vester');
  const vester = await Vester.deploy();
  const VesterNoReserve = await ethers.getContractFactory('VesterNoReserve');
  const vesterNoReserve = await VesterNoReserve.deploy();

  const BeaconProxyFactory = await ethers.getContractFactory('BeaconProxyFactory');
  const rewardTrackerDeployer = await BeaconProxyFactory.deploy(rewardTracker.target);
  const loanTrackerDeployer = await BeaconProxyFactory.deploy(loanTracker.target);
  const feeTrackerDeployer = await BeaconProxyFactory.deploy(feeTracker.target);
  const rewardDistributorDeployer = await BeaconProxyFactory.deploy(rewardDistributor.target);
  const bonusDistributorDeployer = await BeaconProxyFactory.deploy(bonusDistributor.target);
  const vesterDeployer = await BeaconProxyFactory.deploy(vester.target);
  const vesterNoReserveDeployer = await BeaconProxyFactory.deploy(vesterNoReserve.target);

  const StakingRouter = await ethers.getContractFactory('StakingRouter');
  const stakingRouter = await StakingRouter.deploy(
    factory.address,
    manager.address
  );

  await (await stakingRouter.initialize(loanTrackerDeployer.target,
      rewardTrackerDeployer.target,
      feeTrackerDeployer.target,
      rewardDistributorDeployer.target,
      bonusDistributorDeployer.target,
      vesterDeployer.target,
      vesterNoReserveDeployer.target)).wait();

  await (await stakingRouter.initializeGSTokens(gs.target, esGs.target, esGsb.target, bnGs.target, weth.target)).wait();
  await esGs.setManager(stakingRouter.target, true);
  await esGsb.setManager(stakingRouter.target, true);
  await bnGs.setManager(stakingRouter.target, true);
  
  await stakingRouter.setupGsStaking();
  await stakingRouter.setupGsStakingForLoan();

  await stakingRouter.setupPoolStaking(gsPool.target, esGs.target, gs.target);
  await stakingRouter.setupPoolStakingForLoan(gsPool.target, 1); // refId should be non-zero

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

export async function poolTrackers(stakingRouter: StakingRouter, gsPool: string, esToken: string, esGsb: string) {
  const RewardTrackerFactory = await ethers.getContractFactory('RewardTracker');
  const LoanTrackerFactory = await ethers.getContractFactory('LoanTracker');
  const RewardDistributorFactory = await ethers.getContractFactory('RewardDistributor');
  const VesterFactory = await ethers.getContractFactory('Vester');

  const poolTrackerAddresses = await stakingRouter.poolTrackers(gsPool, esToken);
  const poolLoanTrackerAddresses = await stakingRouter.poolTrackers(gsPool, esGsb);
  const poolTracker = {
    rewardTracker: RewardTrackerFactory.attach(poolTrackerAddresses.rewardTracker) as RewardTracker,
    rewardDistributor: RewardDistributorFactory.attach(poolTrackerAddresses.rewardDistributor) as RewardDistributor,
    loanRewardTracker: LoanTrackerFactory.attach(poolLoanTrackerAddresses.loanRewardTracker) as LoanTracker,
    loanRewardDistributor: RewardDistributorFactory.attach(poolLoanTrackerAddresses.loanRewardDistributor) as RewardDistributor,
    vester: VesterFactory.attach(poolTrackerAddresses.vester) as Vester,
  }

  return poolTracker;
}
