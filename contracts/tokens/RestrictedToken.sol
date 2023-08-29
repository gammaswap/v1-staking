// SPDX-License-Identifier: MIT

pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "../interfaces/IRestrictedToken.sol";

/// @title Restricted ERC20 token contract
/// @author Simon Mall
/// @notice Used for GS and escrow tokens
/// @dev Supports mint, burn and certain levels of control by managers and handlers
/// @dev Managers and handlers are usually GammaSwap staking contracts
contract RestrictedToken is ERC20, Ownable2Step, IRestrictedToken {
  mapping (address => bool) public isManager;
  mapping (address => bool) public isHandler;

  constructor(string memory _name, string memory _symbol) ERC20(_name, _symbol) {}

  /// @dev See {IRestrictedToken-setManager}
  function setManager(address _manager, bool _isActive) public virtual onlyOwner {
    isManager[_manager] = _isActive;
  }

  /// @dev See {IRestrictedToken-setHandler}
  function setHandler(address _handler, bool _isActive) public virtual {
    _validateManager();
    isHandler[_handler] = _isActive;
  }

  /// @dev Mint tokens
  /// @notice Only Managers or handlers are allowed
  /// @param _account Address to mint tokens to
  /// @param _amount Amount of tokens to mint
  function mint(address _account, uint256 _amount) public {
    _validateHandler();

    _mint(_account, _amount);
  }

  /// @dev Burn tokens
  /// @notice Only Managers or handlers are allowed
  /// @param _account Address to burn tokens from
  /// @param _amount Amount of tokens to burn
  function burn(address _account, uint256 _amount) public {
    _validateHandler();

    _burn(_account, _amount);
  }

  /// @notice Only Managers or handlers are allowed
  /// @dev See {IERC20-transfer}
  function transfer(address to, uint256 amount) public virtual override returns (bool) {
    _validateHandler();

    _transfer(msg.sender, to, amount);
    return true;
  }

  /// @notice Only Managers or handlers are allowed
  /// @dev See {IERC20-transferFrom}
  function transferFrom(address from, address to, uint256 amount) public virtual override returns (bool) {
    _validateHandler();

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