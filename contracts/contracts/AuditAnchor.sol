// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title AuditAnchor
/// @notice Records 32-byte fingerprints of Privexa audit events as integrity evidence.
/// @dev Stores only hashes. Never submit names, identifiers, clinical data, tokens or request bodies.
///      This contract is evidence of integrity; it is not used for authorization.
contract AuditAnchor {
    struct Anchor {
        uint64 blockNumber;
        uint64 timestamp;
    }

    address public immutable owner;
    mapping(bytes32 => Anchor) private anchors;
    uint256 public anchorCount;

    event Anchored(bytes32 indexed fingerprint, uint256 blockNumber, uint256 timestamp);

    error NotAuthorized();
    error InvalidFingerprint();
    error AlreadyAnchored(bytes32 fingerprint);

    constructor() {
        owner = msg.sender;
    }

    /// @notice Anchor a fingerprint. Only the deploying Privexa service account may anchor.
    function anchor(bytes32 fingerprint) external {
        if (msg.sender != owner) revert NotAuthorized();
        if (fingerprint == bytes32(0)) revert InvalidFingerprint();
        if (anchors[fingerprint].blockNumber != 0) revert AlreadyAnchored(fingerprint);
        anchors[fingerprint] = Anchor(uint64(block.number), uint64(block.timestamp));
        unchecked {
            anchorCount++;
        }
        emit Anchored(fingerprint, block.number, block.timestamp);
    }

    /// @notice Check whether a fingerprint has been anchored, and when.
    function isAnchored(bytes32 fingerprint) external view returns (bool anchored, uint256 blockNumber, uint256 timestamp) {
        Anchor memory a = anchors[fingerprint];
        return (a.blockNumber != 0, a.blockNumber, a.timestamp);
    }
}
