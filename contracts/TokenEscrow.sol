pragma solidity ^0.8.1;
// SPDX-License-Identifier: MIT

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "hardhat/console.sol";


import "contracts/ZyftyNFT.sol";

contract HomeToken is ERC20, Ownable {
    constructor(string memory name, string memory symbol, uint256 totalSupply) ERC20(name, symbol) {
        _mint(address(this), totalSupply);
    }

    function send(uint256 numberOfTokens, address buyer) public onlyOwner {
        require(balanceOf(address(this)) >= numberOfTokens, "Not able to transfer, total Supply is messed up");
        transfer(buyer, numberOfTokens);
    }

    // Send 0.5% on sell
    // Not transferable outside zyfty


}

contract TokenFactory is Ownable {
    using Counters for Counters.Counter;
    using SafeMath for uint256;
    Counters.Counter private _propertyIds;

    struct ListedProperty {
        address seller; // The person who gets the funds post sell
        address asset;
        uint256 pricePer;
        uint256 created; // Created time
        uint256 time; // Time until end
        uint256 tokensLeft;
        uint256 totalAssets;
        address createdToken;
    }

    //      listingID   Property
    mapping (uint256 => ListedProperty) propertyListing;

    //      listingID            user       numTokens
    mapping (uint256 => mapping (address => uint256)) balances;

    //      listingID   owners
    mapping (uint256 => address[]) buyers;

    function listProperty(
            address seller,
            address asset,
            uint256 numTokens,
            uint256 pricePer,
            uint256 time)
        public
        onlyOwner
        returns(uint256)
        {
        require(seller != address(0), "Seller address must not be null");
        _propertyIds.increment();
        uint256 id =_propertyIds.current();
        propertyListing[id] = ListedProperty({
            seller: seller,
            asset: asset,
            pricePer: pricePer,
            created: block.timestamp,
            time: time,
            tokensLeft: numTokens,
            totalAssets: numTokens,
            createdToken: address(0)
        });
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
        // TODO Do we need a cotract hash?
        require(tokensLeft(id) == numberOfTokens, "Not enough tokens left");
        ListedProperty memory property = getProperty(id);

        uint256 totalCost = property.pricePer.mul(numberOfTokens);
        ERC20 token = ERC20(property.asset);

        // Update balances
        token.transferFrom(msg.sender, address(this), totalCost);
        if (balances[id][msg.sender] == 0) {
            // First time purchasing
            buyers[id].push(msg.sender);
        }
        balances[id][msg.sender] += numberOfTokens;
    }

    function revertBuyer(uint256 id)
        public
        afterWindow(id)
        {
    }

    function cancelNow(uint256 id) public
        withinWindow(id)
        onlyOwner
        {
        
        ListedProperty memory property = getProperty(id);
        property.time = 0; // RESET to 0.
        
    }

    function execute(uint256 id, string calldata symbol, string calldata name)
        public
        withinWindow(id)
        returns(address)
        {

        ListedProperty memory property = getProperty(id);
        require(property.tokensLeft == 0, "Not all tokens purchased");

        // TODO: Are we taking a fee?
        // Send proceeds to the seller
        ERC20 token = ERC20(property.asset);
        uint256 totalOwed = property.totalAssets.mul(property.pricePer);
        token.transfer(property.seller, totalOwed);

        // Create ERC20 and mint to the buyers
        // TOOD who will own the ERC20 contract?
        HomeToken newERC20 = new HomeToken(name, symbol, property.totalAssets);
        address[] memory toSend = buyers[id];
        mapping(address => uint) storage addrToToken = balances[id];
        for (uint i = 0; i < toSend.length; i++) {
            address addr = toSend[i];
            newERC20.send(addrToToken[addr], addr);
        }
        property.createdToken = address(newERC20);
        // Update address
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

    function getProperty(uint256 id) public view returns(ListedProperty memory) {
        return propertyListing[id];
    }

    function tokensLeft(uint256 id) public view returns(uint256) {
        return propertyListing[id].tokensLeft;
    }

    function owedTokens(uint256 id) public view returns(uint256) {
        return balances[id][msg.sender];
    }

    function contractOf(uint256 id) public view returns(address) {
        address token = propertyListing[id].createdToken;
        require(token != address(0), "ERC20 contract not created");
        return token;
    }

}

