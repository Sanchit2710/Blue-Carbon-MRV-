// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/// @title BlueCarbonRegistry
/// @notice Project registry, ERC-1155 credit batches (tokenId = batchId), retirement and
///         maintenance milestone records for blue-carbon MRV.
/// @dev An on-chain token is a record, NOT automatically a legally recognised carbon credit.
///      Quantities are integers in hundredths of a tCO2e (mirrors numeric(14,2) off-chain).
contract BlueCarbonRegistry is ERC1155, AccessControl, Pausable {
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");

    enum Outcome { Pass, Fail, Flagged }

    struct Batch {
        bytes32 projectId;
        uint64 periodStart;
        uint64 periodEnd;
        string methodology;
        string verificationRef;
        uint256 issued;
        uint256 retired;
    }

    struct Milestone {
        bytes32 evidenceHash;
        Outcome outcome;
        uint64 recordedAt;
    }

    mapping(bytes32 projectId => address) public projectOwner;
    mapping(uint256 batchId => Batch) private _batches;
    mapping(bytes32 projectId => mapping(uint256 index => Milestone)) public milestones;

    event ProjectRegistered(bytes32 indexed projectId, address indexed owner);
    event BatchIssued(
        uint256 indexed batchId,
        bytes32 indexed projectId,
        uint64 periodStart,
        uint64 periodEnd,
        string methodology,
        string verificationRef,
        uint256 quantity,
        address indexed to
    );
    event CreditsRetired(
        uint256 indexed batchId, address indexed holder, address indexed beneficiary, uint256 quantity, string reason
    );
    event MilestoneRecorded(
        bytes32 indexed projectId, uint256 indexed milestoneIndex, bytes32 evidenceHash, Outcome outcome
    );

    error ZeroProjectId();
    error ZeroAddress();
    error ProjectAlreadyRegistered(bytes32 projectId);
    error ProjectNotRegistered(bytes32 projectId);
    error ZeroQuantity();
    error InvalidPeriod();
    error BatchAlreadyIssued(uint256 batchId);
    error BatchNotFound(uint256 batchId);

    constructor(address admin, string memory baseUri) ERC1155(baseUri) {
        if (admin == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(VERIFIER_ROLE, admin);
    }

    // ---- id derivation (mirror this off-chain) ----

    /// @notice batchId = keccak256(projectId, periodStart, periodEnd); makes the duplicate guard structural.
    function batchIdOf(bytes32 projectId, uint64 periodStart, uint64 periodEnd) public pure returns (uint256) {
        return uint256(keccak256(abi.encode(projectId, periodStart, periodEnd)));
    }

    // ---- verifier actions ----

    function registerProject(bytes32 projectId, address owner) external onlyRole(VERIFIER_ROLE) whenNotPaused {
        if (projectId == bytes32(0)) revert ZeroProjectId();
        if (owner == address(0)) revert ZeroAddress();
        if (projectOwner[projectId] != address(0)) revert ProjectAlreadyRegistered(projectId);
        projectOwner[projectId] = owner;
        emit ProjectRegistered(projectId, owner);
    }

    /// @notice Mint a batch to the project owner.
    function issueBatch(
        bytes32 projectId,
        uint64 periodStart,
        uint64 periodEnd,
        string calldata methodology,
        string calldata verificationRef,
        uint256 quantity
    ) external onlyRole(VERIFIER_ROLE) whenNotPaused returns (uint256 batchId) {
        address owner = projectOwner[projectId];
        if (owner == address(0)) revert ProjectNotRegistered(projectId);
        if (quantity == 0) revert ZeroQuantity();
        if (periodEnd <= periodStart) revert InvalidPeriod();

        batchId = batchIdOf(projectId, periodStart, periodEnd);
        if (_batches[batchId].issued != 0) revert BatchAlreadyIssued(batchId);

        _batches[batchId] = Batch(projectId, periodStart, periodEnd, methodology, verificationRef, quantity, 0);
        _mint(owner, batchId, quantity, "");
        emit BatchIssued(batchId, projectId, periodStart, periodEnd, methodology, verificationRef, quantity, owner);
    }

    function recordMilestone(bytes32 projectId, uint256 milestoneIndex, bytes32 evidenceHash, Outcome outcome)
        external
        onlyRole(VERIFIER_ROLE)
        whenNotPaused
    {
        if (projectOwner[projectId] == address(0)) revert ProjectNotRegistered(projectId);
        // Re-recording an index overwrites the stored value; history lives in events.
        milestones[projectId][milestoneIndex] = Milestone(evidenceHash, outcome, uint64(block.timestamp));
        emit MilestoneRecorded(projectId, milestoneIndex, evidenceHash, outcome);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    // ---- holder actions ----

    /// @notice Burn caller's credits permanently; they can never be transferred again.
    function retire(uint256 batchId, uint256 quantity, address beneficiary, string calldata reason)
        external
        whenNotPaused
    {
        if (_batches[batchId].issued == 0) revert BatchNotFound(batchId);
        if (quantity == 0) revert ZeroQuantity();
        _burn(msg.sender, batchId, quantity); // reverts on insufficient balance
        _batches[batchId].retired += quantity;
        emit CreditsRetired(batchId, msg.sender, beneficiary, quantity, reason);
    }

    // ---- views ----

    function getBatch(uint256 batchId) external view returns (Batch memory) {
        if (_batches[batchId].issued == 0) revert BatchNotFound(batchId);
        return _batches[batchId];
    }

    function retiredTotal(uint256 batchId) external view returns (uint256) {
        return _batches[batchId].retired;
    }

    // ---- overrides ----

    /// @dev Block all transfers/mints/burns while paused.
    function _update(address from, address to, uint256[] memory ids, uint256[] memory values)
        internal
        override
        whenNotPaused
    {
        super._update(from, to, ids, values);
    }

    function supportsInterface(bytes4 id) public view override(ERC1155, AccessControl) returns (bool) {
        return super.supportsInterface(id);
    }
}
