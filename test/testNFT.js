const { expect } = require("chai");
const { ethers } = require("hardhat");
const hre = require('hardhat');
const { calcEthereumTransactionParams } = require("@acala-network/eth-providers")

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

const txFeePerGas = '199999946752';
const storageByteDeposit = '100000000000000';

// Tests should be ran on localhost test network
// Run command `npx hardhat test --network localhost` to test this code
describe("RealEstateNFT", function () {

    before(async function() { 

        [this.owner, this.lien1P, this.ot, this.escrow, this.zyftyAdmin] = await ethers.getSigners();

        const TOKEN_FACTORY = await ethers.getContractFactory("TestToken");
        const NFT_FACTORY = await hre.ethers.getContractFactory("ZyftyNFT", {
            signer: this.zyftyAdmin
        });
        this.LIEN_FACTORY = await hre.ethers.getContractFactory("Lien");

        this.tokenBalance = 50;
        this.id = 1;
        this.idOther = 2;
        this.lien1Val = 10;
        this.otherLienValue = 5;

        this.nft = await NFT_FACTORY.deploy(this.escrow.address);

        this.token = await TOKEN_FACTORY.deploy(this.owner.address, this.lien1P.address, this.ot.address, this.tokenBalance);

        this.lien1 = await this.LIEN_FACTORY.deploy(this.lien1P.address, this.lien1Val, this.token.address)
        this.lien2 = await this.LIEN_FACTORY.deploy(this.lien1P.address, this.lien1Val, this.token.address)

        let metadataURI = "cid/test.json";

        await this.nft.mint(
            this.owner.address,
            metadataURI,
            this.lien1.address,
            "lease-hash",
            "This user agrees to the conitions"
        );

        await this.nft.mint(
            this.owner.address,
            metadataURI,
            this.lien2.address,
            "lease-hash",
            "This user agrees to the conitions"
        );

        this.p1Conn = this.nft.connect(this.lien1P);
        this.ownerConn = this.nft.connect(this.owner);

        // Lets not worry about token allowances
        await this.token.connect(this.owner).approve(this.nft.address, this.tokenBalance*2);
    });

    it("Expects primary lien to exist", async function() {
        expect(await this.ownerConn.lien(this.id)).to.equal(this.lien1.address);
    });

    it("Tests changing primary liens", async function() {
        expect(await this.ownerConn.lien(this.id)).to.equal(this.lien1.address);

        let lien3 = await this.LIEN_FACTORY.deploy(this.lien1P.address, 30, this.token.address)
        await this.p1Conn.proposeLienUpdate(this.id, lien3.address);
        await expect(this.ownerConn.acceptLienUpdate(this.id, this.lien1.address)).to.be.revertedWith("Lien address accepted is not the one proposed");
        await this.ownerConn.acceptLienUpdate(this.id, lien3.address);

        expect(await this.nft.lien(this.id)).to.equal(lien3.address);

        await expect(this.ownerConn.acceptLienUpdate(this.id, lien3.address)).to.be.revertedWith("No lien proposed");

        // Change back over
        await this.p1Conn.proposeLienUpdate(this.id, this.lien1.address);
        this.ownerConn.acceptLienUpdate(this.id, this.lien1.address)

    });

    it("Increases the reseves", async function() {
        const amount = 20;
        // Add tokens into the main NFT
        await this.ownerConn.increaseReserve(this.id, amount);
        // Add tokens into the other NFT
        await this.ownerConn.increaseReserve(this.idOther, amount);

        expect(await this.ownerConn.getReserve(this.id)).to.equal(amount);
        expect(await this.token.balanceOf(this.owner.address)).to.equal(this.tokenBalance - amount*2);
    });

    it("Redeems from the reserves", async function() {
        const amount = 20;
        expect(await this.ownerConn.getReserve(this.id)).to.equal(amount);
        await this.ownerConn.redeemReserve(this.id, amount/2);
        expect(await this.ownerConn.getReserve(this.id)).to.equal(amount/2);

        // Ensure the tokens got transfered to the owner
        expect(await this.token.balanceOf(this.owner.address)).to.equal(this.tokenBalance - (amount/2 + amount));

        // Only the owner can redeem from reserves
        await expect(this.p1Conn.redeemReserve(this.id, amount/2)).to.be.reverted;

        // Does not overdraft
        expect(await this.token.balanceOf(this.nft.address)).to.equal(amount + amount/2);
        await this.ownerConn.redeemReserve(this.id, amount);
        expect(await this.ownerConn.getReserve(this.id)).to.equal(0);

        expect(await this.token.balanceOf(this.owner.address)).to.equal(this.tokenBalance - amount);

        await this.ownerConn.redeemReserve(this.idOther, amount);
        expect(await this.token.balanceOf(this.owner.address)).to.equal(this.tokenBalance);
    });


    it("Pays assets off with reserves", async function() {
        // Have 1 lien to pay with value 10
        const amountToPay = 10;
        await this.ownerConn.increaseReserve(this.id, amountToPay);

        // Pay of secondry lien that has value 5, pays the full amount
        await this.ownerConn.payLienFull(this.id, );

        const l = this.LIEN_FACTORY.attach(this.ownerConn.lien(this.id));
        expect(await l.balanceView()).to.equal(0);
        expect(await this.ownerConn.getReserve(this.id)).to.equal(0);
    });

    it("Disallows non escrow contracts to transfer", async function() {
        await expect(this.nft.connect(this.owner).transferFrom(this.owner.address, this.ot.address, this.idOther))
                        .to.be.revertedWith("Token must be passed through Sales Contract");
    });

    it("Allow to transfer to escrow", async function() {
        await this.nft.connect(this.owner).transferFrom(this.owner.address, this.escrow.address, this.idOther)
        expect(await this.nft.ownerOf(this.idOther)).to.equal(this.escrow.address);
    })

    it("Update allowed escrow", async function(){
        await this.nft.updateEscrow(this.ot.address);
        await this.nft.connect(this.owner).transferFrom(this.owner.address, this.ot.address, this.id);
        expect(await this.nft.ownerOf(this.id)).to.equal(this.ot.address);
    })

    it("Destroys NFTs", async function() {
        await this.nft.connect(this.zyftyAdmin).destroyNFT(this.id);
        await expect(this.ownerConn.lien(this.id)).to.be.reverted;
    });
});
