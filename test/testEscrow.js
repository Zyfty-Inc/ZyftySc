const { expect } = require("chai");
const { ethers } = require("hardhat");
const hre = require('hardhat');
const { calcEthereumTransactionParams } = require("@acala-network/eth-providers")

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
        this.time = 8;
        this.price = 200;
        this.id = 1;
        this.idOther = 2;
        this.LIEN_FACTORY = await hre.ethers.getContractFactory("Lien");
        this.lienVal = 0;

        [this.seller, this.buyer, this.lien1P, this.zyftyAdmin] = await ethers.getSigners();
    });


    beforeEach(async function() { 
        // for logging
        const ESCROW_FACTORY = await ethers.getContractFactory("ZyftySalesContract"{
            signer: this.zyftyAdmin, // set the zyftyAdmin as the owner on deploy
        });
        const TOKEN_FACTORY = await ethers.getContractFactory("TestToken");
        const NFT_FACTORY = await hre.ethers.getContractFactory("ZyftyNFT");

        let leaseHash = "lease-hash"

        this.escrow = await ESCROW_FACTORY.deploy();
        this.nft = await NFT_FACTORY.deploy(this.escrow.address);
        
        // Create two assets, one for selling one for liens
        this.token = await TOKEN_FACTORY.deploy(this.seller.address, this.buyer.address, this.lien1P.address, this.tokenBalance);

        this.lienToken = await TOKEN_FACTORY.deploy(this.seller.address, this.buyer.address, this.lien1P.address, this.tokenBalance)

        this.lien = await this.LIEN_FACTORY.deploy(this.lien1P.address, this.lienVal, this.lienToken.address);

        metadataURI = "cid/test.json";
        let sigMessage = "The following address agrees to the lease"

        let r = await this.nft.connect(this.seller).mint(
            this.seller.address,
            metadataURI,
            this.lien.address,
            leaseHash,
            sigMessage
        );
        await r.wait()

        // mint a second one for fake signing + secondary test
        r = await this.nft.connect(this.seller).mint(
            this.seller.address,
            metadataURI,
            this.lien.address,
            leaseHash,
            sigMessage
        );
        await r.wait()

        r = await this.nft.connect(this.seller).approve(this.escrow.address, this.id);
        await r.wait()


        this.buyerConn = this.escrow.connect(this.buyer);
        this.sellerConn = this.escrow.connect(this.seller);

        r = await this.token.connect(this.buyer).approve(this.escrow.address, this.price);
        await r.wait()

        r = await this.sellerConn.sellProperty(
            this.nft.address, 
            this.id,  // tokenID
            this.token.address,
            this.price,  // price
            this.time, //time
        );
        await r.wait()
        await this.sellerConn.addBuyer(
            this.id, // Property ID
            this.buyer.address
        )
        this.startTimeStamp = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp;
    });

    createHash = async (nft, user, nftId) => {
        const hash = await nft.connect(user).createAgreementHash(nftId, user.address);
        const sig = await user.signMessage(ethers.utils.arrayify(hash))
        return sig;
    }

    it("Executes escrow succesfully", async function() {
        let hash = await createHash(this.nft, this.buyer, this.id)
        expect(await this.nft.ownerOf(this.id)).to.equal(this.escrow.address);
        expect(await this.nft.balanceOf(this.buyer.address)).to.equal(0);

        expect(await this.token.balanceOf(this.buyer.address)).to.equal(this.tokenBalance);
        let r = await this.buyerConn.buyProperty(this.id, hash);
        await r.wait()
        // expect(await this.token.balanceOf(this.escrow.address)).to.equal(this.price);

        // expect(await this.nft.ownerOf(this.id)).to.equal(this.escrow.address);
        r = await this.sellerConn.execute(this.id);
        await r.wait()

        const fee = this.price/200;
        expect(await this.token.balanceOf(this.seller.address)).to.equal(this.price - fee + this.tokenBalance);
        expect(await this.token.balanceOf(this.zyftyAdmin.address)).to.equal(fee);
        expect(await this.token.balanceOf(this.buyer.address)).to.equal(this.tokenBalance - this.price);

        // Should have only 1 nft now
        expect(await this.nft.balanceOf(this.seller.address)).to.equal(1);
        expect(await this.nft.balanceOf(this.buyer.address)).to.equal(1);
    });

    it("Reverts seller escrow", async function() {
        // await expect(this.sellerConn.revertSeller(this.id)).to.be.reverted;
        let diff;
        do {
            await sleep((this.time*0.5)*1000);
            await this.token.connect(this.buyer).approve(this.escrow.address, this.price);
            const timeNow = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp;
            diff = timeNow - this.startTimeStamp;
        } while (diff < this.time);

        // Ensure this fails
        await expect(this.buyerConn.revertSeller(this.id)).to.be.reverted;

        let r = await this.sellerConn.revertSeller(this.id);
        await r.wait()

        expect(await this.nft.ownerOf(this.id)).to.equal(this.seller.address);

        await expect(this.sellerConn.execute(this.id)).to.be.revertedWith("Window is closed");

        const p = await this.escrow.getProperty(this.id);
        expect(p.state).to.equal(0); // 0 == DOESN'T Exist
    });

    it("Reverts buyer escrow", async function() {
        let hash = await createHash(this.nft, this.buyer, this.id);
        await this.token.connect(this.buyer).approve(this.escrow.address, this.price);

        let r = await this.buyerConn.buyProperty(this.id, hash);
        await r.wait();
        expect(await this.token.balanceOf(this.buyer.address)).to.equal(this.tokenBalance - this.price);
        await expect(this.buyerConn.revertBuyer(this.id)).to.be.revertedWith("Window is still open");
        // Ensure this fails
        await expect(this.sellerConn.revertBuyer(this.id)).to.be.reverted;

        // Add in this to pad the timestamps
        let diff;
        do {
            await sleep((this.time*0.5)*1000);
            await this.token.connect(this.buyer).approve(this.escrow.address, this.price);
            const timeNow = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp;
            diff = timeNow - this.startTimeStamp;
        } while (diff < this.time);
        r = await this.buyerConn.revertBuyer(this.id);
        await r.wait()
        expect(await this.token.balanceOf(this.buyer.address)).to.equal(this.tokenBalance);

        const p = await this.escrow.getProperty(this.id);
        expect(p.state).to.equal(3); // 3 == CANCLED

        this.lienVal = 30; // For next test increase the lien value to a non zero number
    });

    it("Pays off primary lien account with funds already in the NFT", async function() {
        const reserveAccount = this.lienVal*2;
        this.lienToken.connect(this.seller).approve(this.nft.address, reserveAccount)
        // Add additional funds to cover lien payment
        await this.nft.connect(this.seller).increaseReserve(this.id, reserveAccount);

        await this.nft.connect(this.seller).approve(this.escrow.address, this.idOther);

        let hash = await createHash(this.nft, this.buyer, this.id)
        await this.buyerConn.buyProperty(this.id, hash)

        await this.sellerConn.execute(this.id);

        const fee = this.price/200;
        // Should have the funds left + the amount in reserve account
        expect(await this.token.balanceOf(this.seller.address)).to.equal(this.price - fee + this.tokenBalance);
        expect(await this.lienToken.balanceOf(this.seller.address)).to.equal(this.tokenBalance - this.lienVal);
        expect(await this.token.balanceOf(this.buyer.address)).to.equal(this.tokenBalance - this.price);

    });

    it("Reverts execute when there are no funds in the lien account", async function() {
        let hash = await createHash(this.nft, this.buyer, this.id)
        let r = await this.buyerConn.buyProperty(this.id, hash)
        await r.wait()

        await expect(this.sellerConn.execute(this.id)).to.be.revertedWith('ZyftySalesContract: Not enough funds to fully payout liens');

        this.lienVal = this.price; // For the next testcase
    });

    it("Fails buy when signed by the wrong person", async function() {
        // Wrong signer
        let hash = await createHash(this.nft, this.seller, this.id)
        expect(await this.nft.ownerOf(this.id)).to.equal(this.escrow.address);
        expect(await this.nft.balanceOf(this.buyer.address)).to.equal(0);

        expect(await this.token.balanceOf(this.buyer.address)).to.equal(this.tokenBalance);
        await expect(this.buyerConn.buyProperty(this.id, hash)).to.be.revertedWith("ZyftySalesContract: Incorrect Agreement Signature");
    });

    it("Fails buy when incorrect hash", async function() {
        // Wrong message
        let hash = await createHash(this.nft, this.buyer, this.idOther);
        expect(await this.nft.ownerOf(this.id)).to.equal(this.escrow.address);
        expect(await this.nft.balanceOf(this.buyer.address)).to.equal(0);

        expect(await this.token.balanceOf(this.buyer.address)).to.equal(this.tokenBalance);
        await expect(this.buyerConn.buyProperty(this.id, hash)).to.be.revertedWith("ZyftySalesContract: Incorrect Agreement Signature");
    });

    it("Disallows non buyers to purchase", async function () {
        expect(false).to.equal(true);
    });

    it("Allows buyer to propose lower price", async () => {
        expect(false).to.equal(true);
    });

    it("Allows seller to deny lower price", async () => {
        expect(false).to.equal(true);
    });

    it("Cleans proposed prices on sell", async () => {
        expect(false).to.equal(true);
    });

});

