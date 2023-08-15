// SPDX-License-Identifier: MIT

pragma solidity 0.8.17;

import "../Vester.sol";
import "../VesterNoReserve.sol";

/**
 * @notice Proxy contract for `Vester` deployments
 */
contract VesterDeployer {
  function deploy(
    string memory _name,
    string memory _symbol,
    uint256 _vestingDuration,
    address _esToken,
    address _pairToken,
    address _claimableToken,
    address _rewardTracker
  ) external returns (address _vester) {
    _vester = address(new Vester(_name, _symbol, _vestingDuration, _esToken, _pairToken, _claimableToken, _rewardTracker));
  }

  function deployVesterNoReserve(
    string memory _name,
    string memory _symbol,
    uint256 _vestingDuration,
    address _esToken,
    address _claimableToken,
    address _rewardTracker
  ) external returns (address _vester) {
    _vester = address(new VesterNoReserve(_name, _symbol, _vestingDuration, _esToken, _claimableToken, _rewardTracker));
  }
}