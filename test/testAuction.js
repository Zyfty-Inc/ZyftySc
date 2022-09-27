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
describe("ZyftyAuction", function () {

    // Define constants, that could be redefined in other tests
    before(async function() {
        this.tokenBalance = 300;
        this.time = 10;
        this.startPrice = 200;
        this.maxPrice = 0;
        this.id = 1;
        this.LIEN_FACTORY = await hre.ethers.getContractFactory("Lien");
        this.lienVal = 0;

        [this.seller, this.bidder1, this.bidder2, this.lien1P, this.zyftyAdmin] = await ethers.getSigners();
    });


    beforeEach(async function() {
        const AUCTION_FACTORY = await ethers.getContractFactory("ZyftyAuction",{
            signer: this.zyftyAdmin, // set the zyftyAdmin as the owner on deploy
        });
        const TOKEN_FACTORY = await ethers.getContractFactory("TestToken");
        const NFT_FACTORY = await hre.ethers.getContractFactory("ZyftyNFT");
        // Create Auction
        this.auction = await AUCTION_FACTORY.deploy()
        this.nft = await NFT_FACTORY.deploy(this.auction.address)
        // Create Token
        this.token = await TOKEN_FACTORY.deploy(this.seller.address, this.bidder1.address, this.bidder2.address, this.tokenBalance);
        this.lien = await this.LIEN_FACTORY.deploy(this.lien1P.address, this.lienVal, this.token.address);
        // Create ERC721
        // Allow Auction to transfer
        // Connect bidder1, bidder2 and seller to auction
        this.b1Conn = this.auction.connect(this.bidder1)
        this.b2Conn = this.auction.connect(this.bidder2)
        this.sellConn = this.auction.connect(this.seller)


        metadataURI = "cid/test.json";
        let leaseHash = "lease-hash"
        let sigMessage = "The following address agrees to the lease"

        await this.nft.connect(this.seller).mint(
            this.seller.address,
            metadataURI,
            this.lien.address,
            leaseHash,
            sigMessage
        );

        await this.token.connect(this.bidder1).approve(this.auction.address, this.tokenBalance);
        await this.token.connect(this.bidder2).approve(this.auction.address, this.tokenBalance);

        await this.nft.connect(this.seller).approve(this.auction.address, this.id);

        await this.sellConn.createAuction(
            this.nft.address,
            this.id,
            this.startPrice,
            this.maxPrice,
            this.token.address,
            this.time
        )
    });

    createHash = async (nft, user, nftId) => {
        const hash = await nft.connect(user).createAgreementHash(nftId, user.address);
        const sig = await user.signMessage(ethers.utils.arrayify(hash))
        return sig;
    }

    it("Creates auction with normal sell", async function() {
        expect(await this.nft.ownerOf(this.id)).to.equal(this.auction.address);

        let hash = createHash(this.nft, this.bidder1, this.id);
        await this.b1Conn.bid(this.id, this.startPrice, hash);

        await sleep(this.time*1000);
        await this.token.connect(this.bidder1).approve(this.auction.address, this.startPrice);

        await this.sellConn.close(this.id);

        const fee = this.startPrice / 200;
        expect(await this.nft.ownerOf(this.id)).to.equal(this.bidder1.address);
        expect(await this.token.balanceOf(this.zyftyAdmin.address)).to.equal(fee);
        expect(await this.token.balanceOf(this.seller.address)).to.equal(this.tokenBalance + this.startPrice - fee);
        expect(await this.token.balanceOf(this.bidder1.address)).to.equal(this.tokenBalance - this.startPrice);

    })

    it("Auction allows for someone else to take over",async function()  {
        let hash1 = createHash(this.nft, this.bidder1, this.id);
        let hash2 = createHash(this.nft, this.bidder2, this.id);
        await this.b1Conn.bid(this.id, this.startPrice, hash1);
        expect(await this.auction.getDeposit(this.id, this.bidder1.address)).to.equal(this.startPrice);
        await expect(this.b2Conn.bid(this.id, this.startPrice, hash2)).to.be.reverted;
        await this.b2Conn.bid(this.id, this.startPrice + 1, hash2);

        await sleep(this.time*1000);
        await this.token.connect(this.bidder1).approve(this.auction.address, this.startPrice);

        await this.sellConn.close(this.id);
        // Owner should now be bidder 2
        expect(await this.nft.ownerOf(this.id)).to.equal(this.bidder2.address);
    })

    it("Auction allows for someone to withdraw", async function()  {
        let hash1 = createHash(this.nft, this.bidder1, this.id);
        let hash2 = createHash(this.nft, this.bidder2, this.id);
        await this.b1Conn.bid(this.id, this.startPrice, hash1);
        expect(await this.auction.getDeposit(this.id, this.bidder1.address)).to.equal(this.startPrice);
        // Leader of auction cannot withdraw
        await expect(this.b1Conn.withdrawFromAuction(this.id)).to.be.reverted

        await this.b2Conn.bid(this.id, this.startPrice + 1, hash2);
        // Now he can withdraw
        await this.b1Conn.withdrawFromAuction(this.id)
        expect(await this.auction.getDeposit(this.id, this.bidder1.address)).to.equal(0);
    })

    it("Lets owner withdraw if it has no bids", async function() {
        await sleep(this.time*1000);
        await this.sellConn.close(this.id);
        expect(await this.nft.ownerOf(this.id)).to.equal(this.seller.address);
    })

});

