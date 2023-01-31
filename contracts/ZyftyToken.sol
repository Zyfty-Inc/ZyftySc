import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";

contract ZyftyToken is ERC1155Upgradeable {
    using Counters for Counters.Counter;

    address minter;

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    Counters.Counter private _tokenIds;

    function initialize(address minter) initializer public {
        __ERC1155_init("https://api.zyfty.io/token/{id}.json");
        setMinter(minter);
    }

    function setMinter(address _minter) public {
        minter = _minter;
    }

    function newToken(address[] memory users, uint256[] memory amounts) public returns (uint256) {
        require(minter == msg.sender, "must have minter role to mint");

        string memory uri = "https://api.zyfty.io/token/{id}.json";
        _tokenIds.increment();

        uint256 newItemId = _tokenIds.current();
        for (uint256 i = 0; i < users.length; i++) {
            _mint(users[i], newItemId, amounts[i], "");
        }
        // _setTokenURI(newItemId, uri);

        return newItemId;
    }

    // The following functions are overrides required by Solidity.

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC1155Upgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}


