import {
  FillCloseRequest,
  LiquidatePositionsPartyA,
  LiquidatePositionsPartyB,
  OpenPosition,
  SendQuote
} from "../../generated/SymmDataSource/v3"
import { OpenPositionHandler } from "./SymmOpenPositionHandler"
import { Quote } from "../../generated/schema"
import { BigInt } from "@graphprotocol/graph-ts"
import { FillCloseRequestHandler } from "./SymmFillCloseRequestHandler"
import { LiquidatePositionsPartyAHandler } from "./SymmLiquidatePositionsPartyAHandler"
import { LiquidatePositionsPartyBHandler } from "./SymmLiquidatePositionsPartyBHandler"

export function handleOpenPosition(event: OpenPosition): void {
  const handler = new OpenPositionHandler(event)
  handler.handle()
}

export function handleSendQuote(event: SendQuote): void {
  let quote = new Quote(event.params.quoteId.toString())
  quote.transaction = event.transaction.hash
  quote.quantity = event.params.quantity
  quote.account = event.params.partyA
  quote.closedAmount = BigInt.fromString("0")
  quote.avgClosedPrice = BigInt.fromString("0")
  quote.save()
}

export function handleFillCloseRequest(event: FillCloseRequest): void {
  const handler = new FillCloseRequestHandler(event)
  handler.handle()
}

export function handleLiquidatePositionsPartyA(
  event: LiquidatePositionsPartyA
): void {
  const handler = new LiquidatePositionsPartyAHandler(event)
  for (let i = 0; i < event.params.quoteIds.length; i++) {
    handler.handle(event.params.quoteIds[i])
  }
}

export function handleLiquidatePositionsPartyB(
  event: LiquidatePositionsPartyB
): void {
  const handler = new LiquidatePositionsPartyBHandler(event)
  for (let i = 0; i < event.params.quoteIds.length; i++) {
    handler.handle(event.params.quoteIds[i])
  }
}