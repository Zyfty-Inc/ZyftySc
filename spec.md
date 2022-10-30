# Zyfty Techinal Specification

Zyfty is a solution that provides property ownership in the form of long-term leases as NFTs.

## NFT

Most NFTs hold only their value in their selling price and do not hold any
debt.  Many properties, however, have some liabilities associated with them
over the life of the property, and this is the purpose of having liens built
into the Zyfty NFTs.

### NFT Transfer Fee

The Zyfty NFT will direct a transfer fee of 0.5% of the proceeds of every sale to Zyfty.

### Reimbursement Account

The Zyfty Lease Agreement will call for the NFT Owner to put required recurring
fees into the NFT as those fees occur and are paid by Zyfty. These fees include
property taxes, Homeowners Association Fees and other fees specific to each
property.  The fees must be paid by the NFT Owner into the Reimbursement
Account per the schedule in the Lease Agreement.  The NFT Owner has complete
control of the Reimbursement Account.  Zyfty will draw down from the
Reimbursement Account at its discretion to pays fees on behalf of the NFT Owner
to collect reimbursement for the fees paid.  Any fees not placed into the
Reimbursement Account by the NFT Owner as required will accrue to the Primary
Lien and will bear interest as defined in the Lease Agreement.  

#### Liens

A property has a single primary lien.

This lien is the ”Primary Lien”. The Primary Lien can never be
removed and will be an amount equal to the fees that were owed but not put into
the Reimbursement Account by the NFT Owner as required by the lease. If no fees
are owed by the NFT Owner the Primary Lien value will be zero. 

##### Lien Interface

A Lien is a secondary contract that can be sub-typed by a third party. We
created [Lien](contracts/Lien/Lien.sol) for static liens and
[ParametricLien](contracts/Lien/ParametricLien.sol) for Liens that increase
value based on time.

The primary Lien is a ParametricLien

```sol
interface ILien {

    /**
     * @dev Initializes the Lien contract
     */
    function initialize() external;

    /**
     * @dev Returns the main Lien Provider of this Lien
     */
    function lienProvider() external view returns(address);

    /**
     * @dev Sets `lienProvider()` to `newLienProvider`
     */
    function setLienProvider(address newLienProvider) external;

    /**
     * @dev Pays `amount` tokens of the default asset to the `lienProvider()`
     */
    function pay(uint256 amount) external returns(uint256);

    /**
     * @dev Updates the `balance()` of the lien, this is called
     *      to update temporal logic or any other purposes that
     *      are static. Update uses increaseLien() and decreaseLien()
     *      to change the value.
     */
    function update() external;

    /**
     * @dev Returns the asset type of the Lien
     */
    function asset() external view returns(address);

    /**
     * @dev Returns the current amount of debt that is in the lien,
     *      before the balance is returned it additionally calls update()
     *      on the contract
     */
    function balance() external returns(uint256);

    /**
     * @dev Returns the current amount of debt that is in the lien,
     *      WARNING, this is not ensured to be up to date, unless an
     *      `update()` is called before. The value is typically lower
     *      than reality.
     */
    function balanceView() external view returns(uint256);

}
```

#### Lien Creation

The Primary Lien is created by Zyfty with a value of zero when the NFT is
created.  If the NFT Owner does not make timely fee payments per the terms of
the Lease Agreement the Primary Lien is increased by Zyfty to equal the value
of the overdue fee payments plus accrued interest as defined in the Lease
Agreement.  These increases occur at Zyfty’s discretion or upon interaction
with a Sales Contract.

##### Paying Liens

The NFT Owner can pay off the Primary Lien by placing the full amount of the
Primary Lien in the Reimbursement Account.  After Zyfty draws down the value of
any payments made on the NFT Owner’s behalf plus any accrued interest, it will
set the lien value to zero.

##### Destroying an NFT

Under specific circumstances when the NFT Owner has breached the terms of the
Lease Agreement, or when the NFT Owner wishes to return its NFT to Zyfty and
take traditional ownership of the property per the terms of the Lease
Agreement, or if the NFT has been lost and the NFT Owner had registered their
personal information with Zyfty and requests replacement, Zyfty will reclaim
and destroy the NFT.

### NFT functions

```
    /**
     *
     */
    increaseReserve(uint256 tokenID)
    
    /**
     * @dev Fetches the current number of ERC20 tokens in i
     *      the reserve account in `asset()`
     */
    getReserve(uint256 tokenID, uint256 value) 
    
    /**
     * Adds `value` funds to the reserve account 
     */
    redeemReserve(uint256 tokenID, uint256 value) 

    /**
     *
     */
    getLien(uint256 tokenID)

    /**
     * @dev Pays the `amount` funds in ERC20 token `asset()` from 
     *      from the current funds in the reserve account.
     */
    payLien(uint256 tokenID, uint256 amount) returns(uint256)


    /**
     * @dev Creates an agreement hash for tokenID, with address addr
     */
    function createAgreementHash(uint256 tokenId, address addr)
```


## Sales Contract

The Sales Contract works as a basic, time-locked type contract.  Over time
there will be an approved list of valid sales contracts controlled by the NFT
creator (Zyfty).  The only way the NFT can be transferred is through an
approved Sales Contract.

### Selling a Property

The NFT Owner or the marketplace selling the NFT places the NFT and the
seller’s terms of sale “into” the Sales Contract (via sellProperty).  The terms
of sale include the sales price, the non-refundable deposit amount (if any),
the refundable deposit amount (if any), the buyer’s requirement to agree to all
the terms of the Lease Agreement and the time allotted for closing. The NFT
sales price must be enough to pay the 0.5% NFT Transfer Fee to Zyfty, to clear
all lien amounts and to pay the gas fee for the transaction, or the property
cannot be sold.

### Buying

The NFT buyer or the marketplace selling the NFT places the buyer’s deposit and
the buyer’s terms of sale “into” the Sales Contract (via buyProperty).  The
terms of sale will include any required property walk-thrus, inspections,
repairs, etc. Buying also requires the owner to pass in a signed message agreeing
to the terms of the house. This is found in nft.createAgreementHash(tokenID, buyerAddress).

### Executing

As soon as all of the terms of sale are met, the Sales Contract can be executed
by the buyer or the seller.  Upon execution the Sales Contract pulls the full
amount of the sales price, less any deposits already posted, from the buyer and
uses those funds to pay the 0.5% NFT Transfer Fee to Zyfty, to pay all lien
amounts, to pay the gas fees and to pay the remaining proceeds of the sale to
the NFT Owner.  It then moves the NFT to the buyer.  If the buyer does not have
the required funds available to pay the sales price less any prior deposits
when the sales contract executes, the Sales Contract fails.  If all terms of
sale are not met prior to the time allotted for closing, the Sale Contract is
terminated. Upon termination the NFT is returned to the NFT Owner and any
refundable deposits are returned to the buyer. 

### Sales Contract function
```
listProperty(address nftContract, uint256 tokenId, address asset, uint256 price, uint256 time) returns(uint256)
listPropertyBuyer(address nftContract, uint256 tokenId, address asset, uint256 price, uint256 time, address buyer) returns(uint256)
buyProperty(uint256 listingId, bytes agreement_signature) 
execute(uint256 listingId)
revertBuyer(uint256 listingId)
revertSeller(uint256 listingId)
```
