import { OpenPosition } from "../../generated/SymmDataSource/v3"
import { OpenPositionHandler } from "./SymmOpenPositionHandler"

export function handleOpenPosition(event: OpenPosition): void {
  const handler = new OpenPositionHandler(event)
  handler.handle()
}
