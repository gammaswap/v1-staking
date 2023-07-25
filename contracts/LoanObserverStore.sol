// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "@gammaswap/v1-core/contracts/observer/AbstractLoanObserverStore.sol";

contract LoanObserverStore is AbstractLoanObserverStore {
  address storeOwner;

  constructor(address _storeOwner) {
    storeOwner = _storeOwner;
  }

  function _loanObserverStoreOwner() internal override virtual view returns(address) {
    return storeOwner;
  }
}