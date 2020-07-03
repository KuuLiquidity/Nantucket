const assert = require("assert");

const EthAccount = require("../../../src/network/webthree/ethaccount");

describe("Ethereum Account Test", () => {
  it("should retrieve highest confirmed nonce", () => {
    return EthAccount.getHighestConfirmedNonce().then(result => {
      assert(result > 90);
    });
  });
});