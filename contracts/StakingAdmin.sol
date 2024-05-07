// SPDX-License-Identifier: MIT
pragma solidity >=0.8.13;

import "@gammaswap/v1-core/contracts/libraries/GammaSwapLibrary.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";

import "./interfaces/IRewardTracker.sol";
import "./interfaces/ILoanTracker.sol";
import "./interfaces/IRewardDistributor.sol";
import "./interfaces/IVester.sol";
import "./interfaces/IStakingAdmin.sol";
import "./interfaces/IRestrictedToken.sol";
import "./interfaces/deployers/IFeeTrackerDeployer.sol";
import "./interfaces/deployers/IRewardDistributorDeployer.sol";
import "./interfaces/deployers/IRewardTrackerDeployer.sol";
import "./interfaces/deployers/IVesterDeployer.sol";
import "./deployers/DeployerUtils.sol";

/// @title StakingAdmin abstract contract
/// @author Simon Mall (small@gammaswap.com)
/// @notice Admin functions for StakingRouter contract
abstract contract StakingAdmin is Ownable2Step, IStakingAdmin {
    using GammaSwapLibrary for address;
    using ERC165Checker for address;
    using DeployerUtils for address;

    address public immutable gs;
    address public immutable esGs;
    address public immutable esGsb;
    address public immutable bnGs;
    address public immutable feeRewardToken;
    address public immutable factory;
    address public immutable manager;

    // Deployers
    address private immutable rewardTrackerDeployer;
    address private immutable feeTrackerDeployer;
    address private immutable rewardDistributorDeployer;
    address private immutable vesterDeployer;

    uint256 public constant VESTING_DURATION = 365 * 24 * 60 * 60;
    uint256 public POOL_VESTING_DURATION = 365 * 24 * 60 * 60;

    AssetCoreTracker public coreTracker;
    mapping(address => mapping(address => AssetPoolTracker)) public poolTrackers;

    constructor(
        address _feeRewardToken,
        address _gs,
        address _esGs,
        address _esGsb,
        address _bnGs,
        address _factory,
        address _manager,
        address _rewardTrackerDeployer,
        address _feeTrackerDeployer,
        address _rewardDistributorDeployer,
        address _vesterDeployer
    ) {
        if (
            _feeRewardToken == address(0) || _gs == address(0) || _esGs == address(0) || _esGsb == address(0) || _bnGs == address(0) || _manager == address(0) ||
            _rewardTrackerDeployer == address(0) || _feeTrackerDeployer == address(0) || _rewardDistributorDeployer == address(0) || _vesterDeployer == address(0)
        ) {
            revert InvalidConstructor();
        }

        if (
            IRestrictedToken(_esGs).tokenType() != IRestrictedToken.TokenType.ESCROW ||
            IRestrictedToken(_esGsb).tokenType() != IRestrictedToken.TokenType.ESCROW ||
            IRestrictedToken(_bnGs).tokenType() != IRestrictedToken.TokenType.BONUS
        ) {
            revert InvalidRestrictedToken();
        }

        feeRewardToken = _feeRewardToken;
        gs = _gs;
        esGsb = _esGsb;
        esGs = _esGs;
        bnGs = _bnGs;
        factory = _factory;
        manager = _manager;

        rewardTrackerDeployer = _rewardTrackerDeployer;
        feeTrackerDeployer = _feeTrackerDeployer;
        rewardDistributorDeployer = _rewardDistributorDeployer;
        vesterDeployer = _vesterDeployer;
    }

    /// @inheritdoc IStakingAdmin
    function setPoolVestingPeriod(uint256 _poolVestingPeriod) external onlyOwner {
        POOL_VESTING_DURATION = _poolVestingPeriod;
    }

    /// @inheritdoc IStakingAdmin
    function setupGsStaking() external onlyOwner {
        address[] memory _depositTokens = new address[](2);
        _depositTokens[0] = gs;
        _depositTokens[1] = esGs;
        (address _rewardTracker, address _rewardDistributor) = _combineTrackerDistributor("Staked GS", "sGS", esGs, _depositTokens, 0, false, false);

        delete _depositTokens;
        _depositTokens = new address[](1);
        _depositTokens[0] = _rewardTracker;
        (address _bonusTracker, address _bonusDistributor) = _combineTrackerDistributor("Staked + Bonus GS", "sbGS", bnGs, _depositTokens, 0, false, true);

        delete _depositTokens;
        _depositTokens = new address[](2);
        _depositTokens[0] = _bonusTracker;
        _depositTokens[1] = bnGs;
        (address _feeTracker, address _feeDistributor) = _combineTrackerDistributor("Staked + Bonus + Fee GS", "sbfGS", feeRewardToken, _depositTokens, 0, true, false);

        address _vester = vesterDeployer.deployContract(
            abi.encodeCall(IVesterDeployer.deploy, ("Vested GS", "vGS", VESTING_DURATION, esGs, _feeTracker, gs, _rewardTracker))
        );

        IRewardTracker(_rewardTracker).setHandler(_bonusTracker, true);
        IRewardTracker(_bonusTracker).setHandler(_feeTracker, true);
        IRewardTracker(_bonusTracker).setInPrivateClaimingMode(true);
        IRewardTracker(_feeTracker).setHandler(_vester, true);
        IVester(_vester).setHandler(address(this), true);
        IRestrictedToken(esGs).setHandler(_rewardTracker, true);
        IRestrictedToken(esGs).setHandler(_rewardDistributor, true);
        IRestrictedToken(esGs).setHandler(_vester, true);
        IRestrictedToken(bnGs).setHandler(_feeTracker, true);
        IRestrictedToken(bnGs).setHandler(_bonusTracker, true);
        IRestrictedToken(bnGs).setHandler(_bonusDistributor, true);

        coreTracker.rewardTracker = _rewardTracker;
        coreTracker.rewardDistributor = _rewardDistributor;
        coreTracker.bonusTracker = _bonusTracker;
        coreTracker.bonusDistributor = _bonusDistributor;
        coreTracker.feeTracker = _feeTracker;
        coreTracker.feeDistributor = _feeDistributor;
        coreTracker.vester = _vester;

        emit CoreTrackerCreated(_rewardTracker, _rewardDistributor, _bonusTracker, _bonusDistributor, _feeTracker, _feeDistributor, _vester);
    }

    /// @inheritdoc IStakingAdmin
    function setupGsStakingForLoan() external onlyOwner {
        address[] memory _depositTokens = new address[](1);
        _depositTokens[0] = esGsb;
        (address _loanRewardTracker, address _loanRewardDistributor) = _combineTrackerDistributor("Staked GS Loan", "sGSb", esGsb, _depositTokens, 0, false, false);

        IRewardTracker(coreTracker.bonusTracker).setDepositToken(_loanRewardTracker, true);
        IRewardTracker(_loanRewardTracker).setHandler(coreTracker.bonusTracker, true);

        address _loanVester = vesterDeployer.deployContract(
            abi.encodeCall(IVesterDeployer.deployVesterNoReserve, ("Vested GS Borrowed", "vGSB", VESTING_DURATION, esGsb, gs, _loanRewardTracker))
        );

        IVester(_loanVester).setHandler(address(this), true);
        IRestrictedToken(esGsb).setHandler(_loanRewardTracker, true);
        IRestrictedToken(esGsb).setHandler(_loanRewardDistributor, true);
        IRestrictedToken(esGsb).setHandler(_loanVester, true);

        coreTracker.loanRewardTracker = _loanRewardTracker;
        coreTracker.loanRewardDistributor = _loanRewardDistributor;
        coreTracker.loanVester = _loanVester;

        emit CoreTrackerUpdated(_loanRewardTracker, _loanRewardDistributor, _loanVester);
    }

    /// @inheritdoc IStakingAdmin
    function setupPoolStaking(address _gsPool, address _esToken, address _claimableToken) external onlyOwner {
        if (IRestrictedToken(_esToken).tokenType() != IRestrictedToken.TokenType.ESCROW) {
            revert InvalidRestrictedToken();
        }

        address[] memory _depositTokens = new address[](1);
        _depositTokens[0] = _gsPool;
        (address _rewardTracker, address _rewardDistributor) = _combineTrackerDistributor("Staked GS LP", "sGSlp", _esToken, _depositTokens, 0, false, false);
        

        address _vester = vesterDeployer.deployContract(
            abi.encodeCall(IVesterDeployer.deploy, ("Vested Pool GS", "vpGS", POOL_VESTING_DURATION, _esToken, _rewardTracker, _claimableToken, _rewardTracker))
        );

        IRewardTracker(_rewardTracker).setHandler(_vester, true);
        IVester(_vester).setHandler(address(this), true);
        IRestrictedToken(_esToken).setHandler(_rewardTracker, true);
        IRestrictedToken(_esToken).setHandler(_rewardDistributor, true);
        IRestrictedToken(_esToken).setHandler(_vester, true);

        poolTrackers[_gsPool][_esToken].rewardTracker = _rewardTracker;
        poolTrackers[_gsPool][_esToken].rewardDistributor = _rewardDistributor;
        poolTrackers[_gsPool][_esToken].vester = _vester;

        _gsPool.safeApprove(_rewardTracker, type(uint256).max);

        emit PoolTrackerCreated(_gsPool, _rewardTracker, _rewardDistributor, _vester);
    }

    /// @inheritdoc IStakingAdmin
    function setupPoolStakingForLoan(address _gsPool, uint16 _refId) external onlyOwner {
        address[] memory _depositTokens = new address[](1);
        _depositTokens[0] = esGsb;
        (address _loanRewardTracker, address _loanRewardDistributor) = _combineTrackerDistributor("Staked GS Loan", "sGSb", esGsb, _depositTokens, _refId, false, false);

        ILoanTracker(_loanRewardTracker).initialize(_gsPool, _loanRewardDistributor);
        IRestrictedToken(esGsb).setHandler(_loanRewardTracker, true);
        IRestrictedToken(esGsb).setHandler(_loanRewardDistributor, true);

        poolTrackers[_gsPool][esGsb].loanRewardTracker = _loanRewardTracker;
        poolTrackers[_gsPool][esGsb].loanRewardDistributor = _loanRewardDistributor;

        emit PoolTrackerUpdated(_gsPool, _loanRewardTracker, _loanRewardDistributor);
    }

    /// @inheritdoc IStakingAdmin
    function execute(address _stakingContract, bytes calldata _data) external onlyOwner {
        if(
            !_stakingContract.supportsInterface(type(IRewardTracker).interfaceId) &&
            !_stakingContract.supportsInterface(type(ILoanTracker).interfaceId) &&
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

    /// @dev Deploy reward tracker and distributor as a pair and bind them
    /// @param _name RewardTracker name as ERC20 token
    /// @param _symbol RewardTracker symbol as ERC20 token
    /// @param _rewardToken Reward token address
    /// @param _depositTokens Array of deposit tokens in RewardTracker
    /// @param _refId LoanObserver Id
    /// @param _isFeeTracker True if reward tracker should be FeeTracker
    /// @param _isBonusDistributor True if reward distributor should be BonusDistributor
    /// @return Reward tracker address
    /// @return Reward distributor address
    function _combineTrackerDistributor(
        string memory _name,
        string memory _symbol,
        address _rewardToken,
        address[] memory _depositTokens,
        uint16 _refId,
        bool _isFeeTracker,
        bool _isBonusDistributor
    ) private returns (address, address) {
        address tracker;
        if (_refId > 0) {
            tracker = rewardTrackerDeployer.deployContract(
                abi.encodeCall(IRewardTrackerDeployer.deployLoanTracker, (factory, _refId, manager, _name, _symbol))
            );
        } else if (_isFeeTracker) {
            tracker = feeTrackerDeployer.deployContract(
                abi.encodeCall(IFeeTrackerDeployer.deploy, (10000)) // bnRateCap: 100%
            );
        } else {
            tracker = rewardTrackerDeployer.deployContract(
                abi.encodeCall(IRewardTrackerDeployer.deploy, (_name, _symbol))
            );
        }

        address distributor;
        if (_isBonusDistributor) {
            distributor = rewardDistributorDeployer.deployContract(
                abi.encodeCall(IRewardDistributorDeployer.deployBonusDistributor, (_rewardToken, tracker))
            );
        } else {
            distributor = rewardDistributorDeployer.deployContract(
                abi.encodeCall(IRewardDistributorDeployer.deploy, (_rewardToken, tracker))
            );
        }

        if (_refId > 0) {
            ILoanTracker(tracker).setHandler(address(this), true);
        } else {
            IRewardTracker(tracker).initialize(_depositTokens, distributor);
            IRewardTracker(tracker).setHandler(address(this), true);
        }
        IRewardDistributor(distributor).updateLastDistributionTime();

        return (tracker, distributor);
    }
}