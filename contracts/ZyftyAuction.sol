import "contracts/ZyftyNFT.sol";

contract TestToken is ERC20 {
    constructor(address b, address a, address c, uint256 amount) ERC20("TestToken", "TT"){
        _mint(b, amount);
        _mint(c, amount);
        _mint(a, amount);
    }
}

contract ZyftyAuction {
    
    struct Auction {
        address zyftyContract;
        uint256 tokenId;
        uint256 startingPrice;
        address asset;
        uint256 created;
        uint256 duration;
    }
    _auctionIds.increment();

    mapping(uint256 => Auction) auctions;


    function createAuction(address zyftyContract,
                           uint256 tokenId,
                           uint256 startingPrice,
                           address asset,
                           uint256 created,
                           uint256 duration) returns (uint256) {
        _auctionIds.increment();
        _auctionIds.current();
    }

    modifier withinWindow(uint256 id) {
        require(auctions[id].created + auctions[id].duration>= block.timestamp, "Window is closed");
        _;
    }

    modifier afterWindow(uint256 id) {
        require(block.timestamp >= auctions[id].created + auctions[id].duration, "Window is still open");
        _;
    }
}
