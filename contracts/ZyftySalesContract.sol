pragma solidity ^0.8.1;
// SPDX-License-Identifier: MIT

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

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
    Counters.Counter private _propertyIds;

    enum EscrowState {
        NOT_CREATED, // Have initial state be not created for after clearing
        INITIALIZED,
        FUNDED,
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
        address asset; // do both
        uint256 price;
        uint256 created;

        bool buyerPaid;
        EscrowState state;
    }

    //      listingID   Property
    mapping (uint256 => ListedProperty) propertyListing;
    address private admin;

    constructor(address zyftyAdmin) {
        admin = zyftyAdmin;
    }

    function sellPropertyBuyer(
            address nftContract,
            uint256 tokenId,
            uint256 price,
            uint256 time,
            address buyer)
        public
        returns(uint256)
        {
        require(nftContract != address(0), "NFT Contract is zero address");
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
                                              asset: nft.asset(tokenId),
                                              price: price,
                                              buyer: buyer,
                                              seller: msg.sender,
                                              buyerPaid: false,
                                              created: block.timestamp,
                                              state: EscrowState.INITIALIZED});
        emit E_PropertyListed(id);
        return id;
    }

    function sellProperty(
            address nftContract,
            uint256 tokenId,
            uint256 price,
            uint256 time)
            public {
        sellPropertyBuyer(nftContract, tokenId, price, time, address(0));
    }

    // hash identifying_info_hash, nft_physical_contract_hash signature 
    function buyProperty(uint256 id, string memory lease_contract_hash)
        public
        inState(id, EscrowState.INITIALIZED)
        withinWindow(id)
        {
        // bytes32 messageHash = keccak256(abi.encode("\x19The following address agrees to this lease hash:\n32", msg.sender, nft.leaseHash()));
        // require(messageHash == lease_contract_hash);
        require(propertyListing[id].buyer == address(0) || msg.sender == propertyListing[id].buyer, "You are not authorized to buy this");
        IERC20 token = IERC20(propertyListing[id].asset);

        token.transferFrom(msg.sender, address(this), propertyListing[id].price);
        propertyListing[id].state = EscrowState.FUNDED;
        propertyListing[id].buyerPaid = true;
        propertyListing[id].buyer = msg.sender;
    }

    function revertSeller(uint256 id)
        public
        afterWindow(id)
        {
        require(msg.sender == propertyListing[id].seller, "You must be the seller");
        IERC721 nft = IERC721(propertyListing[id].nftContract);
        nft.transferFrom(address(this), msg.sender, id);
        propertyListing[id].state = EscrowState.CANCELED;
        if (propertyListing[id].buyerPaid == false) {
            cleanup(id);
        }
    }

    function revertBuyer(uint256 id)
        public
        afterWindow(id)
        {
        require(propertyListing[id].buyerPaid == true, "Buyer never paid");
        require(msg.sender == propertyListing[id].buyer, "You must be the buyer");
        IERC20 token = IERC20(propertyListing[id].asset);
        token.transfer(propertyListing[id].buyer, propertyListing[id].price);
        if (propertyListing[id].state == EscrowState.CANCELED) {
            cleanup(id);
        } else {
            propertyListing[id].state = EscrowState.CANCELED;
            propertyListing[id].buyerPaid = false;
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
        ILien l = ILien(nft.lien(propertyListing[id].tokenID));
        require(propertyListing[id].price - (l.balance() + fees) >= 0, "Not enough funds to fully payout liens");
        // Approve the transfer to increase the reserve account
        token.approve(propertyListing[id].nftContract, propertyListing[id].price - fees);
        nft.increaseReserve(propertyListing[id].tokenID, propertyListing[id].price - fees);

        nft.payLien(propertyListing[id].tokenID, l.balance());
        delete l;

        uint256 remainingFunds = nft.getReserve(propertyListing[id].tokenID);
        nft.redeemReserve(propertyListing[id].tokenID, remainingFunds);

        // Should already hold these fees
        token.transfer(admin, fees);
        // Proceeds after liens paid go here
        token.transfer(propertyListing[id].seller, remainingFunds);

        // Finally transfer the NFT to the buyer
        nft.transferFrom(address(this), propertyListing[id].buyer, propertyListing[id].tokenID);
        emit E_PropertySold(id, propertyListing[id].seller, propertyListing[id].buyer);
        // cleanup
        cleanup(id);
    }

    function cleanup(uint256 id) internal {
        delete propertyListing[id];
    }

    modifier withinWindow(uint256 id) {
        require(propertyListing[id].created + propertyListing[id].time >= block.timestamp, "Window is closed");
        _;
    }

    modifier afterWindow(uint256 id) {
        require(block.timestamp >= propertyListing[id].created + propertyListing[id].time, "Window is still open");
        _;
    }

    modifier inState(uint256 id, EscrowState state) {
        require(propertyListing[id].state == state, "Not in the correct state");
        _;
    }

    function getProperty(uint256 id) public view returns(ListedProperty memory) {
        return propertyListing[id];
    }

    // Functions to verify hash signature
    function getMessageHash(
        address signer,
        string memory name, // Name hash
        string memory nft_lease_hash
    ) public view returns (bytes32) {
        return keccak256(abi.encodePacked(signer, name, nft_lease_hash));
    }

    function getEthSignedMessageHash(bytes32 _messageHash)
        public
        view
        returns (bytes32)
    {
        return
            keccak256(
                abi.encodePacked("\x19The address+name agrees to the lease hash:\n32", _messageHash)
            );
    }

    function verify(
        address _signer,
        string memory name,
        string memory nft_lease_hash,
        bytes memory signature
    ) public view returns (bool) {
        bytes32 messageHash = getMessageHash(_signer, name, nft_lease_hash);
        bytes32 ethSignedMessageHash = getEthSignedMessageHash(messageHash);

        return recoverSigner(ethSignedMessageHash, signature) == _signer;
    }

    function recoverSigner(bytes32 _ethSignedMessageHash, bytes memory _signature)
        public
        view
        returns (address)
    {
        (bytes32 r, bytes32 s, uint8 v) = splitSignature(_signature);

        return ecrecover(_ethSignedMessageHash, v, r, s);
    }

    function splitSignature(bytes memory sig)
        public
        view
        returns (
            bytes32 r,
            bytes32 s,
            uint8 v
        )
    {
        require(sig.length == 65, "invalid signature length");

        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
    }

}

