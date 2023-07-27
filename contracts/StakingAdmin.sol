// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";

import "./interfaces/IRewardDistributor.sol";
import "./interfaces/IRewardTracker.sol";
import "./interfaces/IVester.sol";
import "./interfaces/IStakingAdmin.sol";
import "./deployers/DeployerUtils.sol";

abstract contract StakingAdmin is Ownable2Step, IStakingAdmin {
    using ERC165Checker for address;
    using DeployerUtils for address;

    address public immutable weth;
    address public immutable gs;
    address public immutable esGsb;
    address public immutable esGslp;
    address public immutable bnGs;
    address public immutable factory;
    address public immutable manager;

    // Deployers
    address private immutable rewardTrackerDeployer;
    address private immutable rewardDistributorDeployer;
    address private immutable vesterDeployer;

    uint256 public constant VESTING_DURATION = 365 * 24 * 60 * 60;

    AssetCoreTracker public coreTracker;
    mapping (address => AssetPoolTracker) public poolTrackers;

    constructor(
        address _weth,
        address _gs,
        address _esGslp,
        address _esGsb,
        address _bnGs,
        address _factory,
        address _manager,
        address _rewardTrackerDeployer,
        address _rewardDistributorDeployer,
        address _vesterDeployer
    ) {
        if (
            _weth == address(0) || _gs == address(0) || _esGslp != address(0) || _esGsb != address(0) || _bnGs == address(0) || _manager == address(0) ||
            _rewardTrackerDeployer == address(0) || _rewardDistributorDeployer == address(0) || _vesterDeployer == address(0)
        ) {
            revert InvalidConstructor();
        }

        weth = _weth;
        gs = _gs;
        esGsb = _esGsb;
        esGslp = _esGslp;
        bnGs = _bnGs;
        factory = _factory;
        manager = _manager;

        rewardTrackerDeployer = _rewardTrackerDeployer;
        rewardDistributorDeployer = _rewardDistributorDeployer;
        vesterDeployer = _vesterDeployer;
    }

    function setupGsStaking() external onlyOwner {
        address[] memory _depositTokens = new address[](2);
        _depositTokens[0] = gs;
        _depositTokens[1] = esGslp;
        (address _rewardTracker, address _rewardDistributor) = _combineTrackerDistributor("Staked GS", "sGS", esGslp, _depositTokens, 0, false);

        delete _depositTokens;
        _depositTokens = new address[](1);
        _depositTokens[0] = esGsb;
        (address _loanRewardTracker, address _loanRewardDistributor) = _combineTrackerDistributor("Staked GS Loan", "sGSL", esGsb, _depositTokens, 0, false);

        delete _depositTokens;
        _depositTokens = new address[](2);
        _depositTokens[0] = _rewardTracker;
        _depositTokens[1] = _loanRewardTracker;
        (address _bonusTracker, address _bonusDistributor) = _combineTrackerDistributor("Staked + Bonus GS", "sbGS", bnGs, _depositTokens, 0, true);

        delete _depositTokens;
        _depositTokens = new address[](2);
        _depositTokens[0] = _bonusTracker;
        _depositTokens[1] = bnGs;
        (address _feeTracker, address _feeDistributor) = _combineTrackerDistributor("Staked + Bonus + Fee GS", "sbfGS", weth, _depositTokens, 0, false);

        address _vester = vesterDeployer.deployContract(
            abi.encodeWithSelector(VESTER_DEPLOYER, "Vested GS LP", "vGSLP", VESTING_DURATION, esGslp, _feeTracker, gs, _rewardTracker)
        );
        address _loanVester = vesterDeployer.deployContract(
            abi.encodeWithSelector(VESTER_NORESERVE_DEPLOYER, "Vested GS Borrowed", "vGSB", VESTING_DURATION, esGsb, gs, _loanRewardTracker)
        );

        IRewardTracker(_rewardTracker).setHandler(_bonusTracker, true);
        IRewardTracker(_loanRewardTracker).setHandler(_bonusTracker, true);
        IRewardTracker(_bonusTracker).setHandler(_feeTracker, true);
        IRewardTracker(_feeTracker).setHandler(_vester, true);
        IVester(_vester).setHandler(address(this), true);
        IVester(_loanVester).setHandler(address(this), true);

        coreTracker = AssetCoreTracker({
            rewardTracker: _rewardTracker,
            rewardDistributor: _rewardDistributor,
            loanRewardTracker: _loanRewardTracker,
            loanRewardDistributor: _loanRewardDistributor,
            bonusTracker: _bonusTracker,
            bonusDistributor: _bonusDistributor,
            feeTracker: _feeTracker,
            feeDistributor: _feeDistributor,
            vester: _vester,
            loanVester: _loanVester
        });
    }

    function setupLpStaking(address _gsPool, uint16 _refId) external onlyOwner {
        address[] memory _depositTokens = new address[](1);
        _depositTokens[0] = _gsPool;
        (address _rewardTracker, address _rewardDistributor) = _combineTrackerDistributor("Staked GS LP", "sGSLP", esGslp, _depositTokens, 0, false);

        delete _depositTokens;
        _depositTokens = new address[](1);
        _depositTokens[0] = esGsb;
        (address _loanRewardTracker, address _loanRewardDistributor) = _combineTrackerDistributor("Staked GS Loan", "sGSL", esGsb, _depositTokens, _refId, false);

        address _vester = vesterDeployer.deployContract(
            abi.encodeWithSelector(VESTER_DEPLOYER, "Vested GS LP", "vGSLP", VESTING_DURATION, esGslp, _rewardTracker, gs, _rewardTracker)
        );

        IRewardTracker(_rewardTracker).setHandler(_vester, true);
        IVester(_vester).setHandler(address(this), true);

        poolTrackers[_gsPool] = AssetPoolTracker({
            rewardTracker: _rewardTracker,
            rewardDistributor: _rewardDistributor,
            loanRewardTracker: _loanRewardTracker,
            loanRewardDistributor: _loanRewardDistributor,
            vester: _vester
        });
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

    function _combineTrackerDistributor(
        string memory _name,
        string memory _symbol,
        address _rewardToken,
        address[] memory _depositTokens,
        uint16 _refId,
        bool _isBonusDistributor
    ) private returns (address, address) {
        address tracker;
        if (_refId > 0) {
            tracker = rewardTrackerDeployer.deployContract(
                abi.encodeWithSelector(LOAN_TRACKER_DEPLOYER, factory, _refId, manager, _name, _symbol)
            );
        } else {
            tracker = rewardTrackerDeployer.deployContract(
                abi.encodeWithSelector(REWARD_TRACKER_DEPLOYER, _name, _symbol)
            );
        }

        bytes4 selector = _isBonusDistributor ? BONUS_DISTRIBUTOR_DEPLOYER : REWARD_DISTRIBUTOR_DEPLOYER;
        address distributor = rewardDistributorDeployer.deployContract(
            abi.encodeWithSelector(selector, _rewardToken, tracker)
        );
        IRewardTracker(tracker).initialize(_depositTokens, distributor);
        IRewardTracker(tracker).setHandler(address(this), true);
        IRewardDistributor(distributor).updateLastDistributionTime();

        return (tracker, distributor);
    }
}