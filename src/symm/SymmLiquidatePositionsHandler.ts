import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts"
import {
  LiquidatePositionsPartyA,
  LiquidatePositionsPartyB,
  v3
} from "../../generated/SymmDataSource/v3"

import {
  EPOCH_START_TIMESTAMP,
  MULTI_ACCOUNT_ADDRESS
} from "../../config/config"
import { Quote } from "../../generated/schema"
import { zero_address } from "../solidly/utils"

import { MultiAccount } from "../../generated/SymmDataSource/MultiAccount"
import { updateVolume } from "./utils"
import { Handler } from "./Handler"

export class LiquidatePositionsHandler extends Handler {
  user: Address
  event: LiquidatePositionsPartyA

  constructor(_event: ethereum.Event) {
    super(_event)
    const event = changetype<LiquidatePositionsPartyA>(_event) // LiquidatePositionsPartyA, LiquidatePositionsPartyB have the same event signature
    const multiAccount = MultiAccount.bind(
      Address.fromString(MULTI_ACCOUNT_ADDRESS)
    )

    const subAccountAddress = event.params.partyA
    this.user = multiAccount.owner(subAccountAddress)
    this.event = event
    this.timestamp = event.block.timestamp
    this.day = event.block.timestamp
      .minus(BigInt.fromI32(EPOCH_START_TIMESTAMP))
      .div(BigInt.fromI32(86400))
  }

  public handle(): void {
    if (!this.isValid) return

    const ids = this.event.params.quoteIds
    for (let i = 0; i < ids.length; i++) {
      this._handle(ids[i])
    }
  }

  private _handle(quoteId: BigInt): void {
    const volumeInDollars = this.getVolume(quoteId)
    updateVolume(this.user, this.day, volumeInDollars, this.timestamp) // user volume tracker
    updateVolume(
      Address.fromBytes(zero_address),
      this.day,
      volumeInDollars,
      this.timestamp
    ) // total volume tracker
  }

  public getVolume(quoteId: BigInt): BigInt {
    const quote = Quote.load(quoteId.toString())!
    let symmioContract = v3.bind(this.event.address)

    const callResult = symmioContract.try_getQuote(quoteId)
    if (callResult.reverted) return BigInt.zero() //FIXME
    let chainQuote = callResult.value
    const liquidAmount = quote.quantity.minus(quote.closedAmount)
    const liquidPrice = chainQuote.avgClosedPrice
      .times(quote.quantity)
      .minus(quote.avgClosedPrice.times(quote.closedAmount))
      .div(liquidAmount)
    return liquidAmount
      .times(liquidPrice)
      .times(BigInt.fromI32(4))
      .div(BigInt.fromString("10").pow(18))
  }
}
