import { Address, BigInt } from "@graphprotocol/graph-ts"
import { OpenPosition } from "../../generated/SymmDataSource/v3"

import {
  EPOCH_START_TIMESTAMP,
  MULTI_ACCOUNT_ADDRESS
} from "../../config/config"
import { DailyGeneratedVolume } from "../../generated/schema"
import { zero_address } from "../solidly/utils"

import { MultiAccount } from "../../generated/SymmDataSource/MultiAccount"

export class OpenPositionHandler {
  user: Address
  event: OpenPosition
  timestamp: BigInt
  day: BigInt

  constructor(event: OpenPosition) {
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
    const volumeInDollars = this.getVolume()
    this.updateVolume(this.user, this.day, volumeInDollars) // user volume tracker
    this.updateVolume(
      Address.fromBytes(zero_address),
      this.day,
      volumeInDollars
    ) // total volume tracker
  }

  public getVolume(): BigInt {
    return this.event.params.fillAmount.times(this.event.params.openedPrice)
  }

  public updateVolume(user: Address, day: BigInt, amount: BigInt): void {
    const userVolumeId =
      user.toHex() +
      "-" +
      day.toString() +
      "-" +
      "0x0000000000000000000000000000000000000000"

    let acc = DailyGeneratedVolume.load(userVolumeId)

    if (acc == null) {
      const acc = new DailyGeneratedVolume(userVolumeId)
      acc.user = user
      acc.day = day
      acc.amountAsUser = amount
      acc.amountAsReferrer = amount
      acc.amountAsGrandparent = amount
      acc.lastUpdate = this.timestamp
      acc.pair = zero_address
      acc.save()
      return
    }

    acc.amountAsUser = acc.amountAsUser.plus(amount)
    acc.amountAsReferrer = acc.amountAsReferrer.plus(amount)
    acc.amountAsGrandparent = acc.amountAsGrandparent.plus(amount)
    acc.lastUpdate = this.timestamp
    acc.save()
  }
}
