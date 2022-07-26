pragma solidity ^0.8.1;

import "contracts/Lien/ILien.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Lien is ILien {

    using SafeMath for uint256;

    address private provider;
    address private tokenAddr;
    uint256 public value;

    event LienIncreased(uint256 amount);
    event LienDecreased(uint256 amount);

    constructor(address _provider, uint256 _value, address assetType) {
        provider = _provider;
        tokenAddr = assetType;
        value = _value;
    }

    /**
     * @dev Initializes the Lien contract
     */
    function initialize() public virtual override {}

    /*
     * @dev Pays `amount` tokens of the default asset to the `lienProvider()`
     *      on payment update() is called 
     *      
     *      Returns the amount of funds that the transaction did not use.
     */
    function pay(uint256 amount) public virtual override returns(uint256 remainder){
        update();
        IERC20 token = IERC20(asset());
        if (amount >= value) {
            // prevent overflow
            remainder = amount - value;
            amount = value;
        }
        token.transferFrom(msg.sender, lienProvider(), amount);
        decreaseLien(amount);
    }
    /*
     * @dev Updates the `balance()` of the lien, this is called
     *      to update temporal logic or any other purposes that
     *      aren't static
     */
    function update() public virtual override {
        // No update for static Liens
    }

    /**
     * @dev Sets `lienProvider()` to `newProvider``
     */
    function setLienProvider(address newProvider) public virtual override {
        require(provider == msg.sender);
        provider = newProvider;
    }

    /**
     * @dev Returns the main Lien Provider of this Lien
     */
    function lienProvider() public view virtual override returns(address) {
        return provider;
    }

    /**
     * @dev Returns the current amount of debt that is in the lien,
     *      before the balance is returned it additionally calls update()
     *      on the contract
     */
    function balance() public virtual override returns(uint256) {
        update();
        return value;
    }


    /*
     * @dev Returns the current amount of debt that is in the lien,
     *      WARNING, this is not ensured to be up to date, unless an
     *      `update()` is called before. The value is typically lower
     *      than reality.
     */
    function balanceView() public view virtual override returns(uint256) {
        return value;
    }


    function asset() public virtual override view returns(address) {
        return tokenAddr;
    }

    /**
     * @dev Increases the value of the lien by `amount`, meant to be called by subclasses
     *      Emits an event that the lien increased
     */
    function increaseLien(uint256 amount) internal {
        (bool work, uint256 num) = value.tryAdd(amount);
        value = num;
        emit LienIncreased(amount);
    }

    /**
     * @dev Decreases the value of the lien by `amount`, meant to be called by subclasses
     *      if value, will become negative as a result of this, it returns the amount unused.
     */
    function decreaseLien(uint256 amount) internal returns(uint256 remainder) {
        remainder = 0;
        if (amount >= value) {
            remainder = amount - value;
            value = 0;
            emit LienDecreased(value);
        } else {
            value -= amount;
            emit LienDecreased(amount);
        }
    }
}
