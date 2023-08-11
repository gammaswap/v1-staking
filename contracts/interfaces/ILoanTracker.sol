// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "@openzeppelin/contracts/utils/introspection/IERC165.sol";

interface ILoanTracker is IERC165 {
    function initialize(address, address) external;
    function setHandler(address, bool) external;
    function stakedLoans(uint256 _loanId) external view returns (address);
    function updateRewards() external;
    function stake(uint256 _loanId) external;
    function stakeForAccount(address _account, uint256 _loanId) external;
    function unstake(uint256 _loanId) external;
    function unstakeForAccount(address _account, uint256 _loanId) external;
    function tokensPerInterval() external view returns (uint256);
    function claim(address _receiver) external returns (uint256);
    function claimForAccount(address _account, address _receiver) external returns (uint256);
    function claimable(address _account) external view returns (uint256);
    function cumulativeRewards(address _account) external view returns (uint256);

    event Claim(address, uint256);
}
