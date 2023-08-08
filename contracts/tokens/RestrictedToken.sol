// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "../interfaces/IRestrictedToken.sol";

contract RestrictedToken is ERC20, Ownable2Step, IRestrictedToken {
  mapping (address => bool) public isManager;
  mapping (address => bool) public isHandler;

  constructor(string memory _name, string memory _symbol) ERC20(_name, _symbol) {}

  function setManager(address _manager, bool _isActive) public virtual onlyOwner {
    isManager[_manager] = _isActive;
  }

  function setHandler(address _handler, bool _isActive) public virtual {
    _validateManager();
    isHandler[_handler] = _isActive;
  }

  function mint(address _account, uint256 _amount) public {
    _validateHandler();

    _mint(_account, _amount);
  }

  function burn(address _account, uint256 _amount) public {
    _validateHandler();

    _burn(_account, _amount);
  }

  function transferFrom(address from, address to, uint256 amount) public virtual override returns (bool) {
    address spender = msg.sender;

    if (spender != owner() && !isManager[spender] && !isHandler[spender]) {
      _spendAllowance(from, spender, amount);
    }

    _transfer(from, to, amount);
    return true;
  }

  function _validateManager() private view {
    address caller = msg.sender;
    require(caller == owner() || isManager[caller], "RestrictedToken: Forbidden Manager");
  }

  function _validateHandler() private view {
    address caller = msg.sender;
    require(caller == owner() || isManager[caller] || isHandler[caller], "RestrictedToken: Forbidden Handler");
  }
}