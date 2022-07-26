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


// describe("VerifySignature", function () {
//   it("Check signature", async function () {
//     const accounts = await ethers.getSigners(2)

//     const blockNumber = await ethers.provider.getBlockNumber();
//     const ethParams = calcEthereumTransactionParams({
//         gasLimit: '21000010',
//         validUntil: (blockNumber + 100000).toString(),
//         storageLimit: '640010',
//         txFeePerGas,
//         storageByteDeposit
//     });

//     const ESCROW_FACTORY = await ethers.getContractFactory("ZyftySalesContract")
//     let contract
//     if (hre.network.name == "mandala") {
//         contract = await ESCROW_FACTORY.deploy(accounts[1].address, {
//                 gasPrice: ethParams.txGasPrice,
//                 gasLimit: ethParams.txGasLimit,
//                 });
//     } else {
//         contract = await ESCROW_FACTORY.deploy(accounts[1].address);
//     }
//     await contract.deployed()

//     // const PRIV_KEY = "0x..."
//     // const signer = new ethers.Wallet(PRIV_KEY)
//     const signer = accounts[0]

//     let name = "bc99422d9e0abdd8ab52ce43a39333e401a87a9afa547572ea407e5699240479" // keccak-256("John")
//     let nft_lease_hash = "36477c30b09e7a21f574222006ba0a2dde4aeef24f036bba439dc1494444a4d1" // keccak-256("This is the nft lease hashed")

//     const hash = await contract.getMessageHash(signer.address, name, nft_lease_hash)
//     const sig = await signer.signMessage(ethers.utils.arrayify(hash))

//     const ethHash = await contract.getEthSignedMessageHash(hash)

//     console.log("signer          ", signer.address)
//     console.log("recovered signer", await contract.recoverSigner(ethHash, sig))

//     // Correct signature and message returns true
//     expect(
//       await contract.verify(signer.address, name, sig)
//     ).to.equal(true)

//     // Incorrect message returns false
//     expect(
//       await contract.verify(signer.address, to, amount + 1, message, nonce, sig)
//     ).to.equal(false)
//   })
// })

// Tests should be ran on localhost test network
// Run command `npx hardhat test --network localhost` to test this code
describe("ZyftySalesContract", function () {

    // Define constants, that could be redefined in other tests
    before(async function() {
        this.tokenBalance = 300;
        this.time = 5;
        if (hre.network.name == "mandala" || hre.network.name == "matic") {
            this.time = 60;
        }
        this.price = 200;
        this.id = 1;
        this.LIEN_FACTORY = await hre.ethers.getContractFactory("Lien");
        this.lienVal = 0;

        [this.seller, this.buyer, this.lien1P, this.zyftyAdmin] = await ethers.getSigners();
    });

    beforeEach(async function() { 
        const ESCROW_FACTORY = await ethers.getContractFactory("ZyftySalesContract");
        const TOKEN_FACTORY = await ethers.getContractFactory("TestToken");
        const NFT_FACTORY = await hre.ethers.getContractFactory("ZyftyNFT");

        const blockNumber = await ethers.provider.getBlockNumber();
        const ethParams = calcEthereumTransactionParams({
            gasLimit: '21000010',
            validUntil: (blockNumber + 100000).toString(),
            storageLimit: '640010',
            txFeePerGas,
            storageByteDeposit
        });

        if (hre.network.name == "mandala") {
            this.escrow = await ESCROW_FACTORY.deploy(this.zyftyAdmin.address, {
                    gasPrice: ethParams.txGasPrice,
                    gasLimit: ethParams.txGasLimit,
                    });
            this.nft = await NFT_FACTORY.deploy(this.escrow.address, {
                    gasPrice: ethParams.txGasPrice,
                    gasLimit: ethParams.txGasLimit,
                    });
            this.token = await TOKEN_FACTORY.deploy(this.seller.address, this.buyer.address, this.lien1P.address, this.tokenBalance, {
                    gasPrice: ethParams.txGasPrice,
                    gasLimit: ethParams.txGasLimit,
                    });

            this.lien = await this.LIEN_FACTORY.deploy(this.lien1P.address, this.lienVal, this.token.address, {
                    gasPrice: ethParams.txGasPrice,
                    gasLimit: ethParams.txGasLimit,
                    })
        } else {
            this.escrow = await ESCROW_FACTORY.deploy(this.zyftyAdmin.address);
            this.nft = await NFT_FACTORY.deploy(this.escrow.address);
            this.token = await TOKEN_FACTORY.deploy(this.seller.address, this.buyer.address, this.lien1P.address, this.tokenBalance);
            this.lien = await this.LIEN_FACTORY.deploy(this.lien1P.address, this.lienVal, this.token.address);
        }

        metadataURI = "cid/test.json";

        let r = await this.nft.connect(this.seller).mint(
            this.seller.address,
            metadataURI,
            this.lien.address,
            "lease-hash"
        );

        await r.wait()

        r = await this.nft.connect(this.seller).approve(this.escrow.address, this.id);
        await r.wait()

        this.buyerConn = this.escrow.connect(this.buyer);
        this.sellerConn = this.escrow.connect(this.seller);

        r = await this.sellerConn.sellProperty(
            this.nft.address, 
            this.id,  // tokenID
            this.price,  // price
            this.time, //time
        );
        await r.wait()

        r = await this.token.connect(this.buyer).approve(this.escrow.address, this.price);
        await r.wait()
    });

    // it("Executes escrow succesfully", async function() {
    //     expect(await this.nft.ownerOf(this.id)).to.equal(this.escrow.address);
    //     expect(await this.nft.balanceOf(this.buyer.address)).to.equal(0);

    //     expect(await this.token.balanceOf(this.buyer.address)).to.equal(this.tokenBalance);
    //     console.log("Buying property");
    //     let r = await this.buyerConn.buyProperty(this.id);
    //     await r.wait()
    //     console.log("Bought");
    //     // expect(await this.token.balanceOf(this.escrow.address)).to.equal(this.price);

    //     // expect(await this.nft.ownerOf(this.id)).to.equal(this.escrow.address);
    //     r = await this.sellerConn.execute(this.id);
    //     await r.wait()
    //     console.log("Executed");

    //     const fee = this.price/200;
    //     expect(await this.token.balanceOf(this.seller.address)).to.equal(this.price - fee + this.tokenBalance);
    //     expect(await this.token.balanceOf(this.buyer.address)).to.equal(this.tokenBalance - this.price);

    //     expect(await this.nft.balanceOf(this.seller.address)).to.equal(0);
    //     expect(await this.nft.balanceOf(this.buyer.address)).to.equal(1);
    // });

    it("Reverts seller escrow", async function() {
        await expect(this.sellerConn.revertSeller(this.id)).to.be.reverted;
        await sleep((this.time*2)*1000); // Wait for timeout
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
        let r = await this.buyerConn.buyProperty(this.id);
        await r.wait();
        // expect(await this.token.balanceOf(this.buyer.address)).to.equal(this.tokenBalance - this.price);
        await expect(this.buyerConn.revertBuyer(this.id)).to.be.revertedWith("Window is still open");
        await sleep((this.time*2)*1000);
        // Ensure this fails
        await expect(this.sellerConn.revertBuyer(this.id)).to.be.reverted;
        r = await this.buyerConn.revertBuyer(this.id);
        await r.wait()
        expect(await this.token.balanceOf(this.buyer.address)).to.equal(this.tokenBalance);

        const p = await this.escrow.getProperty(this.id);
        expect(p.state).to.equal(3); // 3 == CANCLED

        this.lienVal = 30; // For next test increase the lien value to a non zero number
    });

    // it("Pays off primary lien account on Transfer", async function() {
    //     let r = await this.buyerConn.buyProperty(this.id)
    //     await r.wait()

    //     r = await this.sellerConn.execute(this.id);
    //     await r.wait()

    //     const fee = this.price/200;
    //     expect(await this.token.balanceOf(this.seller.address)).to.equal(this.price - fee - this.lienVal + this.tokenBalance);
    //     expect(await this.token.balanceOf(this.buyer.address)).to.equal(this.tokenBalance - this.price);

    //     this.lienVal = this.price; // For the next testcase
    // });

    // it("Reverts execute when proceeds don't cover lien payments", async function() {
    //     let r = await this.buyerConn.buyProperty(this.id)
    //     await r.wait();
    //     await expect(this.sellerConn.execute(this.id)).to.be.reverted;
    // });

    // False hash

});

