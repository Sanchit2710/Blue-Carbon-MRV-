// Message an NGO signs to prove it controls the wallet credits will be minted to.
// Built identically in the browser (to sign) and on the server (to verify).
export const walletLinkMessage = (address: string, orgId: string, issuedAt: string) =>
  `BlueCarbon: link wallet ${address.toLowerCase()} to organisation ${orgId} for receiving carbon credit records.\nIssued at: ${issuedAt}`;
