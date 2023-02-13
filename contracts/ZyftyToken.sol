import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";

contract ZyftyToken is ERC1155Upgradeable {
    using Counters for Counters.Counter;

    event TokensMinted(uint256 tokenId, uint256 tokensCreated);

    address minter;
    address escrow;

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    Counters.Counter private _tokenIds;

    function initialize(address minter) initializer public {
        __ERC1155_init("https://zyfty.io/token/{id}.json");
        setEscrow(escrow);
        setMinter(minter);
    }

    function setMinter(address _minter) public {
        minter = _minter;
    }

    function setEscrow(address _escrow) public {
        escrow = _escrow;
    }

    function newToken(address[] memory users, uint256[] memory amounts) public returns (uint256) {
        require(minter == msg.sender, "must have minter role to mint");
        require(users.length == amounts.length, "Users and Amounts must be same length");

        _tokenIds.increment();

        uint256 newItemId = _tokenIds.current();
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < users.length; i++) {
            _mint(users[i], newItemId, amounts[i], "");
            totalAmount += amounts[i];
        }

        emit TokensMinted(newItemId, totalAmount);
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

    function _beforeTokenTransfer(
        address operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) internal override {
        require(from == address(0) || to == address(0) || from == escrow || to == escrow, "Token must be passed through Sales Contract");
    }

}


