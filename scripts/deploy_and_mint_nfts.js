const hre = require("hardhat");

async function main() {
    let [seller, buyer, lien1P, zyftyAdmin] = await ethers.getSigners();

    const ESCROW_FACTORY = await ethers.getContractFactory("ZyftySalesContract",{
        signer: zyftyAdmin,
    });
    const TOKEN_FACTORY = await ethers.getContractFactory("TestToken");
    const NFT_FACTORY = await hre.ethers.getContractFactory("ZyftyNFT");
    const LIEN_FACTORY = await hre.ethers.getContractFactory("Lien");
    console.log(seller.address)
    console.log(zyftyAdmin.address)
    // Make all smart contracts
    let tokenBalance = 300;
    let token = await TOKEN_FACTORY.deploy(seller.address, buyer.address, lien1P.address, tokenBalance);
    let escrow = await ESCROW_FACTORY.deploy();
    let nft = await NFT_FACTORY.deploy(escrow.address);
    // Lien contract won't be used so value will be 0
    let lien = await LIEN_FACTORY.deploy(lien1P.address, 0, token.address);

    console.log(`nftAddress: "${nft.address}",`);
    console.log(`escrowAddress: "${escrow.address}",`);
    console.log(`tokenAddress: "${token.address}",`);
    console.log(`lienAddress: "${lien.address}"`);

    let sellerConn = nft.connect(seller)
    // make 4 properties (1 per house)
    console.log("Minting NFTs");
    for (let i = 0; i < 4; i++) {
        let metadataURI = `cid/test${i + 1}.json`;
        let sigMessage = `The following address agrees to the lease ${i + 1}`
        let leaseHash = `lease-hash${i + 1}`

        let r = await sellerConn.mint(
            seller.address,
            metadataURI,
            lien.address,
            leaseHash,
            sigMessage
        );
        await r.wait()

    }

    // Allow the escrow to transfer all 4 properties
    let r = await sellerConn.setApprovalForAll(escrow.address, true)
    await r.wait()

    // 2 days
    let time = 172800;
    let prices = [100, 150, 200, 300]
    // List all 4 properties
    console.log("Putting properties for escrow");
    for (let i = 1; i < 5; i++) {
        r = await escrow.connect(seller).sellProperty(
            nft.address, 
            i,  // tokenID
            token.address,
            prices[i-1],  // price
            time, //time
        );
        await r.wait();

        await escrow.connect(seller).addBuyer(i, buyer.address);
    }
    await token.connect(buyer).approve(escrow.address, tokenBalance)

    // Should be done check things on chain
    console.log("Contracts deployed, escrows active");
}

main().then(() => process.exit(0)).catch(error => {
    console.error(error);
    process.exit(1);
});
