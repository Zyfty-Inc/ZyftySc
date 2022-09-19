import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "contracts/ZyftyNFT.sol";

contract ZyftyAuction is Ownable {
    
    using Counters for Counters.Counter;
    using ECDSA for bytes32;

    struct Auction {
        address seller;
        address zyftyContract; // The NFT contract
        uint256 tokenId; // Token Id
        uint256 startingPrice; // The starting price for all bids
        uint256 maxPrice; // If non zero, this is the buy it now price, will auto close the auction???
        address asset; // The asset to purchase in
        uint256 created; // The time at which the auction was made
        uint256 duration; // The length of the auction

        uint256 highestBid; // The current best bid
        address highestBidder; // The address of the highest bidder
        uint256 bidders;
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
                                 seller: msg.sender,
                                 tokenId: tokenId,
                                 startingPrice: startingPrice,
                                 maxPrice: maxPrice,
                                 asset: asset,
                                 created: block.timestamp,
                                 duration: duration,
                                 bidders: 0,
                                 highestBid: 0,
                                 highestBidder: address(0)
        });

    }

    // Amount is amount to add to the auction
    function bid(uint256 id, uint256 amount, bytes memory agreementSignature) public onlyOpened(id) {
        Auction storage auction = auctions[id];
        ZyftyNFT nft = ZyftyNFT(auction.zyftyContract);
        address signedAddress = nft.createAgreementHash(auction.tokenId, msg.sender)
                                    .toEthSignedMessageHash()
                                    .recover(agreementSignature);
        require(signedAddress == msg.sender, "ZyftyAuction: Incorrect Agreement Signature");
        deposits[id][msg.sender] = deposits[id][msg.sender] + amount;
        require(deposits[id][msg.sender] > auction.highestBid, "ZyftyAuction: Bid must be greater");

        // Is this the first time this user has bid?
        if (deposits[id][msg.sender] == amount) {
            auction.bidders++;
        }

        IERC20 token = IERC20(auction.asset);
        token.transferFrom(msg.sender, address(this), amount);
        auction.highestBid = deposits[id][msg.sender];
        auction.highestBidder = msg.sender;
    }

    function getDeposit(uint256 auctionId, address bidder) public view returns(uint256) {
        return deposits[auctionId][bidder];
    }

    // Refunds the user all assets sent
    function withdrawFromAuction(uint256 id) public {
        uint256 refund = deposits[id][msg.sender];
        require(refund > 0, "ZyftyAuction: No funds deposited");
        require(auctions[id].highestBidder != msg.sender || auctionClosed(id), "ZyftyAuction: Highest bidder can't withdraw until auction is closed");
        // TODO test
        IERC20 token = IERC20(auctions[id].asset);
        token.transfer(msg.sender, refund);
        deposits[id][msg.sender] = 0;
        // Remove bidder
        auctions[id].bidders--;
        tryClean(id);
    }

    function tryClean(uint256 id) internal {
        if (auctions[id].bidders == 0) {
            delete auctions[id];
        }
    }

    function auctionClosed(uint256 auctionId) public view returns(bool) {
        return block.timestamp >= auctions[auctionId].created + auctions[auctionId].duration;
    }

    // Closes the auction, the auction can close prematurely at the owners discretion
    function close(uint256 id) public onlyClosed(id) {
        // Special case, no buyer
        Auction storage auction = auctions[id];
        if (auction.highestBidder == address(0)) {

            ZyftyNFT nft = ZyftyNFT(auction.zyftyContract);
            nft.transferFrom(address(this), auction.seller, auction.tokenId);
            return;
        }
        // Handle no buyers
        uint256 closedPrice = auction.highestBid;
        uint256 fees = closedPrice / 200;
        IERC20 token = IERC20(auction.asset);
        ZyftyNFT nft = ZyftyNFT(auction.zyftyContract);
        token.transfer(owner(), fees);
        token.transfer(auction.seller, closedPrice - fees);
        nft.transferFrom(address(this), auction.highestBidder, auction.tokenId);
    }

    modifier onlyClosed(uint256 id) {
        require(auctionClosed(id), "The auction must be closed");
        _;
    }

    modifier onlyOpened(uint256 id) {
        require(!auctionClosed(id), "The auction must be opened");
        _;
    }

}
