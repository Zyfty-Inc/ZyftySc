import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import "contracts/ZyftyNFT.sol";

contract AuctionGenerator {
    
    using Counters for Counters.Counter;
    using ECDSA for bytes32;

    struct Auction {
        address zyftyContract; // The NFT contract
        uint256 tokenId; // Token Id
        uint256 startingPrice; // The starting price for all bids
        uint256 maxPrice; // If non zero, this is the buy it now price, will auto close the auction???
        address asset; // The asset to purchase in
        uint256 auctionEnd; // The time at which all bids will stop

        bool closed;

        uint256 highestBid; // The current best bid
        address highestBidder; // The address of the highest bidder
    }

    Counters.Counter private _auctionIds;

    mapping(uint256 => Auction) auctions;
    //      auctionId          bidder     cost
    mapping(uint256 => mapping(address => uint256)) deposits;

    function createAuction(address zyftyContract,
                           uint256 tokenId,
                           uint256 startingPrice,
                           uint256 maxPrice,
                           address asset,
                           uint256 duration) public returns (uint256) {

        require(startingPrice != 0, "ZyftyAuction: Starting price must be non-zero");
        _auctionIds.increment();
        ZyftyNFT nft = ZyftyNFT(zyftyContract);
        nft.transferFrom(msg.sender, address(this), tokenId);

        uint256 id = _auctionIds.current();
        auctions[id] = Auction({ zyftyContract: zyftyContract,
                                 tokenId: tokenId,
                                 startingPrice: startingPrice,
                                 maxPrice: maxPrice,
                                 asset: asset,
                                 auctionEnd: block.timestamp + duration,
                                 closed: false,
                                 highestBid: 0,
                                 highestBidder: address(0)
        });

    }

    // Amount is amount to add to the auction
    function bid(uint256 id, uint256 amount, bytes memory agreementSignature) public {

        Auction storage auction = auctions[id];
        ZyftyNFT nft = ZyftyNFT(auction.zyftyContract);
        address signedAddress = nft.createAgreementHash(auction.tokenId, msg.sender)
                                    .toEthSignedMessageHash()
                                    .recover(agreementSignature);
        require(signedAddress == msg.sender, "ZyftyAuction: Incorrect Agreement Signature");
        deposits[id][msg.sender] += amount;
        require(auction.highestBid > deposits[id][msg.sender], "ZyftyAuction: Bid must be greater");
        // TODO check if already has deposited
        IERC20 token = IERC20(auction.asset);
        token.transferFrom(msg.sender, address(this), amount);

    }

    function getDeposit(uint256 auctionId, address bidder) public view returns(uint256) {
        return deposits[auctionId][bidder];
    }

    // Refunds the user all assets sent
    function withdrawFromAuction(uint256 id) public {
        uint256 refund = deposits[id][msg.sender];
        require(refund > 0, "ZyftyAuction: No funds deposited");
        // TODO test
        require(auctions[id].highestBidder != msg.sender && auctionClosed(id), "ZyftyAuction: Highest bidder can't withdraw until auction is closed");
        IERC20 token = IERC20(auctions[id].asset);
        token.transfer(msg.sender, refund);
        deposits[id][msg.sender] = 0;
    }

    function auctionClosed(uint256 auctionId) public view returns(bool) {
        return auctions[auctionId].closed;
    }

    // Closes the auction, the auction can close prematurely at the owners discretion
    function close() public {
        
    }

}
