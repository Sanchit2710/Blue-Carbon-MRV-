// The parts of BlueCarbonRegistry (contracts/contracts/BlueCarbonRegistry.sol) the app calls.
export const registryAbi = [
  "function VERIFIER_ROLE() view returns (bytes32)",
  "function hasRole(bytes32 role, address account) view returns (bool)",
  "function projectOwner(bytes32 projectId) view returns (address)",
  "function batchIdOf(bytes32 projectId, uint64 periodStart, uint64 periodEnd) pure returns (uint256)",
  "function registerProject(bytes32 projectId, address owner)",
  "function issueBatch(bytes32 projectId, uint64 periodStart, uint64 periodEnd, string methodology, string verificationRef, uint256 quantity) returns (uint256)",
  "function balanceOf(address account, uint256 id) view returns (uint256)",
  "function isApprovedForAll(address account, address operator) view returns (bool)",
  "function setApprovalForAll(address operator, bool approved)",
  "function retire(uint256 batchId, uint256 quantity, address beneficiary, string reason)",
  "event ProjectRegistered(bytes32 indexed projectId, address indexed owner)",
  "event CreditsRetired(uint256 indexed batchId, address indexed holder, address indexed beneficiary, uint256 quantity, string reason)",
  "event BatchIssued(uint256 indexed batchId, bytes32 indexed projectId, uint64 periodStart, uint64 periodEnd, string methodology, string verificationRef, uint256 quantity, address indexed to)",
] as const;

// contracts/contracts/BlueCarbonMarketplace.sol
export const marketAbi = [
  "function listings(uint256 listingId) view returns (address seller, uint256 batchId, uint256 remaining, uint256 pricePerUnit)",
  "function list(uint256 batchId, uint256 quantity, uint256 pricePerUnit) returns (uint256)",
  "function cancel(uint256 listingId)",
  "function buy(uint256 listingId, uint256 quantity) payable",
  "event Listed(uint256 indexed listingId, address indexed seller, uint256 indexed batchId, uint256 quantity, uint256 pricePerUnit)",
  "event Cancelled(uint256 indexed listingId)",
  "event Purchased(uint256 indexed listingId, address indexed buyer, address indexed seller, uint256 batchId, uint256 quantity, uint256 paid)",
] as const;
