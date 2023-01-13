pragma solidity ^0.8.1;
// SPDX-License-Identifier: MIT

import "@openzeppelin/contracts/access/Ownable.sol";
import "./ERC4671/ERC4671.sol";

import "hardhat/console.sol";

contract ZyftyKYC is Ownable, ERC4671 {

    address _issuer;

    constructor(address issuer, string memory name_, string memory symbol_) ERC4671(name_, symbol_) {
        _issuer = issuer;
    }

    function changeIssuer(address newAddress) public onlyOwner {
        _issuer = newAddress;
    }

    function mint(address owner) public onlyIssuer {
        // TODO Will there be a chance to reissue if we
        // explicilty revoked
        require(!hasValid(owner), "Can only issue a single valid token at a time");
        _mint(owner);
    }

    function revoke(address badActor) public onlyIssuer {
        require(hasValid(badActor), "Cannot revoke token, has nothing to revoke");
        uint256 index = 0;
        uint256 token = tokenOfOwnerByIndex(badActor, index);

        // Look for first valid token (will be found)
        while (!isValid(token)) {
            index++;
            token = tokenOfOwnerByIndex(badActor, index);
        }
        _revoke(token);
    }

    modifier onlyIssuer() {
        require(

            msg.sender == _issuer,
            "Access denied, not signed by _issuer"
        );
        _;
    }

    function _baseURI() internal pure virtual override returns (string memory) {
        return "";
    }
}
