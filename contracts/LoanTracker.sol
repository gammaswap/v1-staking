// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@gammaswap/v1-core/contracts/interfaces/observer/ILoanObserver.sol";

import "./interfaces/IRewardDistributor.sol";
import "./interfaces/IRewardTracker.sol";

contract LoanTracker is IERC20, ReentrancyGuard, Ownable2Step, ILoanObserver {
    uint256 public constant PRECISION = 1e30;

    bool public isInitialized;

    uint8 public constant decimals = 18;
    string public name;
    string public symbol;

    address public gsPool;
    address public distributor;

    mapping (address => bool) public isHandler;

    uint256 public override totalSupply;
    mapping (address => uint256) public balances;

    uint256 public cumulativeRewardPerToken;
    mapping (address => uint256) public claimableReward;
    mapping (address => uint256) public previousCumulatedRewardPerToken;
    mapping (address => uint256) public override cumulativeRewards;

    event Claim(address, uint256);

    constructor(string memory _name, string memory _symbol) {
        name = _name;
        symbol = _symbol;
    }

    function initialize(
        address _manager,
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

    function transfer(address, uint256) external override returns (bool) {
        revert("LoanTracker: Forbidden");
    }

    function allowance(address _owner, address _spender) external pure override returns (uint256) {
        return 0;
    }

    function approve(address, uint256) external override returns (bool) {
        revert("LoanTracker: Forbidden");
    }

    function transferFrom(address, address, uint256) external override returns (bool) {
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

    function rewardToken() public view returns (address) {
        return IRewardDistributor(distributor).rewardToken();
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
        require(_amount > 0, "LoanTracker: invalid _amount");
        require(isDepositToken[_depositToken], "LoanTracker: invalid _depositToken");

        _updateRewards(_account);

        stakedAmounts[_account] = stakedAmounts[_account] + _amount;
        depositBalances[_account][_depositToken] = depositBalances[_account][_depositToken] + _amount;
        totalDepositSupply[_depositToken] = totalDepositSupply[_depositToken] + _amount;

        _mint(_account, _amount);
    }

    function _unstake(address _account, uint256 _loanId) private {
        require(_amount > 0, "LoanTracker: invalid _amount");
        require(isDepositToken[_depositToken], "LoanTracker: invalid _depositToken");

        _updateRewards(_account);

        uint256 stakedAmount = stakedAmounts[_account];
        require(stakedAmount >= _amount, "LoanTracker: _amount exceeds stakedAmount");

        stakedAmounts[_account] = stakedAmount - _amount;

        uint256 depositBalance = depositBalances[_account][_depositToken];
        require(depositBalance >= _amount, "LoanTracker: _amount exceeds depositBalance");

        depositBalances[_account][_depositToken] = depositBalance - _amount;
        totalDepositSupply[_depositToken] = totalDepositSupply[_depositToken] - _amount;

        _burn(_account, _amount);
        IERC20(_depositToken).safeTransfer(_receiver, _amount);
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
            uint256 stakedAmount = stakedAmounts[_account];
            uint256 accountReward = stakedAmount * (_cumulativeRewardPerToken - previousCumulatedRewardPerToken[_account]) / PRECISION;
            uint256 _claimableReward = claimableReward[_account] + accountReward;

            claimableReward[_account] = _claimableReward;
            previousCumulatedRewardPerToken[_account] = _cumulativeRewardPerToken;

            if (_claimableReward > 0 && stakedAmounts[_account] > 0) {
                uint256 cumulativeReward = cumulativeRewards[_account];
                uint256 nextCumulativeReward = cumulativeReward + accountReward;

                averageStakedAmounts[_account] = averageStakedAmounts[_account] * cumulativeReward / nextCumulativeReward + stakedAmount * accountReward / nextCumulativeReward;

                cumulativeRewards[_account] = nextCumulativeReward;
            }
        }
    }
}