// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../../contracts/interfaces/IRewardTracker.sol";
import "./fixtures/CPMMGammaSwapSetup.sol";

contract StakingRouterTest is CPMMGammaSwapSetup {

    function setUp() public {
        super.initCPMMGammaSwap();
        depositLiquidityInCFMM(user1, 2*1e24, 2*1e21);
        depositLiquidityInCFMM(user2, 2*1e24, 2*1e21);
        depositLiquidityInPool(user1);
        depositLiquidityInPool(user2);

        approveUserForStaking(user1, address(pool));
        approveUserForStaking(user2, address(pool));
    }

    function testProtocolAssets() public {
        assertGt(pool.totalSupply(), 0);
    }

    function testFailStakeInvalidAssetInPool() public {
        vm.startPrank(user1);
        stakingRouter.stakeLp(address(weth), 1000e18);
        vm.stopPrank();
    }

    function testSuccessStakeLpInPool() public {
        vm.startPrank(user1);
        stakingRouter.stakeLp(address(pool), 1000e18);
        (address poolRewardTracker,,,,) = stakingRouter.poolTrackers(address(pool));
        assertEq(IERC20(poolRewardTracker).balanceOf(user1), 100e18);
        vm.stopPrank();
    }

    function testStakeLpClaimVestInPool() public {
        (address poolRewardTracker,,,,) = stakingRouter.poolTrackers(address(pool));

        vm.startPrank(user1);
        stakingRouter.stakeLp(address(pool), 1000e18);
        assertEq(IERC20(poolRewardTracker).balanceOf(user1), 1000e18);
        assertEq(IRewardTracker(poolRewardTracker).stakedAmounts(user1), 1000e18);
        assertEq(IRewardTracker(poolRewardTracker).depositBalances(user1, address(pool)), 1000e18);

        vm.warp(block.timestamp + 1 days);

        assertEq(IRewardTracker(poolRewardTracker).claimable(user1), 86400 * 1e16);
        vm.stopPrank();
    }
}