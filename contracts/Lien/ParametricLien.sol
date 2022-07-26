pragma solidity ^0.8.1;

import "contracts/Lien/Lien.sol";

contract ParametricLien is Lien {

    uint256 lastUpdated;
    uint256 valuePer;
    uint256 period;
    uint256 public start;

    constructor(address lienProvider,
                address assetType,
                uint256 startTime,
                uint256 initialValue,
                uint256 valuePerPeriod,
                uint256 _period) Lien(lienProvider, initialValue, assetType) { 

        start = startTime;
        if (start == 0) {
            start = block.timestamp;
        }
        lastUpdated = block.timestamp;
        valuePer = valuePerPeriod;
        period = _period;
    }

    /**
     * @dev Initializes the Lien contract
     */
    function initialize() public virtual override {
        start = block.timestamp;
        lastUpdated = block.timestamp;
    }

    function update() public virtual override {
        // Finds the total number of periods since the  start date
        uint256 totalPeriods = (block.timestamp - start) / period;

        // Finds the total number of periods that have already been added
        uint256 updatedPeriods = (lastUpdated - start) / period;
        increaseLien((totalPeriods - updatedPeriods)*valuePer);
        lastUpdated = block.timestamp;
    }

}
