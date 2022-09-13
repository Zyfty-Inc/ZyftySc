pragma solidity ^0.8.1;
// SPDX-License-Identifier: MIT

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import "hardhat/console.sol";


import "contracts/ZyftyNFT.sol";

contract TestToken is ERC20 {
    constructor(address b, address a, address c, uint256 amount) ERC20("TestToken", "TT"){
        _mint(b, amount);
        _mint(c, amount);
        _mint(a, amount);
    }
}

contract ZyftySalesContract is Ownable {
    using Counters for Counters.Counter;
    using ECDSA for bytes32;
    Counters.Counter private _propertyIds;

    enum EscrowState {
        NOT_CREATED, // Have initial state be not created for after clearing
        INITIALIZED, // buyer should begin as address(0)
        FUNDED, // buyer should be non 0
        CANCELED
    }

    event E_PropertyListed(uint256 propertyId);
    event E_PropertySold(uint256 indexed propertyId, address from, address to);

    struct ListedProperty {
        address nftContract;
        uint256 tokenID;
        address seller;
        address buyer;
        uint256 time; // seconds
        address asset;
        uint256 price;
        uint256 created;

        EscrowState state;
    }

    //      listingID   Property
    mapping (uint256 => ListedProperty) propertyListing;

    // Whitelist structure for buyers
    //     listingID           user       Able to buy
    mapping (uint256 => mapping(address => bool)) buyers;
    address private admin;

    constructor(address zyftyAdmin) {
        admin = zyftyAdmin;
    }

    function sellProperty(
            address nftContract,
            uint256 tokenId,
            address asset,
            uint256 price,
            uint256 time)
        public
        returns(uint256)
        {
        require(nftContract != address(0), "ZyftySalesContract: NFT Contract is zero address");
        ZyftyNFT nft = ZyftyNFT(nftContract);
        nft.transferFrom(msg.sender, address(this), tokenId);
        ILien l = ILien(nft.lien(tokenId));
        try l.update() {
        } catch {}
        _propertyIds.increment();
        uint256 id =_propertyIds.current();
        propertyListing[id] = ListedProperty({nftContract: nftContract,
                                              tokenID: tokenId,
                                              time: time,
                                              asset: asset,
                                              price: price,
                                              buyer: address(0),
                                              seller: msg.sender,
                                              created: block.timestamp,
                                              state: EscrowState.INITIALIZED});
        emit E_PropertyListed(id);
        return id;
    }

    function addBuyer(uint256 id, address buyer) 
        public 
        inState(id, EscrowState.INITIALIZED) // Can't add buyer in a non funded state
        withinWindow(id) {
        
        require(propertyListing[id].seller == msg.sender, "ZyftySalesContract: You are not the seller");
        buyers[id][buyer] = true;
    }

    function removeBuyer(uint256 id, address buyer) 
        public 
        inState(id, EscrowState.INITIALIZED)
        withinWindow(id) {
        
        require(propertyListing[id].seller == msg.sender, "ZyftySalesContract: You are not the seller");
        buyers[id][buyer] = false;
    }

    /**
     * Deposits the funds required for depositng the asset.
     * The asset amount could be specified by the user as long
     * as the seller agrees to receive funds in the payment method
     * provided
     */
    function buyProperty(uint256 id, bytes memory agreementSignature)
        public
        inState(id, EscrowState.INITIALIZED)
        withinWindow(id)
        canBuy(id)
        {
        ZyftyNFT nft = ZyftyNFT(propertyListing[id].nftContract);
        address signedAddress = nft.createAgreementHash(propertyListing[id].tokenID, msg.sender)
                                    .toEthSignedMessageHash()
                                    .recover(agreementSignature);

        require(signedAddress == msg.sender, "ZyftySalesContract: Incorrect Agreement Signature");
        IERC20 token = IERC20(propertyListing[id].asset);

        token.transferFrom(msg.sender, address(this), propertyListing[id].price);
        propertyListing[id].state = EscrowState.FUNDED;
        propertyListing[id].buyer = msg.sender;
    }


    function revertSeller(uint256 id)
        public
        afterWindow(id)
        {
        require(msg.sender == propertyListing[id].seller, "ZyftySalesContract: You must be the seller");
        IERC721 nft = IERC721(propertyListing[id].nftContract);
        nft.transferFrom(address(this), msg.sender, id);
        propertyListing[id].state = EscrowState.CANCELED;
        // If no buyer exists, then there is no refund owed to the buyer
        if (propertyListing[id].buyer == address(0)) {
            cleanup(id);
        }
    }

    function revertBuyer(uint256 id)
        public
        afterWindow(id)
        {
        address buyer = propertyListing[id].buyer;
        require(buyer != address(0), "ZyftySalesContract: Buyer does not exist");
        require(msg.sender == buyer, "ZyftySalesContract: You must be the buyer");
        IERC20 token = IERC20(propertyListing[id].asset);
        token.transfer(propertyListing[id].buyer, propertyListing[id].price);
        if (propertyListing[id].state == EscrowState.CANCELED) {
            cleanup(id);
        } else {
            propertyListing[id].state = EscrowState.CANCELED;
            // Set buyer to 0 address to prevent double revert
            propertyListing[id].buyer = address(0);
        }
    }

    function execute(uint256 id)
        public
        withinWindow(id)
        inState(id, EscrowState.FUNDED)
        {
        require(msg.sender == propertyListing[id].buyer || msg.sender == propertyListing[id].seller);
        ZyftyNFT nft = ZyftyNFT(propertyListing[id].nftContract);
        IERC20 token = IERC20(propertyListing[id].asset);

        uint256 fees = propertyListing[id].price/200;
        uint256 lienBalance = ILien(nft.lien(propertyListing[id].tokenID)).balance();

        require(nft.getReserve(propertyListing[id].tokenID) >= lienBalance, "ZyftySalesContract: Not enough funds to fully payout liens");

        nft.payLien(propertyListing[id].tokenID, lienBalance);

        uint256 remainingFunds = nft.getReserve(propertyListing[id].tokenID);
        IERC20 lienToken = IERC20(nft.asset(propertyListing[id].tokenID));
        // Get the lien token's value
        nft.redeemReserve(propertyListing[id].tokenID, remainingFunds);

        // Transfer fees to the admin
        token.transfer(admin, fees);

        // Sends price - fees in settlement asset
        token.transfer(propertyListing[id].seller, propertyListing[id].price - fees);
        // Sends left over lien assets to the seller.
        lienToken.transfer(propertyListing[id].seller, remainingFunds);

        // Finally transfer the NFT to the buyer
        nft.transferFrom(address(this), propertyListing[id].buyer, propertyListing[id].tokenID);
        emit E_PropertySold(id, propertyListing[id].seller, propertyListing[id].buyer);
        // cleanup
        cleanup(id);
    }

    function cleanup(uint256 id) internal {
        delete propertyListing[id];
        // delete buyers[id];
    }

    modifier withinWindow(uint256 id) {
        require(propertyListing[id].created + propertyListing[id].time >= block.timestamp, "ZyftySalesContract: Window is closed");
        _;
    }

    modifier afterWindow(uint256 id) {
        require(block.timestamp >= propertyListing[id].created + propertyListing[id].time, "ZyftySalesContract: Window is still open");
        _;
    }

    modifier inState(uint256 id, EscrowState state) {
        require(propertyListing[id].state == state, "ZyftySalesContract: Not in the correct state");
        _;
    }

    modifier canBuy(uint256 id) {
        require(buyers[id][msg.sender] == true, "ZyftySalesContract: Not an approved buyer");
        _;
    }

    function getProperty(uint256 id) public view returns(ListedProperty memory) {
        return propertyListing[id];
    }
}

