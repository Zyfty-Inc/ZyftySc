const hre = require("hardhat");

async function main() {
    let [seller, buyer1, buyer2, zyftyAdmin] = await ethers.getSigners();

    console.log(seller.address);
    console.log(buyer1.address);
    console.log(buyer2.address);
    
    const TOKEN_FACTORY = await ethers.getContractFactory("TestToken");
    const KYC_FACTORY = await ethers.getContractFactory("ZyftyKYC")
    const ESCROW_FACTORY = await ethers.getContractFactory("TokenFactory");
    // Make all smart contracts
    let tokenBalance = 300;
    let token = await TOKEN_FACTORY.deploy(seller.address, buyer1.address, buyer2.address, tokenBalance);
    let kyc = await KYC_FACTORY.deploy(zyftyAdmin.address, "ZyftyKYC", "ZKYC");

    let escrow = await ESCROW_FACTORY.deploy(kyc.address);

    const tokens = 500;
    let pricesPer = [5, 10, 15, 10]
    // 2 days
    const time = 172800;
    for (let i = 1; i < 5; i++) {
        await escrow.listProperty(
            seller.address,
            token.address,
            tokens,
            pricesPer[i-1],
            time, //time
        );
    }

    console.log(`tokenAddress: "${token.address}",`);
    console.log(`escrowAddress: "${escrow.address}",`);
    console.log(`kycAddress: "${kyc.address}"`);

    await token.connect(buyer1).approve(escrow.address, tokenBalance);
    await token.connect(buyer2).approve(escrow.address, tokenBalance);
    console.log("Minted");
}

main().then(() => process.exit(0)).catch(error => {
    console.error(error);
    process.exit(1);
});
