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
        this.pricePer = 5;
        this.tokens = 10;
        this.id = 1;
        [this.seller, this.buyer1, this.buyer2, this.buyer3, this.zyftyAdmin] = await ethers.getSigners();
    });


    beforeEach(async function() { 
        // for logging
        const ESCROW_FACTORY = await ethers.getContractFactory("TokenFactory",{
            signer: this.zyftyAdmin, // set the zyftyAdmin as the owner on deploy
        });
        const TOKEN_FACTORY = await ethers.getContractFactory("TestToken");

        let leaseHash = "lease-hash"

        this.escrow = await ESCROW_FACTORY.deploy();
        
        // Create two assets, one for selling one for liens
        this.token = await TOKEN_FACTORY.deploy(this.buyer1.address, this.buyer2.address, this.buyer3.address, this.tokenBalance);

        this.buyer1Conn = this.escrow.connect(this.buyer1);
        this.buyer2Conn = this.escrow.connect(this.buyer2);

        let totalCost = this.pricePer*this.tokens   

        r = await this.token.connect(this.buyer1).approve(this.escrow.address, totalCost);
        r = await this.token.connect(this.buyer2).approve(this.escrow.address, totalCost);
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
        let pricePaid = this.tokens/2*this.pricePer;
        this.buyer1Conn.buyToken(this.id, this.tokens/2);

    });



});

