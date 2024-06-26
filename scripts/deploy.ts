import { ethers } from "hardhat";
import { BonusDistributor } from "../typechain-types";

async function main() {
  const [deployer, factory, manager] = await ethers.getSigners();

  const GS = await ethers.getContractFactory('GS');
  const gs = await GS.deploy(ethers.ZeroAddress);

  const Token = await ethers.getContractFactory('RestrictedToken');
  const ERC20 = await ethers.getContractFactory('ERC20');

  const weth = await ERC20.deploy('Wrapped Ether', 'weth');
  const esGs = await Token.deploy('Escrowed GS', 'esGS', 0);
  const esGsb = await Token.deploy('Escrowed GS for Borrowers', 'esGSb', 0);
  const bnGs = await Token.deploy('Bonus GS', 'bnGS', 1);
  const gsPool = await ERC20.deploy('GammaPool', 'GSPool');

  const RewardTrackerDeployer = await ethers.getContractFactory('RewardTrackerDeployer');
  const rewardTrackerDeployer = await RewardTrackerDeployer.deploy();

  const FeeTrackerDeployer = await ethers.getContractFactory('FeeTrackerDeployer');
  const feeTrackerDeployer = await FeeTrackerDeployer.deploy();

  const RewardDistributorDeployer = await ethers.getContractFactory('RewardDistributorDeployer');
  const rewardDistributorDeployer = await RewardDistributorDeployer.deploy();

  const VesterDeployer = await ethers.getContractFactory('VesterDeployer');
  const vesterDeployer = await VesterDeployer.deploy();

  console.log('Factory:', factory.address);
  console.log('Manager:', manager.address);
  console.log('WETH:', weth.target);
  console.log('GS:', gs.target);
  console.log('esGS:', esGs.target);
  console.log('esGSb:', esGsb.target);
  console.log('bnGS:', bnGs.target);
  console.log('GammaPool:', gsPool.target);
  console.log('RewardTrackerDeployer:', rewardTrackerDeployer.target);
  console.log('FeeTrackerDeployer:', feeTrackerDeployer.target);
  console.log('RewardDistributorDeployer:', rewardDistributorDeployer.target);
  console.log('VesterDeployer:', vesterDeployer.target);

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
  console.log('===== Staking Router Deployed =====', stakingRouter.target);

  await esGs.setManager(stakingRouter.target, true);
  await esGsb.setManager(stakingRouter.target, true);
  await bnGs.setManager(stakingRouter.target, true);
  console.log('===== Reward token permissions given to staking router =====');

  await stakingRouter.setupGsStaking();
  await stakingRouter.setupGsStakingForLoan();
  console.log('===== GS staking setup done =====');

  await stakingRouter.setupPoolStaking(gsPool.target, esGs.target, gs.target);
  await stakingRouter.setupPoolStakingForLoan(gsPool.target, 1); // refId should be non-zero
  console.log(`===== Pool staking setup done for ${gsPool.target} =====`);

  const coreTracker = await stakingRouter.coreTracker();
  const bonusDistributor = (await ethers.getContractFactory('BonusDistributor')).attach(coreTracker.bonusDistributor) as BonusDistributor;
  const functionData = bonusDistributor.interface.encodeFunctionData('setBonusMultiplier', [10000]);
  await stakingRouter.execute(coreTracker.bonusDistributor, functionData);
  console.log('===== Bonus Multiplier set =====', await bonusDistributor.bonusMultiplierBasisPoints());
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
