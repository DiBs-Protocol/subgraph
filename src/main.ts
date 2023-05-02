import { Address } from "@graphprotocol/graph-ts";
import { RequestHatch } from "../generated/DegenZoo/DegenZoo";
import { Referral, RequestHatchLog } from "../generated/schema";
import { getOrCreateReferral } from "./utils";

export function handleRequestHatch(event: RequestHatch): void {
  const rhl = new RequestHatchLog(
    event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  );

  rhl.txHash = event.transaction.hash;
  rhl.user = event.params.who;
  rhl.tokenId = event.params.tokenId;
  rhl.requestId = event.params.requestId;
  rhl.amount = event.params.amount;
  rhl.referrer = event.params.referral;
  rhl.timestamp = event.block.timestamp;
  rhl.save();

  const referral = getOrCreateReferral(rhl.referrer, rhl.user);

  const parent = referral.referrer;

  const parentReferral = Referral.load(parent.toHex());
}
