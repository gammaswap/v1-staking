// SPDX-License-Identifier: BUSL-1.1
pragma solidity >=0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@gammaswap/v1-core/contracts/base/GammaPoolERC20.sol";

import "../../contracts/interfaces/IRewardTracker.sol";
import "./fixtures/CPMMGammaSwapSetup.sol";

contract StakingRouterTest is CPMMGammaSwapSetup {
    function setUp() public {
        super.initCPMMGammaSwap();
        depositLiquidityInCFMM(user1, address(usdc), address(weth), 2*1e24, 2*1e21);
        depositLiquidityInCFMM(user2, address(usdc), address(weth), 2*1e24, 2*1e21);
        depositLiquidityInPool(user1, address(cfmm), address(pool));
        depositLiquidityInPool(user2, address(cfmm), address(pool));

        approveUserForStaking(user1, address(pool));
        approveUserForStaking(user2, address(pool));

        depositLiquidityInCFMM(user1, address(usdt), address(weth), 2*1e24, 2*1e21);
        depositLiquidityInCFMM(user2, address(usdt), address(weth), 2*1e24, 2*1e21);
        depositLiquidityInPool(user1, address(cfmm2), address(pool2));
        depositLiquidityInPool(user2, address(cfmm2), address(pool2));

        approveUserForStaking(user1, address(pool2));
        approveUserForStaking(user2, address(pool2));
    }

    function testProtocolAssets() public {
        assertGt(pool.totalSupply(), 0);
    }

    function testFailStakeInvalidAssetInPool() public {
        vm.startPrank(user1);
        stakingRouter.stakeLp(address(weth), address(esGs), 1000e18);
        vm.stopPrank();
    }

    function testSuccessStakeLpInPool() public {
        (address poolRewardTracker,,,,) = stakingRouter.poolTrackers(address(pool), address(esGs));
    
        vm.startPrank(user1);
        stakingRouter.stakeLp(address(pool), address(esGs), 1000e18);
        assertEq(IERC20(poolRewardTracker).balanceOf(user1), 1000e18);
        assertEq(IRewardTracker(poolRewardTracker).stakedAmounts(user1), 1000e18);
        assertEq(IRewardTracker(poolRewardTracker).depositBalances(user1, address(pool)), 1000e18);
        vm.stopPrank();
    }

    /// @notice stake lp in pool -> claim -> vest -> claim
    function testStakeLpClaimVestInPool(uint256 lpAmount1, uint256 lpAmount2) public {
        lpAmount1 = bound(lpAmount1, 1e18, 10000e18);
        lpAmount2 = bound(lpAmount2, 1e18, 10000e18);
        (address poolRewardTracker,,,,) = stakingRouter.poolTrackers(address(pool), address(esGs));
        (address poolRewardTracker2,,,,) = stakingRouter.poolTrackers(address(pool2), address(esGs));

        uint256 lpBalanceBeforeUser1 = GammaPoolERC20(pool).balanceOf(user1);
        uint256 lpBalanceBeforeUser2 = GammaPoolERC20(pool).balanceOf(user2);

        ////////// STAKING //////////
        vm.prank(user1);
        stakingRouter.stakeLp(address(pool), address(esGs), lpAmount1);
        vm.prank(user1);
        stakingRouter.stakeLp(address(pool2), address(esGs), lpAmount1);
        vm.prank(user2);
        stakingRouter.stakeLp(address(pool), address(esGs), lpAmount2);
        vm.prank(user2);
        stakingRouter.stakeLp(address(pool2), address(esGs), lpAmount2);

        assertApproxEqRel(GammaPoolERC20(pool).balanceOf(user1), lpBalanceBeforeUser1 - lpAmount1, 1e4);
        assertApproxEqRel(GammaPoolERC20(pool).balanceOf(user2), lpBalanceBeforeUser2 - lpAmount2, 1e4);

        vm.warp(block.timestamp + 1 days);

        uint256 esGsRewards1 = 86400 * 1e16 * lpAmount1/(lpAmount1+lpAmount2);
        uint256 esGsRewards2 = 86400 * 1e16 * lpAmount2/(lpAmount1+lpAmount2);
        assertApproxEqRel(IRewardTracker(poolRewardTracker).claimable(user1), esGsRewards1, 1e4);
        assertApproxEqRel(IRewardTracker(poolRewardTracker).claimable(user2), esGsRewards2, 1e4);
        assertApproxEqRel(IRewardTracker(poolRewardTracker2).claimable(user1), esGsRewards1, 1e4);
        assertApproxEqRel(IRewardTracker(poolRewardTracker2).claimable(user2), esGsRewards2, 1e4);

        ////////// CLAIMING //////////
        vm.prank(user1);
        stakingRouter.claimPool(address(pool), address(esGs), true, true);
        vm.prank(user1);
        stakingRouter.claimPool(address(pool2), address(esGs), true, true);
        vm.prank(user2);
        stakingRouter.claimPool(address(pool), address(esGs), true, true);
        vm.prank(user2);
        stakingRouter.claimPool(address(pool2), address(esGs), true, true);
        assertApproxEqRel(esGs.balanceOf(user1), 2*esGsRewards1, 1e4);
        assertApproxEqRel(esGs.balanceOf(user2), 2*esGsRewards2, 1e4);
        assertEq(gs.balanceOf(user1), 0);
        assertEq(gs.balanceOf(user2), 0);

        ////////// VESTING //////////
        vm.prank(user1);
        vm.expectRevert("StakingRouter: forbidden");
        stakingRouter.unstakeLpForAccount(user2, address(pool), address(esGs), lpAmount2);

        vm.prank(address(manager));
        stakingRouter.unstakeLpForAccount(user2, address(pool), address(esGs), lpAmount2);

        vm.startPrank(user2);
        vm.expectRevert("Vester: invalid _amount");
        stakingRouter.vestEsGsForPool(address(pool), address(esGs), 0);
        esGsRewards2 = esGs.balanceOf(user2);
        vm.expectRevert();
        stakingRouter.vestEsGsForPool(address(pool), address(esGs), esGsRewards2/2);

        stakingRouter.stakeLp(address(pool), address(esGs), lpAmount2);    // Stake Lp tokens again to satisfy average staked amounts
        stakingRouter.vestEsGsForPool(address(pool), address(esGs), esGsRewards2/2);

        stakingRouter.stakeLp(address(pool2), address(esGs), lpAmount2);    // Stake Lp tokens again to satisfy average staked amounts
        stakingRouter.vestEsGsForPool(address(pool2), address(esGs), esGsRewards2/2);

        vm.warp(block.timestamp + 180 days);

        stakingRouter.claimPool(address(pool2), address(esGs), true, true);
        assertEq(gs.balanceOf(user2), esGsRewards2/2);

        stakingRouter.claimPool(address(pool), address(esGs), true, true);
        assertLt(gs.balanceOf(user2), esGsRewards2);

        vm.warp(block.timestamp + 365 days);

        stakingRouter.claimPool(address(pool), address(esGs), true, true);
        assertEq(gs.balanceOf(user2), esGsRewards2);

        stakingRouter.claimPool(address(pool2), address(esGs), true, true);
        assertEq(gs.balanceOf(user2), esGsRewards2);

        vm.stopPrank();
    }

    function testAutoStakeAndUnstake() public {
        (address poolRewardTracker,,,,) = stakingRouter.poolTrackers(address(pool), address(esGs));

        vm.startPrank(user1);
        usdc.approve(address(manager), type(uint256).max);
        weth.approve(address(manager), type(uint256).max);
        pool.approve(address(manager), type(uint256).max);

        uint256[] memory amountsDesired = new uint256[](2);
        uint256[] memory amountsMin = new uint256[](2);
        amountsDesired[0] = 1e21;
        amountsDesired[1] = 1e18;
        IPositionManager.DepositReservesParams memory params = IPositionManager.DepositReservesParams({
            protocolId: 1,
            cfmm: cfmm,
            to: user1,
            deadline: type(uint256).max,
            amountsDesired: amountsDesired,
            amountsMin: amountsMin
        });

        assertEq(IERC20(poolRewardTracker).balanceOf(user1), 0);
        (uint256[] memory reserves, uint256 shares) = manager.depositReservesAndStake(params, address(esGs));

        assertGt(reserves[0], 0);
        assertGt(reserves[1], 0);
        assertGt(shares, 0);

        assertEq(IERC20(poolRewardTracker).balanceOf(user1), shares);

        IPositionManager.WithdrawReservesParams memory params2 = IPositionManager.WithdrawReservesParams({
            protocolId: 1,
            cfmm: cfmm,
            to: user1,
            deadline: type(uint256).max,
            amount: shares,
            amountsMin: amountsMin
        });
        (uint256[] memory reserves2,) = manager.withdrawReservesAndUnstake(params2, address(esGs));
        assertApproxEqRel(reserves[0], reserves2[0], 1e2);
        assertApproxEqRel(reserves[1], reserves2[1], 1e2);
    }
}