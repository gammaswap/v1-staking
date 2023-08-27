// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@gammaswap/v1-core/contracts/base/GammaPoolERC20.sol";

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
        (address poolRewardTracker,,,,) = stakingRouter.poolTrackers(address(pool));
    
        vm.startPrank(user1);
        stakingRouter.stakeLp(address(pool), 1000e18);
        assertEq(IERC20(poolRewardTracker).balanceOf(user1), 1000e18);
        assertEq(IRewardTracker(poolRewardTracker).stakedAmounts(user1), 1000e18);
        assertEq(IRewardTracker(poolRewardTracker).depositBalances(user1, address(pool)), 1000e18);
        vm.stopPrank();
    }

    /// @notice stake lp in pool -> claim -> vest -> claim
    function testStakeLpClaimVestInPool(uint256 lpAmount1, uint256 lpAmount2) public {
        lpAmount1 = bound(lpAmount1, 1e18, 10000e18);
        lpAmount2 = bound(lpAmount2, 1e18, 10000e18);
        (address poolRewardTracker,,,,) = stakingRouter.poolTrackers(address(pool));

        uint256 lpBalanceBeforeUser1 = GammaPoolERC20(pool).balanceOf(user1);
        uint256 lpBalanceBeforeUser2 = GammaPoolERC20(pool).balanceOf(user2);

        ////////// STAKING //////////
        vm.prank(user1);
        stakingRouter.stakeLp(address(pool), lpAmount1);
        vm.prank(user2);
        stakingRouter.stakeLp(address(pool), lpAmount2);

        assertApproxEqRel(GammaPoolERC20(pool).balanceOf(user1), lpBalanceBeforeUser1 - lpAmount1, 1e4);
        assertApproxEqRel(GammaPoolERC20(pool).balanceOf(user2), lpBalanceBeforeUser2 - lpAmount2, 1e4);

        vm.warp(block.timestamp + 1 days);

        uint256 esGsRewards1 = 86400 * 1e16 * lpAmount1/(lpAmount1+lpAmount2);
        uint256 esGsRewards2 = 86400 * 1e16 * lpAmount2/(lpAmount1+lpAmount2);
        assertApproxEqRel(IRewardTracker(poolRewardTracker).claimable(user1), esGsRewards1, 1e4);
        assertApproxEqRel(IRewardTracker(poolRewardTracker).claimable(user2), esGsRewards2, 1e4);

        ////////// CLAIMING //////////
        vm.prank(user1);
        stakingRouter.claimPool(address(pool));
        vm.prank(user2);
        stakingRouter.claimPool(address(pool));
        assertApproxEqRel(esGs.balanceOf(user1), esGsRewards1, 1e4);
        assertApproxEqRel(esGs.balanceOf(user2), esGsRewards2, 1e4);
        assertEq(gs.balanceOf(user1), 0);
        assertEq(gs.balanceOf(user2), 0);

        ////////// VESTING //////////
        vm.prank(user1);
        vm.expectRevert("StakingRouter: forbidden");
        stakingRouter.unstakeLpForAccount(user2, address(pool), lpAmount2);

        vm.prank(address(manager));
        stakingRouter.unstakeLpForAccount(user2, address(pool), lpAmount2);

        vm.startPrank(user2);
        vm.expectRevert("Vester: invalid _amount");
        stakingRouter.vestEsGsForPool(address(pool), 0);
        esGsRewards2 = esGs.balanceOf(user2);
        vm.expectRevert();
        stakingRouter.vestEsGsForPool(address(pool), esGsRewards2);

        stakingRouter.stakeLp(address(pool), lpAmount2);    // Stake Lp tokens again to satisfy average staked amounts
        stakingRouter.vestEsGsForPool(address(pool), esGsRewards2);

        vm.warp(block.timestamp + 365 days);

        stakingRouter.claimPool(address(pool));
        assertEq(gs.balanceOf(user2), esGsRewards2);
        vm.stopPrank();
    }
}