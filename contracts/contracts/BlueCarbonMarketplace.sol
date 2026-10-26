// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title BlueCarbonMarketplace
/// @notice Fixed-price listings of BlueCarbonRegistry credit batches, settled atomically in ETH.
/// @dev Credits stay in the seller's wallet until a purchase; the marketplace only needs operator approval.
///      Overselling is impossible: each purchase transfers from the seller and reverts if they no longer
///      hold enough (sold elsewhere, transferred or retired). Quantities are hundredths of a tCO2e and
///      pricePerUnit is wei per hundredth.
contract BlueCarbonMarketplace is ReentrancyGuard {
    struct Listing {
        address seller;
        uint256 batchId;
        uint256 remaining;
        uint256 pricePerUnit;
    }

    IERC1155 public immutable registry;
    uint256 public nextListingId = 1;
    mapping(uint256 listingId => Listing) public listings;

    event Listed(uint256 indexed listingId, address indexed seller, uint256 indexed batchId, uint256 quantity, uint256 pricePerUnit);
    event Cancelled(uint256 indexed listingId);
    event Purchased(
        uint256 indexed listingId, address indexed buyer, address indexed seller, uint256 batchId, uint256 quantity, uint256 paid
    );

    error ZeroQuantity();
    error ZeroPrice();
    error NotApproved();
    error InsufficientBalance();
    error NotSeller();
    error NotActive();
    error SelfPurchase();
    error ExceedsListing(uint256 remaining);
    error WrongPayment(uint256 expected);
    error PaymentFailed();

    constructor(IERC1155 registry_) {
        registry = registry_;
    }

    function list(uint256 batchId, uint256 quantity, uint256 pricePerUnit) external returns (uint256 listingId) {
        if (quantity == 0) revert ZeroQuantity();
        if (pricePerUnit == 0) revert ZeroPrice();
        if (!registry.isApprovedForAll(msg.sender, address(this))) revert NotApproved();
        if (registry.balanceOf(msg.sender, batchId) < quantity) revert InsufficientBalance();
        listingId = nextListingId++;
        listings[listingId] = Listing(msg.sender, batchId, quantity, pricePerUnit);
        emit Listed(listingId, msg.sender, batchId, quantity, pricePerUnit);
    }

    function cancel(uint256 listingId) external {
        Listing storage l = listings[listingId];
        if (l.seller != msg.sender) revert NotSeller();
        if (l.remaining == 0) revert NotActive();
        l.remaining = 0;
        emit Cancelled(listingId);
    }

    function buy(uint256 listingId, uint256 quantity) external payable nonReentrant {
        Listing storage l = listings[listingId];
        if (l.remaining == 0) revert NotActive();
        if (quantity == 0) revert ZeroQuantity();
        if (msg.sender == l.seller) revert SelfPurchase();
        if (quantity > l.remaining) revert ExceedsListing(l.remaining);
        uint256 cost = quantity * l.pricePerUnit;
        if (msg.value != cost) revert WrongPayment(cost);

        l.remaining -= quantity; // effects before interactions
        address seller = l.seller;
        uint256 batchId = l.batchId;
        registry.safeTransferFrom(seller, msg.sender, batchId, quantity, "");
        (bool ok,) = seller.call{value: cost}("");
        if (!ok) revert PaymentFailed();
        emit Purchased(listingId, msg.sender, seller, batchId, quantity, cost);
    }
}
