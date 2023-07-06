// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";

import "./interfaces/IRewardDistributor.sol";
import "./interfaces/IRewardTracker.sol";
import "./interfaces/IVester.sol";
import "./interfaces/IStakingFactory.sol";
import "./RewardTracker.sol";
import "./RewardDistributor.sol";
import "./BonusDistributor.sol";
import "./Vester.sol";

contract StakingFactory is Ownable2Step, IStakingFactory {
    address private weth;
    address private gs;
    address private esGs;
    address private bnGs;
    address private stakingRouter;

    IRewardTracker public rewardTracker;
    IRewardDistributor public rewardDistributor;
    IRewardTracker public bonusTracker;
    IRewardDistributor public bonusDistributor;
    IRewardTracker public feeRewardTracker;
    IRewardDistributor public feeRewardDistributor;
    IVester public vester;

    uint256 public constant VESTING_DURATION = 365 * 24 * 60 * 60;

    // GammaPool -> RewardTracker
    mapping (address => IRewardTracker) public lpRewardTrackers;
    // GammaPool -> RewardDistributor
    mapping (address => IRewardDistributor) public lpRewardDistributors;
    // GammaPool -> Vester
    mapping (address => IVester) public lpVesters;

    constructor(address _weth, address _gs, address _esGs, address _bnGs) {
        require(_weth != address(0) && _gs != address(0) && _esGs != address(0) && _bnGs != address(0), "StakingFactory: invalid constructor");

        weth = _weth;
        gs = _gs;
        esGs = _esGs;
        bnGs = _bnGs;
    }

    function setStakingRouter(address _stakingRouter) external onlyOwner {
        stakingRouter = _stakingRouter;
    }

    function setupLpStaking(address _gsPool) external onlyOwner {
        require(stakingRouter != address(0), "StakingFactory: stakingRouter not set");

        RewardTracker _lpRewardTracker = new RewardTracker("Staked GSLP", "sGSLP");
        RewardDistributor _lpRewardDistributor = new RewardDistributor(esGs, address(_lpRewardTracker));
        address[] memory _depositTokens = new address[](1);
        _depositTokens[0] = _gsPool;
        _lpRewardTracker.initialize(_depositTokens, address(_lpRewardDistributor));
        _lpRewardDistributor.updateLastDistributionTime();
        _lpRewardTracker.setInPrivateTransferMode(true);
        _lpRewardTracker.setInPrivateStakingMode(true);

        Vester _lpVester = new Vester("Vested GSLP", "vGSLP", VESTING_DURATION, esGs, address(_lpRewardTracker), gs, address(_lpRewardTracker));

        _lpRewardTracker.setHandler(stakingRouter, true);
        _lpRewardTracker.setHandler(address(_lpVester), true);
        _lpVester.setHandler(stakingRouter, true);

        lpRewardTrackers[_gsPool] = _lpRewardTracker;
        lpRewardDistributors[_gsPool] = _lpRewardDistributor;
        lpVesters[_gsPool] = _lpVester;
    }

    function setupGsStaking() external onlyOwner {
        require(stakingRouter != address(0), "StakingFactory: stakingRouter not set");

        RewardTracker _rewardTracker = new RewardTracker("Staked GS", "sGS");
        RewardDistributor _rewardDistributor = new RewardDistributor(esGs, address(_rewardTracker));
        address[] memory _depositTokens = new address[](2);
        _depositTokens[0] = gs;
        _depositTokens[1] = esGs;
        _rewardTracker.initialize(_depositTokens, address(_rewardDistributor));
        _rewardDistributor.updateLastDistributionTime();
        _rewardTracker.setInPrivateTransferMode(true);
        _rewardTracker.setInPrivateStakingMode(true);

        RewardTracker _bonusTracker = new RewardTracker("Staked + Bonus GS", "sbGS");
        BonusDistributor _bonusDistributor = new BonusDistributor(bnGs, address(_bonusTracker));
        _depositTokens = new address[](1);
        _depositTokens[0] = address(_rewardTracker);
        _bonusTracker.initialize(_depositTokens, address(_bonusDistributor));
        _bonusDistributor.updateLastDistributionTime();
        _bonusTracker.setInPrivateTransferMode(true);
        _bonusTracker.setInPrivateStakingMode(true);

        RewardTracker _feeRewardTracker = new RewardTracker("Staked + Bonus + Fee GS", "sbfGS");
        RewardDistributor _feeRewardDistributor = new RewardDistributor(weth, address(_feeRewardTracker));
        _depositTokens = new address[](2);
        _depositTokens[0] = address(_bonusTracker);
        _depositTokens[1] = bnGs;
        _feeRewardTracker.initialize(_depositTokens, address(_feeRewardDistributor));
        _feeRewardDistributor.updateLastDistributionTime();
        _feeRewardTracker.setInPrivateTransferMode(true);
        _feeRewardTracker.setInPrivateStakingMode(true);

        Vester _vester = new Vester("Vested GS", "vGS", VESTING_DURATION, esGs, address(_feeRewardTracker), gs, address(_rewardTracker));

        _rewardTracker.setHandler(stakingRouter, true);
        _rewardTracker.setHandler(address(_bonusTracker), true);
        _bonusTracker.setHandler(stakingRouter, true);
        _bonusTracker.setHandler(address(_feeRewardTracker), true);
        _feeRewardTracker.setHandler(stakingRouter, true);
        _feeRewardTracker.setHandler(address(_vester), true);
        _vester.setHandler(stakingRouter, true);

        rewardTracker = _rewardTracker;
        rewardDistributor = _rewardDistributor;
        bonusTracker = _bonusTracker;
        bonusDistributor = _bonusDistributor;
        feeRewardTracker = _feeRewardTracker;
        feeRewardDistributor = _feeRewardDistributor;
        vester = _vester;
    }
}