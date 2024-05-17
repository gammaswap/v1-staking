// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4;

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

    function setupRouter(address factory, address manager, address gsPool, address gsPool2) public {
        initRouter(factory, manager);
        
        wireUp();
        setEmissions();

        wireUpPool(gsPool, 365 days);
        setPoolEmissions(gsPool);

        wireUpPool(gsPool2, 180 days);
        setPoolEmissions(gsPool2);
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

    function wireUpPool(address gsPool, uint256 vestingPeriod) public {
        stakingRouter.setPoolVestingPeriod(vestingPeriod);
        stakingRouter.setupPoolStaking(gsPool, address(esGs), address(gs));
        stakingRouter.setupPoolStakingForLoan(gsPool, 1);
    }

    function approveUserForStaking(address user, address gsPool) public {
        (address rewardTracker,,,,,,,,address vester,) = stakingRouter.coreTracker();
        (address poolRewardTracker,,,, address poolVester) = stakingRouter.poolTrackers(gsPool, address(esGs));

        vm.startPrank(user);
        gs.approve(rewardTracker, type(uint256).max);
        esGs.approve(rewardTracker, type(uint256).max);
        esGs.approve(vester, type(uint256).max);
        esGs.approve(poolVester, type(uint256).max);
        GammaPoolERC20(gsPool).approve(poolRewardTracker, type(uint256).max);
        vm.stopPrank();
    }

    function setEmissions() public {
        (, address rewardDistributor,,,, address bonusDistributor,, address feeDistributor, address vester,) = stakingRouter.coreTracker();
        esGs.mint(rewardDistributor, 50000e18);
        bnGs.mint(bonusDistributor, 50000e18);
        weth.mint(feeDistributor, 10000e18);
        gs.mint(vester, 10000e18);

        vm.startPrank(address(stakingRouter));
        RewardDistributor(rewardDistributor).setTokensPerInterval(1e16);   // 0.01 esGS per second
        RewardDistributor(rewardDistributor).setPaused(false);
        BonusDistributor(bonusDistributor).setBonusMultiplier(10000);
        RewardDistributor(feeDistributor).setTokensPerInterval(1e16);       // 0.01 WETH per second
        RewardDistributor(feeDistributor).setPaused(false);
        vm.stopPrank();
    }

    function setPoolEmissions(address gsPool) public {
        (, address poolRewardDistributor,,, address poolVester) = stakingRouter.poolTrackers(gsPool, address(esGs));
        esGs.mint(poolRewardDistributor, 50000e18);
        gs.mint(poolVester, 10000e18);

        vm.startPrank(address(stakingRouter));
        RewardDistributor(poolRewardDistributor).setTokensPerInterval(1e16);       // 0.01 esGS per second
        RewardDistributor(poolRewardDistributor).setPaused(false);
        vm.stopPrank();
    }
}