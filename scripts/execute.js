
async function main() {
    let [seller, buyer, lien1P, zyftyAdmin] = await ethers.getSigners();
    const escrowAddress = "0x9d52f426372282C9023414398D7E97aA499E0FD7"

    const id = 1;


    const ESCROW_FACTORY = await ethers.getContractFactory("TokenFactory");

    const escrow = ESCROW_FACTORY.attach(escrowAddress);

    let r = await escrow.connect(seller).getProperty(1);
    console.log("should be all finished");
    console.log("should be all finished", r);
}

main().then(() => process.exit(0)).catch(error => {
    console.error(error);
    process.exit(1);
});
