import { BigInt, ethereum } from "@graphprotocol/graph-ts"
import { EPOCH_START_TIMESTAMP } from "../../config/config"

export class Handler {
  isValid: boolean
  timestamp: BigInt
  day: BigInt

  constructor(event: ethereum.Event) {
    this.timestamp = event.block.timestamp
    const delta = event.block.timestamp.minus(
      BigInt.fromI32(EPOCH_START_TIMESTAMP)
    )

    this.isValid = delta.ge(BigInt.fromI32(0))
    this.day = delta.div(BigInt.fromI32(86400))
  }

  public handle(): void {
    if (!this.isValid) return

    throw new Error("Not implemented")
  }
}
