
const hre = require("hardhat");

async function main() {
    let [seller, buyer, lien1P, zyftyAdmin] = await ethers.getSigners();
    const ESCROW_FACTORY = await ethers.getContractFactory("ZyftySalesContract")

    let escrow = await ESCROW_FACTORY.attach(escro);

}

main().then(() => process.exit(0)).catch(error => {
    console.error(error);
    process.exit(1);
});
