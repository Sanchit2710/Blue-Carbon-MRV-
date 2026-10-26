// The parts of BlueCarbonRegistry (contracts/contracts/BlueCarbonRegistry.sol) the app calls.
export const registryAbi = [
  "function VERIFIER_ROLE() view returns (bytes32)",
  "function hasRole(bytes32 role, address account) view returns (bool)",
  "function projectOwner(bytes32 projectId) view returns (address)",
  "function batchIdOf(bytes32 projectId, uint64 periodStart, uint64 periodEnd) pure returns (uint256)",
  "function registerProject(bytes32 projectId, address owner)",
  "function issueBatch(bytes32 projectId, uint64 periodStart, uint64 periodEnd, string methodology, string verificationRef, uint256 quantity) returns (uint256)",
  "event ProjectRegistered(bytes32 indexed projectId, address indexed owner)",
  "event BatchIssued(uint256 indexed batchId, bytes32 indexed projectId, uint64 periodStart, uint64 periodEnd, string methodology, string verificationRef, uint256 quantity, address indexed to)",
] as const;
