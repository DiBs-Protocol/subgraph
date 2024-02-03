import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts"
import { MULTI_ACCOUNT_ADDRESS } from "./config"
import { MultiAccount } from "../generated/SymmDataSource/MultiAccount"

export class Handler {
  private _event: ethereum.Event
  timestamp: BigInt
  day: BigInt

  constructor(event: ethereum.Event) {
    const timestamp = event.block.timestamp
    this.timestamp = timestamp
    this._event = event
    this.day = timestamp.div(BigInt.fromI32(86400))
  }

  public handle(): void {}

  public getQuoteObjectId(quoteId: BigInt): string {
    return this._event.address.toHexString() + quoteId.toString()
  }

  public getOwner(account: Address): Address {
    const multiAccount = MultiAccount.bind(
      Address.fromString(MULTI_ACCOUNT_ADDRESS),
    )
    return multiAccount.owners(account)
  }
}
