pragma solidity ^0.8.1;
// SPDX-License-Identifier: MIT

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import "hardhat/console.sol";

import { ZyftyToken } from "./ZyftyToken.sol";
import "./ERC4671/IERC4671.sol";

contract TokenFactory is Ownable {
    using Counters for Counters.Counter;
    using SafeMath for uint256;
    using ECDSA for bytes32;
    Counters.Counter private _propertyIds;

    struct ListedProperty {
        address seller; // The person who gets the funds post sell
        address asset;
        uint256 pricePer;
        uint48 created; // Created time
        uint32 time; // Time to wait
        uint16 tokensLeft;
        uint16 totalAssets;
        string agreement;
        uint256 tokenId; // The ERC1155 tokenID could be 1-1 with the escrowID but is not guaranteed
                         // for this reason we have this additional field added in.
    }

    address _tokenContract;
    address _kycContract;

    //      listingID   Property
    mapping (uint256 => ListedProperty) propertyListing;

    //      listingID            user       numTokens
    mapping (uint256 => mapping (address => uint256)) balances;

    //      listingID   owners
    mapping (uint256 => address[]) buyers;

    constructor(address kycContract, address tokenContract) {
        _kycContract = kycContract;
        _tokenContract = tokenContract;
    }

    function listProperty(
            address seller,
            address asset,
            uint16 numTokens,
            uint256 pricePer,
            uint32 time,
            string memory agreement)
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
            created: uint32(block.timestamp % 2**32),
            time: time,
            tokensLeft: numTokens,
            totalAssets: numTokens,
            tokenId: 0, // 0 means does not exist
            agreement: agreement
        });
        return id;
    }

    /**
     * Deposits the funds required for buying n tokens.
     * The asset amount could be specified by the user as long
     * as the seller agrees to receive funds in the payment method
     * provided
     */
    function buyToken(uint256 id, uint16 numberOfTokens, bytes memory agreementSignature)
        public
        isKYC
        withinWindow(id)
        {
        address signedAddress = createAgreementHash(id, msg.sender)
                                    .toEthSignedMessageHash()
                                    .recover(agreementSignature);

        require(signedAddress == msg.sender, "ZyftyTokenFactory: Incorrect Agreement Signature");

        require(tokensLeft(id) >= numberOfTokens, "Not enough tokens left");
        ListedProperty storage property = propertyListing[id];

        uint256 totalCost = property.pricePer.mul(numberOfTokens);
        // TODO would we need to support erc1155 tokens also?
        ERC20 token = ERC20(property.asset);

        // Update balances
        token.transferFrom(msg.sender, address(this), totalCost);
        if (balances[id][msg.sender] == 0) {
            // First time purchasing
            buyers[id].push(msg.sender);
        }
        balances[id][msg.sender] += numberOfTokens;
        property.tokensLeft -=  numberOfTokens;
    }

    /**
     * @dev Creates an agreement hash for escrowId, with address addr
     */
    function createAgreementHash(uint256 escrowId, address addr)
        public
        view
        returns(bytes32) {
        string memory agreement = propertyListing[escrowId].agreement;
        return keccak256(abi.encode(agreement, addr, escrowId, address(this)));
    }


    function revert(uint256 id)
        public
        afterWindow(id)
        {

        uint256 numberOfTokens = balances[id][msg.sender];
        require(numberOfTokens > 0, "No tokens purchased");

        ListedProperty storage property = propertyListing[id];

        uint256 totalCost = property.pricePer.mul(uint256(numberOfTokens));
        ERC20 token = ERC20(property.asset);
        token.transfer(msg.sender, totalCost);
        balances[id][msg.sender] = 0;
    }

    function execute(uint256 id)
        public
        isKYC
        withinWindow(id)
        returns(address)
        {

        ListedProperty storage property = propertyListing[id];
        require(property.tokensLeft == 0, "Not all tokens purchased");

        // Send proceeds to the seller
        // and collects fee
        ERC20 token = ERC20(property.asset);
        uint256 totalOwed = property.pricePer.mul(uint256(property.totalAssets));
        token.transfer(property.seller, totalOwed - totalOwed/200);
        token.transfer(owner(), totalOwed/200);

        // Create ERC20 and mint to the buyers
        uint256[] memory amounts = new uint256[](buyers[id].length);
        for (uint i = 0; i < buyers[id].length; i++) {
            // Get the balance of buyer i
            amounts[i] = balances[id][buyers[id][i]];
        }
        uint256 tokenId = ZyftyToken(_tokenContract).newToken(buyers[id], amounts);
        property.tokenId = tokenId;
    }

    function cleanup(uint256 id) internal {
        delete propertyListing[id];
    }

    function getProperty(uint256 id) public view returns(ListedProperty memory) {
        return propertyListing[id];
    }

    function tokensLeft(uint256 id) public view returns(uint256) {
        return propertyListing[id].tokensLeft;
    }

    function pricePer(uint256 id) public view returns(uint256) {
        return propertyListing[id].pricePer;
    }

    function owedTokens(uint256 id) public view returns(uint256) {
        return balances[id][msg.sender];
    }

    function allProperties() public view returns(ListedProperty[] memory) {
        uint256 id =_propertyIds.current();
        ListedProperty[] memory properties = new ListedProperty[](id);
        for (uint i = 1; i < id + 1; i++) {
            ListedProperty storage prop = propertyListing[i];
            properties[i-1] = prop;
        }
        return properties;
    }

    function tokenId(uint256 escrowId) public view returns(uint256) {
        uint256 token = propertyListing[escrowId].tokenId;
        require(token != 0, "Token not created");
        return token;
    }

    function setKYCcontract(address newAddress) public onlyOwner {
        _kycContract = newAddress;
    }

    function kycContract() public view returns(address) {
        return _kycContract;
    }

    function isOpen(uint256 id) public view returns (bool) {
        return propertyListing[id].created + propertyListing[id].time >= block.timestamp;
    }

    modifier withinWindow(uint256 id) {
        require(isOpen(id), "Window is closed");
        _;
    }

    modifier afterWindow(uint256 id) {
        require(!isOpen(id), "Window is still open");
        _;
    }

    modifier isKYC() {
        require(IERC4671(_kycContract).hasValid(msg.sender), "Access denied, not KYC verified");
        _;
    }


}

