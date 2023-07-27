// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@gammaswap/v1-core/contracts/interfaces/IGammaPool.sol";
import "@gammaswap/v1-core/contracts/interfaces/observer/ILoanObserver.sol";

import "./interfaces/ILoanTracker.sol";
import "./interfaces/IRewardDistributor.sol";

contract LoanTracker is IERC20, ReentrancyGuard, Ownable2Step, ILoanTracker, ILoanObserver {
    using SafeERC20 for IERC20;

    /// @dev See {ILoanObserver-factory}
    address public override factory;

    /// @dev See {ILoanObserver-refId}
    uint16 public override refId;

    /// @dev See {ILoanObserver-refType}
    uint16 public immutable override refType = 2;

    uint256 public constant PRECISION = 1e30;

    bool public isInitialized;

    uint8 public constant decimals = 18;
    string public name;
    string public symbol;

    address public manager;
    address public gsPool;
    address public distributor;

    mapping (address => bool) public isHandler;

    uint256 public override totalSupply;
    mapping (address => uint256) public balances;
    mapping (uint256 => address) public override stakedLoans;

    uint256 public cumulativeRewardPerToken;
    mapping (address => uint256) public claimableReward;
    mapping (address => uint256) public previousCumulatedRewardPerToken;
    mapping (address => uint256) public override cumulativeRewards;

    constructor(
        address _factory,
        uint16 _refId,
        address _manager,
        string memory _name,
        string memory _symbol
    ) {
        factory = _factory;
        refId = _refId;
        manager = _manager;
        name = _name;
        symbol = _symbol;
    }

    function initialize(
        address _gsPool,
        address _distributor
    ) external onlyOwner {
        require(!isInitialized, "LoanTracker: already initialized");
        isInitialized = true;

        gsPool = _gsPool;
        distributor = _distributor;
    }

    function setHandler(address _handler, bool _isActive) external onlyOwner {
        isHandler[_handler] = _isActive;
    }

    function balanceOf(address _account) external view override returns (uint256) {
        return balances[_account];
    }

    function stake(uint256 _loanId) external override nonReentrant {
        _stake(msg.sender, _loanId);
    }

    function stakeForAccount(address _account, uint256 _loanId) external override nonReentrant {
        _validateHandler();
        _stake(_account, _loanId);
    }

    function unstake(uint256 _loanId) external override nonReentrant {
        _unstake(msg.sender, _loanId);
    }

    function unstakeForAccount(address _account, uint256 _loanId) external override nonReentrant {
        _validateHandler();
        _unstake(_account, _loanId);
    }

    function transfer(address, uint256) external override pure returns (bool) {
        revert("LoanTracker: Forbidden");
    }

    function allowance(address, address) external pure override returns (uint256) {
        return 0;
    }

    function approve(address, uint256) external override pure returns (bool) {
        revert("LoanTracker: Forbidden");
    }

    function transferFrom(address, address, uint256) external override pure returns (bool) {
        revert("LoanTracker: Forbidden");
    }

    function tokensPerInterval() external override view returns (uint256) {
        return IRewardDistributor(distributor).tokensPerInterval();
    }

    function updateRewards() external override nonReentrant {
        _updateRewards(address(0));
    }

    function claim(address _receiver) external override nonReentrant returns (uint256) {
        return _claim(msg.sender, _receiver);
    }

    function claimForAccount(address _account, address _receiver) external override nonReentrant returns (uint256) {
        _validateHandler();
        return _claim(_account, _receiver);
    }

    function claimable(address _account) public override view returns (uint256) {
        uint256 balance = balances[_account];
        uint256 _claimableReward = claimableReward[_account];
        if (balance == 0) {
            return _claimableReward;
        }

        uint256 pendingRewards = IRewardDistributor(distributor).pendingRewards() * PRECISION;
        uint256 nextCumulativeRewardPerToken = cumulativeRewardPerToken + pendingRewards / totalSupply;

        return _claimableReward + (balance * (nextCumulativeRewardPerToken - previousCumulatedRewardPerToken[_account]) / PRECISION);
    }

    /// @dev See {ILoanObserver.onLoanUpdate}
    function onLoanUpdate(address, uint16, uint256 _loanId, bytes memory _data) external override virtual returns(uint256) {
        address account = stakedLoans[_loanId];
        if (account != address(0)) {
            LoanObserved memory loan = abi.decode(_data, (LoanObserved));
            if (loan.liquidity == 0) {
                // Loan liquidated and need to stop rewards for this loan
                _unstake(account, _loanId);
            }
        }

        return 0;
    }

    /// @dev See {ILoanObserver.validate}
    function validate(address _gsPool) external override virtual view returns(bool) {
        return gsPool == _gsPool;
    }

    function rewardToken() public view returns (address) {
        return IRewardDistributor(distributor).rewardToken();
    }

    function supportsInterface(bytes4 interfaceId) public pure returns (bool) {
        return interfaceId == type(ILoanTracker).interfaceId || interfaceId == type(IERC165).interfaceId;
    }

    function _claim(address _account, address _receiver) private returns (uint256) {
        _updateRewards(_account);

        uint256 tokenAmount = claimableReward[_account];
        claimableReward[_account] = 0;

        if (tokenAmount > 0) {
            IERC20(rewardToken()).safeTransfer(_receiver, tokenAmount);
            emit Claim(_account, tokenAmount);
        }

        return tokenAmount;
    }

    function _mint(address _account, uint256 _amount) internal {
        require(_account != address(0), "LoanTracker: mint to the zero address");

        totalSupply = totalSupply + _amount;
        balances[_account] = balances[_account] + _amount;

        emit Transfer(address(0), _account, _amount);
    }

    function _burn(address _account, uint256 _amount) internal {
        require(_account != address(0), "LoanTracker: burn from the zero address");

        balances[_account] = balances[_account] - _amount;
        totalSupply = totalSupply - _amount;

        emit Transfer(_account, address(0), _amount);
    }

    function _validateHandler() private view {
        require(isHandler[msg.sender], "LoanTracker: forbidden");
    }

    function _stake(address _account, uint256 _loanId) private {
        require(IERC721(manager).ownerOf(_loanId) == _account, "LoanTracker: stake forbidden");
        require(stakedLoans[_loanId] == address(0), "LoanTracker: loan already staked");

        IGammaPool.LoanData memory loanData = IGammaPool(gsPool).getLoanData(_loanId);
        require(loanData.initLiquidity > 0 && loanData.liquidity > 0, "LoanTracker: invalid loan");

        stakedLoans[_loanId] = _account;

        _updateRewards(_account);

        _mint(_account, loanData.initLiquidity);
    }

    function _unstake(address _account, uint256 _loanId) private {
        require(stakedLoans[_loanId] == _account, "LoanTracker: loan stake mismatch");

        _updateRewards(_account);

        IGammaPool.LoanData memory loanData = IGammaPool(gsPool).getLoanData(_loanId);

        _burn(_account, loanData.initLiquidity);
    }

    function _updateRewards(address _account) private {
        uint256 blockReward = IRewardDistributor(distributor).distribute();

        uint256 supply = totalSupply;
        uint256 _cumulativeRewardPerToken = cumulativeRewardPerToken;
        if (supply > 0 && blockReward > 0) {
            _cumulativeRewardPerToken = _cumulativeRewardPerToken + blockReward * PRECISION / supply;
            cumulativeRewardPerToken = _cumulativeRewardPerToken;
        }

        // cumulativeRewardPerToken can only increase
        // so if cumulativeRewardPerToken is zero, it means there are no rewards yet
        if (_cumulativeRewardPerToken == 0) {
            return;
        }

        if (_account != address(0)) {
            uint256 balance = balances[_account];
            uint256 accountReward = balance * (_cumulativeRewardPerToken - previousCumulatedRewardPerToken[_account]) / PRECISION;
            uint256 _claimableReward = claimableReward[_account] + accountReward;

            claimableReward[_account] = _claimableReward;
            previousCumulatedRewardPerToken[_account] = _cumulativeRewardPerToken;

            if (_claimableReward > 0 && balance > 0) {
                uint256 cumulativeReward = cumulativeRewards[_account];
                uint256 nextCumulativeReward = cumulativeReward + accountReward;
                cumulativeRewards[_account] = nextCumulativeReward;
            }
        }
    }
}