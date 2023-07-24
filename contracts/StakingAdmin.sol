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

    // Deployers
    address public immutable rewardTrackerDeployer;
    address public immutable rewardDistributorDeployer;
    address public immutable vesterDeployer;

    uint256 public constant VESTING_DURATION = 365 * 24 * 60 * 60;

    AssetCoreTracker public coreTracker;
    mapping (address => AssetPoolTracker) public poolTrackers;

    constructor(
        address _weth,
        address _gs,
        address _esGslp,
        address _esGsb,
        address _bnGs,
        address _rewardTrackerDeployer,
        address _rewardDistributorDeployer,
        address _vesterDeployer
    ) {
        require(_weth != address(0) && _gs != address(0) && _esGsb != address(0) && _esGslp != address(0) && _bnGs != address(0), "StakingFactory: invalid constructor args");
        require(_rewardTrackerDeployer != address(0), "StakingFactory: invalid constructor args");
        require(_rewardDistributorDeployer != address(0), "StakingFactory: invalid constructor args");
        require(_vesterDeployer != address(0), "StakingFactory: invalid constructor args");

        weth = _weth;
        gs = _gs;
        esGsb = _esGsb;
        esGslp = _esGslp;
        bnGs = _bnGs;

        rewardTrackerDeployer = _rewardTrackerDeployer;
        rewardDistributorDeployer = _rewardDistributorDeployer;
        vesterDeployer = _vesterDeployer;
    }

    function setupGsStaking() external onlyOwner {
        address[] memory _depositTokens = new address[](2);
        _depositTokens[0] = gs;
        _depositTokens[1] = esGslp;
        (address _rewardTracker, address _rewardDistributor) = _combineTrackerDistributor("Staked GS", "sGS", esGslp, _depositTokens, false);

        delete _depositTokens;
        _depositTokens = new address[](1);
        _depositTokens[0] = esGsb;
        (address _loanRewardTracker, address _loanRewardDistributor) = _combineTrackerDistributor("Staked GS Loan", "sGSL", esGsb, _depositTokens, false);

        delete _depositTokens;
        _depositTokens = new address[](2);
        _depositTokens[0] = _rewardTracker;
        _depositTokens[1] = _loanRewardTracker;
        (address _bonusTracker, address _bonusDistributor) = _combineTrackerDistributor("Staked + Bonus GS", "sbGS", bnGs, _depositTokens, true);

        delete _depositTokens;
        _depositTokens = new address[](2);
        _depositTokens[0] = _bonusTracker;
        _depositTokens[1] = bnGs;
        (address _feeTracker, address _feeDistributor) = _combineTrackerDistributor("Staked + Bonus + Fee GS", "sbfGS", weth, _depositTokens, false);

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

    function setupLpStaking(address _gsPool) external onlyOwner {
        address[] memory _depositTokens = new address[](1);
        _depositTokens[0] = _gsPool;
        (address _rewardTracker, address _rewardDistributor) = _combineTrackerDistributor("Staked GS LP", "sGSLP", esGslp, _depositTokens, false);

        delete _depositTokens;
        _depositTokens = new address[](1);
        _depositTokens[0] = esGsb;
        (address _loanRewardTracker, address _loanRewardDistributor) = _combineTrackerDistributor("Staked GS Loan", "sGSL", esGsb, _depositTokens, false);

        address _vester = vesterDeployer.deployContract(
            abi.encodeWithSelector(VESTER_DEPLOYER, "Vested GS LP", "vGSLP", VESTING_DURATION, esGslp, _rewardTracker, gs, _rewardTracker)
        );

        address _loanVester = vesterDeployer.deployContract(
            abi.encodeWithSelector(VESTER_NORESERVE_DEPLOYER, "Vested GS Borrowed", "vGSB", VESTING_DURATION, esGsb, gs, _loanRewardTracker)
        );

        IRewardTracker(_rewardTracker).setHandler(_vester, true);
        IVester(_vester).setHandler(address(this), true);
        IVester(_loanVester).setHandler(address(this), true);

        poolTrackers[_gsPool] = AssetPoolTracker({
            rewardTracker: _rewardTracker,
            rewardDistributor: _rewardDistributor,
            loanRewardTracker: _loanRewardTracker,
            loanRewardDistributor: _loanRewardDistributor,
            vester: _vester,
            loanVester: _loanVester
        });
    }

    function execute(address _stakingContract, bytes memory _data) external onlyOwner {
        require(
            _stakingContract.supportsInterface(type(IRewardTracker).interfaceId) ||
            _stakingContract.supportsInterface(type(IRewardDistributor).interfaceId) ||
            _stakingContract.supportsInterface(type(IVester).interfaceId),
            "StakingAdmin: cannot execute"
        );

        (bool success, bytes memory result) = _stakingContract.call(_data);
        if (!success) {
            if (result.length == 0) revert("StakingAdmin: execute failed");
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
        bool isBonusDistributor
    ) private returns (address, address) {
        address tracker = rewardTrackerDeployer.deployContract(
            abi.encodeWithSelector(REWARD_TRACKER_DEPLOYER, _name, _symbol)
        );

        bytes4 selector = isBonusDistributor ? BONUS_DISTRIBUTOR_DEPLOYER : REWARD_DISTRIBUTOR_DEPLOYER;
        address distributor = rewardDistributorDeployer.deployContract(
            abi.encodeWithSelector(selector, _rewardToken, tracker)
        );
        IRewardTracker(tracker).initialize(_depositTokens, distributor);
        IRewardTracker(tracker).setHandler(address(this), true);
        IRewardDistributor(distributor).updateLastDistributionTime();

        return (tracker, distributor);
    }
}