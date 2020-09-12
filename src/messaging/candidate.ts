import { EthNet } from "../network/webthree/ethnet";
import CToken from "../network/webthree/compound/ctoken";

const Message = require("./message");

export default class Candidate extends Message {
  constructor(data) {
    super();

    this.address = data.address;
    this.ctokenidpay = data.ctokenidpay;
    this.ctokenidseize = data.ctokenidseize;
    this.profitability = data.profitability;

    if (this.address.length === 40) this.address = "0x" + this.address;

    this._markets = "markets" in data ? data.markets : null;
  }

  get label() {
    return this.address.slice(0, 6);
  }

  msg() {
    super.__data = {
      address: this.address,
      ctokenidpay: this.ctokenidpay,
      ctokenidseize: this.ctokenidseize,
      profitability: this.profitability,
      markets: this._markets
    };
    return this;
  }

  async refreshBalances(web3, comptroller, tokennet: EthNet) {
    let markets = [];

    const addrs = await comptroller.marketsEnteredBy(this.address)(web3);
    for (let addr of addrs) {
      const token = CToken.forSymbol(addr).forNet(tokennet);
      markets.push({
        address: addr,
        borrow_uUnits: Number(await token.uUnitsBorrowedBy(this.address)(web3)),
        supply_uUnits: Number(await token.uUnitsSuppliedBy(this.address)(web3)),
        collat: Number(await comptroller.collateralFactorFor(token)(web3))
      });
    }

    this._markets = markets;
  }

  liquidityOffChain(oracle) {
    if (this._markets === null) return {};

    let borrow = 0;
    let supply = 0;

    for (let market of this._markets) {
      const costInUSD = oracle.getPrice(market.address.toLowerCase());
      if (costInUSD === null) return 0;

      borrow += market.borrow_uUnits * costInUSD;
      supply += market.supply_uUnits * costInUSD * market.collat;
    }

    // TODO: Note that this is in USD from the Coinbase reporter oracle,
    // but values from Compound's CToken endpoint are still in ETH. Just
    // be careful until this is documented
    return {
      liquidity: supply - borrow,
      health: supply / borrow
    };
  }

  isLiquidatableWithPriceFrom(oracle) {
    // @ts-ignore
    return this.liquidityOffChain(oracle).liquidity < 0.0;
  }

  liquidityOnChain(web3, comptroller) {
    // TODO: Note that this will probably be in USD now that the
    // oracle has been updated
    return comptroller.accountLiquidityOf(this.address)(web3);
  }

  async isLiquidatable(web3, comptroller) {
    const liquidity = await this.liquidityOnChain(web3, comptroller);
    return liquidity !== null && liquidity[1].gt(0.0);
  }
}