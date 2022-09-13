const { expect } = require("chai");
const { ethers } = require("hardhat");
const hre = require('hardhat');

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}


// Tests should be ran on localhost test network
// Run command `npx hardhat test --network localhost` to test this code
describe("ZyftySalesContract", function () {

    // Define constants, that could be redefined in other tests
    before(async function() {
        this.tokenBalance = 300;
        this.time = 5;
        this.price = 200;
        this.id = 1;
        this.idOther = 2;
        this.LIEN_FACTORY = await hre.ethers.getContractFactory("Lien");
        this.lienVal = 0;

        [this.seller, this.buyer, this.lien1P, this.zyftyAdmin] = await ethers.getSigners();
    });


    beforeEach(async function() {
    });

    createHash = async (nft, user, nftId) => {
        const hash = await nft.connect(user).createAgreementHash(nftId, user.address);
        const sig = await user.signMessage(ethers.utils.arrayify(hash))
        return sig;
    }

});

