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

        [this.seller, this.bider1, this.bidder2, this.lien1P, this.zyftyAdmin] = await ethers.getSigners();
    });


    beforeEach(async function() {
        // Create Auction
        // Create Token
        // Create ERC721
        // Allow Auction to transfer
        // Connect bidder1, bidder2 and seller to auction
        this.b1Conn = this.auction.connect(this.bidder1)
        this.b2Conn = this.auction.connect(this.bidder2)
        this.sellConn = this.auction.connect(this.seller)
    });

    createHash = async (nft, user, nftId) => {
        const hash = await nft.connect(user).createAgreementHash(nftId, user.address);
        const sig = await user.signMessage(ethers.utils.arrayify(hash))
        return sig;
    }

    it("Creates auction with normal sell", async () => {
        expect(false).to.equal(true);
    })

    it("Auction allows for someone else to take over",async () =>  {
        expect(false).to.equal(true);
    })

    it("Auction allows for someone to withdraw", async () =>  {
        expect(false).to.equal(true);
    })

    it("Sends settlement charge to admin", async () => {
        expect(false).to.equal(true);
    });

    it("Stops top bidder from withdrawing", async () => {
        expect(false).to.equal(true);
    });

    it("Requires next bid to be greater than previous bid", async () => {
        expect(false).to.equal(true);
    });



});

