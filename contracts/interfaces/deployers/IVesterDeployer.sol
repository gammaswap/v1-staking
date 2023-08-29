// SPDX-License-Identifier: MIT

pragma solidity 0.8.17;

interface IVesterDeployer {
  function deploy(
    string memory _name,
    string memory _symbol,
    uint256 _vestingDuration,
    address _esToken,
    address _pairToken,
    address _claimableToken,
    address _rewardTracker
  ) external returns (address _vester);

  function deployVesterNoReserve(
    string memory _name,
    string memory _symbol,
    uint256 _vestingDuration,
    address _esToken,
    address _claimableToken,
    address _rewardTracker
  ) external returns (address _vester);
}