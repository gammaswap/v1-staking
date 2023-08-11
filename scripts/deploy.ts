import { ethers } from "hardhat";

async function main() {
  const [deployer, factory, manager] = await ethers.getSigners();

  const GS = await ethers.getContractFactory('GS');
  const gs = await GS.deploy();

  const Token = await ethers.getContractFactory('RestrictedToken');
  const ERC20 = await ethers.getContractFactory('ERC20');

  const weth = await ERC20.deploy('Wrapped Ether', 'weth');
  const esGs = await Token.deploy('Escrowed GS', 'esGS');
  const esGsb = await Token.deploy('Escrowed GS for Borrowers', 'esGSb');
  const bnGs = await Token.deploy('Bonus GS', 'bnGS');
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

  await stakingRouter.setupGsStaking();
  await stakingRouter.setupGsStakingForLoan();
  console.log('===== GS staking setup done =====');

  await stakingRouter.setupPoolStaking(gsPool.target);
  await stakingRouter.setupPoolStakingForLoan(gsPool.target, 1); // refId should be non-zero
  console.log(`===== Pool staking setup done for ${gsPool.target} =====`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
