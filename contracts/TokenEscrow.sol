pragma solidity ^0.8.1;
// SPDX-License-Identifier: MIT

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "hardhat/console.sol";


import "contracts/ZyftyNFT.sol";

contract HomeToken is ERC20 {
}

contract ZyftySalesContract is Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _propertyIds;

    struct ListedProperty {
        address seller; // The person who gets the funds post sell
        address asset;
        uint256 pricePer;
        uint256 created; // Created time
        uint256 time; // Time until end
        uint256 tokensLeft;
        uint256 totalAssets;
    }

    //      listingID   Property
    mapping (uint256 => ListedProperty) propertyListing;

    //      listingID            user       numTokens
    mapping (uint256 => mapping (address => uint256)) balances;

    function listProperty(
            address seller,
            address asset,
            uint256 pricePer,
            uint256 time)
        public
        onlyOwner
        returns(uint256)
        {
        require(nftContract != address(0), "ZyftySalesContract: NFT Contract is zero address");
        _propertyIds.increment();
        uint256 id =_propertyIds.current();
        propertyListing[id] = ListedProperty({
            seller: seller,
            asset: asset,
            pricePer: pricePer,
            created: block.timestamp,
            time: time,
            tokensLeft: numTokens,
            totalAssets: numTokens
        });
        emit E_PropertyListed(id);
        return id;
    }

    /**
     * Deposits the funds required for buying n tokens.
     * The asset amount could be specified by the user as long
     * as the seller agrees to receive funds in the payment method
     * provided
     */
    function buyToken(uint256 id, uint256 numberOfTokens)
        public
        withinWindow(id)
        {
        require(tokensLeft(id) == numberOfTokens, "Not enough tokens left");
        ListedProperty memory property = getProperty(id);

        uint256 totalCost = property.pricePer*numberOfTokens;
        ERC20 token = ERC20(property.asset)

        // Update balances
        token.transferFrom(msg.sender, address(this), totalCost);
        balances[id][msg.sender] += numberOfTokens;
    }

    function revertSeller(uint256 id)
        public
        afterWindow(id)
        {
    }

    function revertBuyer(uint256 id)
        public
        afterWindow(id)
        {
    }

    function execute(uint256 id)
        public
        withinWindow(id)
        {


    }

    function cleanup(uint256 id) internal {
        delete propertyListing[id];
    }

    modifier withinWindow(uint256 id) {
        require(propertyListing[id].created + propertyListing[id].time >= block.timestamp, "ZyftySalesContract: Window is closed");
        _;
    }

    modifier afterWindow(uint256 id) {
        require(block.timestamp >= propertyListing[id].created + propertyListing[id].time, "ZyftySalesContract: Window is still open");
        _;
    }

    function getProperty(uint256 id) public view returns(ListedProperty memory) {
        return propertyListing[id];
    }

    function tokensLeft(uint256 id) public view returns(uint256) {
        return propertyListing[id].tokensLeft;
    }

    function owedTokens(uint256 id) public view returns(uint256) {
        return balances[id][msg.sender];
    }
}

