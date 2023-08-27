// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.4;

import "@gammaswap/v1-core/contracts/base/GammaPoolERC20.sol";
import "../../../contracts/StakingRouter.sol";
import "../../../contracts/deployers/RewardTrackerDeployer.sol";
import "../../../contracts/deployers/FeeTrackerDeployer.sol";
import "../../../contracts/deployers/RewardDistributorDeployer.sol";
import "../../../contracts/deployers/VesterDeployer.sol";
import "../../../contracts/RewardDistributor.sol";
import "../../../contracts/BonusDistributor.sol";
import "./TokensSetup.sol";

contract RouterSetup is TokensSetup {
    StakingRouter stakingRouter;

    function setupRouter(address factory, address manager, address gsPool) public {
        initRouter(factory, manager);
        wireUp();
        wireUpPool(gsPool);
        setEmissions(gsPool);
    }

    function initRouter(address factory, address manager) public {
        RewardTrackerDeployer rewardTrackerDeployer = new RewardTrackerDeployer();
        FeeTrackerDeployer feeTrackerDeployer = new FeeTrackerDeployer();
        RewardDistributorDeployer rewardDistributorDeployer = new RewardDistributorDeployer();
        VesterDeployer vesterDeployer = new VesterDeployer();

        stakingRouter = new StakingRouter(
            address(weth),
            address(gs),
            address(esGs),
            address(esGsb),
            address(bnGs),
            factory,
            manager,
            address(rewardTrackerDeployer),
            address(feeTrackerDeployer),
            address(rewardDistributorDeployer),
            address(vesterDeployer)
        );
    }

    function wireUp() public {
        esGs.setManager(address(stakingRouter), true);
        esGsb.setManager(address(stakingRouter), true);
        bnGs.setManager(address(stakingRouter), true);

        stakingRouter.setupGsStaking();
        stakingRouter.setupGsStakingForLoan();
    }

    function wireUpPool(address gsPool) public {
        stakingRouter.setupPoolStaking(gsPool);
        stakingRouter.setupPoolStakingForLoan(gsPool, 1);
    }

    function approveUserForStaking(address user, address gsPool) public {
        (address rewardTracker,,,,,,,,address vester,) = stakingRouter.coreTracker();
        (address poolRewardTracker,,,, address poolVester) = stakingRouter.poolTrackers(gsPool);

        vm.startPrank(user);
        gs.approve(rewardTracker, type(uint256).max);
        esGs.approve(rewardTracker, type(uint256).max);
        esGs.approve(vester, type(uint256).max);
        esGs.approve(poolVester, type(uint256).max);
        GammaPoolERC20(gsPool).approve(poolRewardTracker, type(uint256).max);
        vm.stopPrank();
    }

    function setEmissions(address gsPool) public {
        (, address rewardDistributor,,,, address bonusDistributor,, address feeDistributor, address vester,) = stakingRouter.coreTracker();
        (, address poolRewardDistributor,,, address poolVester) = stakingRouter.poolTrackers(gsPool);
        esGs.mint(rewardDistributor, 50000e18);
        bnGs.mint(bonusDistributor, 50000e18);
        weth.mint(feeDistributor, 10000e18);
        esGs.mint(poolRewardDistributor, 50000e18);
        gs.mint(vester, 10000e18);
        gs.mint(poolVester, 10000e18);

        vm.startPrank(address(stakingRouter));
        RewardDistributor(rewardDistributor).setTokensPerInterval(1e16);   // 0.01 esGS per second
        BonusDistributor(bonusDistributor).setBonusMultiplier(10000);
        RewardDistributor(feeDistributor).setTokensPerInterval(1e16);       // 0.01 WETH per second
        RewardDistributor(poolRewardDistributor).setTokensPerInterval(1e16);       // 0.01 esGS per second
        vm.stopPrank();
    }
}