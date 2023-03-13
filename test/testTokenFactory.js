const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const hre = require('hardhat');
const { calcEthereumTransactionParams } = require("@acala-network/eth-providers")

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}


// Tests should be ran on localhost test network
// Run command `npx hardhat test --network localhost` to test this code
describe("TokenFactory", function() {

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
        const ESCROW_FACTORY = await ethers.getContractFactory("TokenFactory", {
            signer: this.zyftyAdmin, // set the zyftyAdmin as the owner on deploy
        });
        const TOKEN_FACTORY = await ethers.getContractFactory("TestToken");
        const ZyftyToken = await ethers.getContractFactory("ZyftyToken");

        this.zyftyToken = await upgrades.deployProxy(ZyftyToken, [this.zyftyAdmin.address]);

        this.escrow = await ESCROW_FACTORY.deploy(this.kyc.address, this.zyftyToken.address);
        this.zyftyToken.setMinter(this.escrow.address);

        // Create two assets, one for selling one for liens
        this.token = await TOKEN_FACTORY.deploy(this.buyer1.address, this.buyer2.address, this.buyer3.address, this.tokenBalance);

        this.buyer1Conn = this.escrow.connect(this.buyer1);
        this.buyer2Conn = this.escrow.connect(this.buyer2);
        this.buyer3Conn = this.escrow.connect(this.buyer3);

        let totalCost = this.pricePer * this.tokens

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
            "I agree to the terms and conditions",
        );
        this.startTimeStamp = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp;
    });

    createHash = async (escrow, user, id) => {
        const hash = await escrow.connect(user).createAgreementHash(id, user.address);
        const sig = await user.signMessage(ethers.utils.arrayify(hash))
        return sig;
    }

    it("Executes and mints proper contracts", async function() {
        let sig = await createHash(this.escrow, this.buyer1, this.id);

        let pricePaid = 3 * this.tokens / 4 * this.pricePer;
        await this.buyer1Conn.buyToken(this.id, 3 * this.tokens / 4, sig);
        expect(await this.token.balanceOf(this.buyer1.address)).to.equal(this.tokenBalance - pricePaid);

        await expect(this.buyer1Conn.execute(this.id)).to.be.revertedWith('Not all tokens purchased');
        sig = await createHash(this.escrow, this.buyer2, this.id);
        await this.buyer2Conn.buyToken(this.id, this.tokens / 4, sig);
        await this.buyer1Conn.execute(this.id)

        const tokenId = this.escrow.tokenId(this.id);
        expect(await this.zyftyToken.balanceOf(this.buyer1.address, tokenId)).to.equal(3 * this.tokens / 4);
        expect(await this.zyftyToken.balanceOf(this.buyer2.address, tokenId)).to.equal(this.tokens / 4);
    });

    it("Disallows non KYCd tokens unless they get KYcd", async function() {

        let sig = await createHash(this.escrow, this.buyer3, this.id);

        // Buy half
        await expect(this.buyer3Conn.buyToken(this.id, this.tokens / 2, sig))
            .to.be.revertedWith("Access denied, not KYC verified");

        await this.kycConnection.mint(this.buyer3.address)

        // Should now work
        await this.buyer3Conn.buyToken(this.id, this.tokens / 2, sig)

        // Should now be broken again (revoke twice to test for revoking the valid token)
        await this.kycConnection.revoke(this.buyer3.address)
        await this.kycConnection.mint(this.buyer3.address)
        await this.kycConnection.revoke(this.buyer3.address)

        await expect(this.buyer3Conn.buyToken(this.id, this.tokens / 2, sig))
            .to.be.revertedWith("Access denied, not KYC verified");
    });

    it("Disallows incorrect signatures", async function() {

        let sig = await createHash(this.escrow, this.buyer3, this.id);
        // Buy half
        await expect(this.buyer2Conn.buyToken(this.id, this.tokens / 2, sig))
            .to.be.revertedWith("ZyftyTokenFactory: Incorrect Agreement Signature");

        sig = await createHash(this.escrow, this.buyer2, this.id);
        // Should now work
        await this.buyer2Conn.buyToken(this.id, this.tokens / 2, sig)
    });

    it("Allows the user to revert the transaction", async function() {
        let sig = await createHash(this.escrow, this.buyer1, this.id);

        // Buy half
        await this.buyer1Conn.buyToken(this.id, this.tokens / 2, sig);
        await expect(this.buyer1Conn.revert(this.id))
            .to.be.revertedWith("Window is still open");
        await sleep(this.time * 1000 + 1000);

        await this.buyer1Conn.revert(this.id);
        expect(await this.token.balanceOf(this.buyer1.address)).to.equal(this.tokenBalance);

        await expect(this.buyer1Conn.revert(this.id))
            .to.be.revertedWith("No tokens purchased");
    });

    it("Disables token transfer to non aproved KYC contracts", async function() {

        let sig = await createHash(this.escrow, this.buyer1, this.id);
        await this.buyer1Conn.buyToken(this.id, 3 * this.tokens / 4, sig);

        sig = await createHash(this.escrow, this.buyer2, this.id);
        await this.buyer2Conn.buyToken(this.id, this.tokens / 4, sig);

        await this.buyer1Conn.execute(this.id)

        const tokenId = this.escrow.tokenId(this.id);

        const tokenConn = this.zyftyToken.connect(this.buyer1);
        tokenConn.setApprovalForAll(this.buyer2.address, true);
        await expect(tokenConn.safeTransferFrom(this.buyer1.address, this.buyer2.address, tokenId, this.tokens/4, ethers.utils.formatBytes32String(""))).to.be.revertedWith("Token must be passed through Sales Contract");
    });

});

