import "@openzeppelin/contracts/utils/Counters.sol";

import "contracts/ZyftyNFT.sol";

contract AuctionGenerator {
    
    using Counters for Counters.Counter;
    struct Auction {
        address zyftyContract;
        uint256 tokenId;
        uint256 startingPrice;
        address asset;
        uint256 aucctionEnd;

        uint256 highestBid;
        address highestBidder;
    }
    Counters.Counter private _auctionIds;

    mapping(uint256 => Auction) auctions;
    //      auctionID          bidder     cost
    mapping(uint256 => mapping(address => uint256)) deposits;


    function createAuction(address zyftyContract,
                           uint256 tokenId,
                           uint256 startingPrice,
                           address asset,
                           uint256 created,
                           uint256 duration) public returns (uint256) {

        _auctionIds.increment();
        uint256 id = _auctionIds.current();
    }

    function bid(uint256 id, uint256 amount, bytes memory agreementSignature) public {

        address signedAddress = nft.createAgreementHash(propertyListing[id].tokenID, msg.sender)
                                    .toEthSignedMessageHash()
                                    .recover(agreementSignature);
        require(signedAddress == msg.sender, "ZyftyAuction: Incorrect Agreement Signature");
        if (highestBid > deposits[id][msg.sender]) {
        }
        deposits[id][msg.sender] = amount;
        Auction storage auction = auctions[id];

        IERC20 token = IERC20(auction.asset);

    }

    function withdrawFromAuction(uint256 id) public {
        uint256 refund = deposits[id][msg.sender];
        require(refund > 0, "ZyftyAuction: No funds deposited");
        require(auctions[id].highestBidder != msg.sender, "ZyftyAuction: Highest bidder can't withdraw");
        IERC20 token = IERC20(auctions[id].asset);
        token.transfer(msg.sender, refund);
        deposits[id][msg.sender] = 0;
    }

    function close() public {

    }

}
