import { Address, BigInt } from "@graphprotocol/graph-ts"
import { OpenPosition } from "../../generated/SymmDataSource/v3"

import {
  EPOCH_START_TIMESTAMP,
  MULTI_ACCOUNT_ADDRESS
} from "../../config/config"
import { zero_address } from "../solidly/utils"

import { MultiAccount } from "../../generated/SymmDataSource/MultiAccount"
import { updateVolume } from "./utils"
import { Quote } from "../../generated/schema"
import { Handler } from "./Handler"

export class OpenPositionHandler extends Handler {
  user: Address
  event: OpenPosition

  constructor(event: OpenPosition) {
    super(event)
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

    this._handle()
  }

  private _handle(): void {
    const volumeInDollars = this.getVolume()
    updateVolume(this.user, this.day, volumeInDollars, this.timestamp) // user volume tracker
    updateVolume(
      Address.fromBytes(zero_address),
      this.day,
      volumeInDollars,
      this.timestamp
    ) // total volume tracker

    let quote = Quote.load(this.event.params.quoteId.toString())
    if (quote == null) return // FIXME: should not happen !
    quote.quantity = this.event.params.fillAmount
    quote.save()
  }

  public getVolume(): BigInt {
    return this.event.params.fillAmount
      .times(this.event.params.openedPrice)
      .div(BigInt.fromString("10").pow(18))
  }
}
