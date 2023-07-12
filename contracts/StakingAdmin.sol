// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";

import "./interfaces/IRewardDistributor.sol";
import "./interfaces/IRewardTracker.sol";
import "./interfaces/IVester.sol";
import "./interfaces/IStakingAdmin.sol";
import "./deployers/DeployerUtils.sol";

contract StakingAdmin is Ownable2Step, IStakingAdmin {
    using ERC165Checker for address;
    using DeployerUtils for address;

    address internal immutable weth;
    address internal immutable gs;
    address internal immutable esGs;
    address internal immutable bnGs;
    address internal immutable manager;

    // Deployers
    address private immutable rewardTrackerDeployer;
    address private immutable rewardDistributorDeployer;
    address private immutable vesterDeployer;

    IRewardTracker public rewardTracker;
    IRewardDistributor public rewardDistributor;
    IRewardTracker public bonusTracker;
    IRewardDistributor public bonusDistributor;
    IRewardTracker public feeRewardTracker;
    IRewardDistributor public feeRewardDistributor;
    IVester public vester;

    uint256 internal constant VESTING_DURATION = 365 * 24 * 60 * 60;

    // GammaPool -> RewardTracker
    mapping (address => IRewardTracker) public lpRewardTrackers;
    // GammaPool -> RewardDistributor
    mapping (address => IRewardDistributor) public lpRewardDistributors;
    // GammaPool -> Vester
    mapping (address => IVester) public lpVesters;

    constructor(
        address _weth,
        address _gs,
        address _esGs,
        address _bnGs,
        address _manager,
        address _rewardTrackerDeployer,
        address _rewardDistributorDeployer,
        address _vesterDeployer
    ) {
        if (
            _weth == address(0) || _gs == address(0) || _esGs != address(0) || _bnGs == address(0) || _manager == address(0) ||
            _rewardTrackerDeployer == address(0) || _rewardDistributorDeployer == address(0) || _vesterDeployer == address(0)
        ) {
            revert InvalidConstructor();
        }

        weth = _weth;
        gs = _gs;
        esGs = _esGs;
        bnGs = _bnGs;
        manager = _manager;

        rewardTrackerDeployer = _rewardTrackerDeployer;
        rewardDistributorDeployer = _rewardDistributorDeployer;
        vesterDeployer = _vesterDeployer;
    }

    function setupGsStaking() external onlyOwner {
        IRewardTracker _rewardTracker = IRewardTracker(
            rewardTrackerDeployer.deployContract(
                abi.encodeWithSelector(REWARDTRACKER_DEPLOYER, "Staked GS", "sGS")
            )
        );
        IRewardDistributor _rewardDistributor = IRewardDistributor(
            rewardDistributorDeployer.deployContract(
                abi.encodeWithSelector(REWARDDISTRIBUTOR_DEPLOYER, esGs, address(_rewardTracker))
            )
        );
        address[] memory _depositTokens = new address[](2);
        _depositTokens[0] = gs;
        _depositTokens[1] = esGs;
        _rewardTracker.initialize(_depositTokens, address(_rewardDistributor));
        _rewardDistributor.updateLastDistributionTime();
        _rewardTracker.setInPrivateTransferMode(true);
        _rewardTracker.setInPrivateStakingMode(true);

        IRewardTracker _bonusTracker = IRewardTracker(
            rewardTrackerDeployer.deployContract(
                abi.encodeWithSelector(REWARDTRACKER_DEPLOYER, "Staked + Bonus GS", "sbGS")
            )
        );
        IRewardDistributor _bonusDistributor = IRewardDistributor(
            rewardDistributorDeployer.deployContract(
                abi.encodeWithSelector(BONUSDISTRIBUTOR_DEPLOYER, bnGs, address(_bonusTracker))
            )
        );

        delete _depositTokens;

        _depositTokens = new address[](1);
        _depositTokens[0] = address(_rewardTracker);
        _bonusTracker.initialize(_depositTokens, address(_bonusDistributor));
        _bonusDistributor.updateLastDistributionTime();
        _bonusTracker.setInPrivateTransferMode(true);
        _bonusTracker.setInPrivateStakingMode(true);

        IRewardTracker _feeRewardTracker = IRewardTracker(
            rewardTrackerDeployer.deployContract(
                abi.encodeWithSelector(REWARDTRACKER_DEPLOYER, "Staked + Bonus + Fee GS", "sbfGS")
            )
        );
        IRewardDistributor _feeRewardDistributor = IRewardDistributor(
            rewardDistributorDeployer.deployContract(
                abi.encodeWithSelector(REWARDDISTRIBUTOR_DEPLOYER, weth, address(_feeRewardTracker))
            )
        );

        delete _depositTokens;

        _depositTokens = new address[](2);
        _depositTokens[0] = address(_bonusTracker);
        _depositTokens[1] = bnGs;
        _feeRewardTracker.initialize(_depositTokens, address(_feeRewardDistributor));
        _feeRewardDistributor.updateLastDistributionTime();
        _feeRewardTracker.setInPrivateTransferMode(true);
        _feeRewardTracker.setInPrivateStakingMode(true);

        IVester _vester = IVester(
            vesterDeployer.deployContract(
                abi.encodeWithSelector(VESTER_DEPLOYER, "Vested GS", "vGS", VESTING_DURATION, esGs, address(_feeRewardTracker), gs, address(_rewardTracker))
            )
        );

        _rewardTracker.setHandler(address(this), true);
        _rewardTracker.setHandler(address(_bonusTracker), true);
        _bonusTracker.setHandler(address(this), true);
        _bonusTracker.setHandler(address(_feeRewardTracker), true);
        _feeRewardTracker.setHandler(address(this), true);
        _feeRewardTracker.setHandler(address(_vester), true);
        _vester.setHandler(address(this), true);

        rewardTracker = _rewardTracker;
        rewardDistributor = _rewardDistributor;
        bonusTracker = _bonusTracker;
        bonusDistributor = _bonusDistributor;
        feeRewardTracker = _feeRewardTracker;
        feeRewardDistributor = _feeRewardDistributor;
        vester = _vester;
    }

    function setupLpStaking(address _gsPool) external onlyOwner {
        IRewardTracker _lpRewardTracker = IRewardTracker(
            rewardTrackerDeployer.deployContract(
                abi.encodeWithSelector(REWARDTRACKER_DEPLOYER, "Staked GSLP", "sGSLP")
            )
        );
        IRewardDistributor _lpRewardDistributor = IRewardDistributor(
            rewardDistributorDeployer.deployContract(
                abi.encodeWithSelector(REWARDDISTRIBUTOR_DEPLOYER, esGs, address(_lpRewardTracker))
            )
        );
        address[] memory _depositTokens = new address[](1);
        _depositTokens[0] = _gsPool;
        _lpRewardTracker.initialize(_depositTokens, address(_lpRewardDistributor));
        _lpRewardDistributor.updateLastDistributionTime();
        _lpRewardTracker.setInPrivateTransferMode(true);
        _lpRewardTracker.setInPrivateStakingMode(true);

        IVester _lpVester = IVester(
            vesterDeployer.deployContract(
                abi.encodeWithSelector(VESTER_DEPLOYER, "Vested GSLP", "vGSLP", VESTING_DURATION, esGs, address(_lpRewardTracker), gs, address(_lpRewardTracker))
            )
        );

        _lpRewardTracker.setHandler(address(this), true);
        _lpRewardTracker.setHandler(address(_lpVester), true);
        _lpVester.setHandler(address(this), true);

        lpRewardTrackers[_gsPool] = _lpRewardTracker;
        lpRewardDistributors[_gsPool] = _lpRewardDistributor;
        lpVesters[_gsPool] = _lpVester;
    }

    function execute(address _stakingContract, bytes memory _data) external onlyOwner {
        if(
            !_stakingContract.supportsInterface(type(IRewardTracker).interfaceId) &&
            !_stakingContract.supportsInterface(type(IRewardDistributor).interfaceId) &&
            !_stakingContract.supportsInterface(type(IVester).interfaceId)
        ) {
            revert InvalidExecute();
        }

        (bool success, bytes memory result) = _stakingContract.call(_data);
        if (!success) {
            if (result.length == 0) revert ExecuteFailed();
            assembly {
                revert(add(32, result), mload(result))
            }
        }
    }
}