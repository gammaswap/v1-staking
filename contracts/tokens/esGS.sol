// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IRestrictedToken.sol";

contract EsGS is ERC20, Ownable, IRestrictedToken {
  mapping (address => bool) public isHandler;

  constructor(string memory _name, string memory _symbol) ERC20(_name, _symbol) {
    setHandler(msg.sender, true);
  }

  function setHandler(address _handler, bool _isActive) public onlyOwner {
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

  function _validateHandler() private view {
    require(isHandler[msg.sender], "GS Token: Forbidden");
  }
}