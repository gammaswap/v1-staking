// SPDX-License-Identifier: MIT

pragma solidity 0.8.19;

import "@layerzerolabs/solidity-examples/contracts/token/oft/OFT.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IRestrictedToken.sol";

contract GS is Ownable, OFT, IRestrictedToken {
  mapping (address => bool) public isManager;

  constructor(address lzEndpoint) OFT("GammaSwap", "GS", lzEndpoint) {}

  /// @dev See {IRestrictedToken-setManager}
  function setManager(address _manager, bool _isActive) public virtual onlyOwner {
    isManager[_manager] = _isActive;
  }

  function setHandler(address, bool) public override pure {
    revert("GS: Forbidden");
  }

  function isHandler(address) external pure returns (bool) {
    return false;
  }

  /// @dev See {IRestrictedToken-mint}
  function mint(address _account, uint256 _amount) public {
    _validateManager();

    _mint(_account, _amount);
  }

  /// @dev See {IRestrictedToken-burn}
  function burn(address _account, uint256 _amount) public {
    _validateManager();

    _burn(_account, _amount);
  }

  function transfer(address to, uint256 amount) public override(ERC20, IERC20) returns (bool) {
    address user = msg.sender;
    _transfer(user, to, amount);
    return true;
  }

  function transferFrom(address from, address to, uint256 amount) public override(ERC20, IERC20) returns (bool) {
    address spender = msg.sender;
    _spendAllowance(from, spender, amount);
    _transfer(from, to, amount);
    return true;
  }

  function _validateManager() private view {
    address caller = msg.sender;
    require(caller == owner() || isManager[caller], "GS: Forbidden Manager");
  }
}