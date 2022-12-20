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
describe("TokenFactory", function () {

    // Define constants, that could be redefined in other tests
    before(async function() {
        this.tokenBalance = 300;
        this.time = 8;
        this.pricePer = 5;
        this.tokens = 12;
        this.id = 1;
        [this.seller, this.buyer1, this.buyer2, this.buyer3, this.zyftyAdmin] = await ethers.getSigners();

        // For now lets have only admin control both the payouts and the 
        const KYC_FACTORY = await ethers.getContractFactory("ZyftyKYC")
        this.kyc = await KYC_FACTORY.deploy(this.zyftyAdmin.address, "ZyftyKYC", "ZKYC");
        this.kycConnection = this.kyc.connect(this.zyftyAdmin);

        // Only allow buyer 1 and 2 to buy
        await this.kycConnection.mint(this.buyer1.address)
        await this.kycConnection.mint(this.buyer2.address)
    });


    beforeEach(async function() { 
        // for logging
        const ESCROW_FACTORY = await ethers.getContractFactory("TokenFactory",{
            signer: this.zyftyAdmin, // set the zyftyAdmin as the owner on deploy
        });
        const TOKEN_FACTORY = await ethers.getContractFactory("TestToken");
        this.HOME_TOKEN_FACTORY = await ethers.getContractFactory("HomeToken");

        this.escrow = await ESCROW_FACTORY.deploy(this.kyc.address);
        
        // Create two assets, one for selling one for liens
        this.token = await TOKEN_FACTORY.deploy(this.buyer1.address, this.buyer2.address, this.buyer3.address, this.tokenBalance);

        this.buyer1Conn = this.escrow.connect(this.buyer1);
        this.buyer2Conn = this.escrow.connect(this.buyer2);
        this.buyer3Conn = this.escrow.connect(this.buyer3);

        let totalCost = this.pricePer*this.tokens   

        r = await this.token.connect(this.buyer1).approve(this.escrow.address, totalCost);
        r = await this.token.connect(this.buyer2).approve(this.escrow.address, totalCost);
        r = await this.token.connect(this.buyer3).approve(this.escrow.address, totalCost);
        await r.wait()

        r = await this.escrow.listProperty(
            this.seller.address,
            this.token.address,
            this.tokens,
            this.pricePer,
            this.time, //time
        );
        this.startTimeStamp = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp;
    });

    it("Executes and mints proper contracts", async function() {

        let pricePaid = 3*this.tokens/4*this.pricePer;
        await this.buyer1Conn.buyToken(this.id, 3*this.tokens/4);
        expect(await this.token.balanceOf(this.buyer1.address)).to.equal(this.tokenBalance - pricePaid);

        await expect(this.buyer1Conn.execute(this.id, "SYM", "HOMETOKEN")).to.be.revertedWith('Not all tokens purchased');
        await this.buyer2Conn.buyToken(this.id, this.tokens/4);
        await this.buyer1Conn.execute(this.id, "SYM", "HOMETOKEN")

        const tokenAddress = this.escrow.contractOf(this.id);
        const token = this.HOME_TOKEN_FACTORY.attach(tokenAddress)
        expect(await token.balanceOf(this.buyer1.address)).to.equal(3*this.tokens/4);
        expect(await token.balanceOf(this.buyer2.address)).to.equal(this.tokens/4);

        r = await this.escrow.listProperty(
            this.seller.address,
            this.token.address,
            this.tokens,
            this.pricePer,
            this.time, //time
        );

        r = await this.escrow.listProperty(
            this.seller.address,
            this.token.address,
            this.tokens,
            this.pricePer,
            this.time, //time
        );
        await r.wait();
    });

    it("Disallows non KYCd tokens unless they get KYcd", async function() {

        // Buy half
        await expect(this.buyer3Conn.buyToken(this.id, this.tokens/2))
            .to.be.revertedWith("Access denied, not KYC verified");

        await this.kycConnection.mint(this.buyer3.address)

        // Should now work
        await this.buyer3Conn.buyToken(this.id, this.tokens/2)

        // Should now be broken again (revoke twice to test for revoking the valid token)
        await this.kycConnection.revoke(this.buyer3.address)
        await this.kycConnection.mint(this.buyer3.address)
        await this.kycConnection.revoke(this.buyer3.address)

        await expect(this.buyer3Conn.buyToken(this.id, this.tokens/2))
            .to.be.revertedWith("Access denied, not KYC verified");
    });

});

