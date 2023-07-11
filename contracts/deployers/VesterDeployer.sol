// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "../Vester.sol";

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
}