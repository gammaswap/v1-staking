// SPDX-License-Identifier: MIT

pragma solidity 0.8.17;

import "@openzeppelin/contracts/utils/introspection/IERC165.sol";

interface IVester is IERC165 {
    function setHandler(address, bool) external;
    function rewardTracker() external view returns (address);
    function deposit(uint256 _amount) external;
    function depositForAccount(address _account, uint256 _amount) external;
    function claim() external returns(uint256);
    function claimForAccount(address _account, address _receiver) external returns (uint256);
    function withdraw() external;
    function withdrawForAccount(address _account) external;
    function claimable(address _account) external view returns (uint256);
    function cumulativeClaimAmounts(address _account) external view returns (uint256);
    function claimedAmounts(address _account) external view returns (uint256);
    function pairAmounts(address _account) external view returns (uint256);
    function getVestedAmount(address _account) external view returns (uint256);
    function cumulativeRewardDeductions(address _account) external view returns (uint256);
    function bonusRewards(address _account) external view returns (uint256);

    function setCumulativeRewardDeductions(address _account, uint256 _amount) external;
    function setBonusRewards(address _account, uint256 _amount) external;

    function getMaxVestableAmount(address _account) external view returns (uint256);
    function getAverageStakedAmount(address _account) external view returns (uint256);
}
