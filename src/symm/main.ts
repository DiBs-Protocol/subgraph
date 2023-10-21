import {
  FillCloseRequest,
  LiquidatePositionsPartyA,
  LiquidatePositionsPartyB,
  OpenPosition,
  SendQuote
} from "../../generated/SymmDataSource/v3"
import { OpenPositionHandler } from "./SymmOpenPositionHandler"
import { Quote } from "../../generated/schema"
import { BigInt, ethereum } from "@graphprotocol/graph-ts"
import { CloseRequestHandler } from "./SymmCloseRequestHandler"
import { LiquidatePositionsHandler } from "./SymmLiquidatePositionsHandler"

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

export function handleCloseRequest(event: ethereum.Event): void {
  const handler = new CloseRequestHandler(event)
  handler.handle()
}

export function handleLiquidatePositions(event: ethereum.Event): void {
  const handler = new LiquidatePositionsHandler(event)
  handler.handle()
}
