import { Address, BigInt } from "@graphprotocol/graph-ts";
import { RequestHatch } from "../generated/DegenZoo/DegenZoo";
import { Referral, RequestHatchLog } from "../generated/schema";
import {
  getDibs,
  getDzooPrice,
  createReferral,
  e18,
  updateVolume,
  VolumeType,
} from "./utils";
import { Register } from "../generated/DegenZoo/Dibs";

export function handleRegister(event: Register): void {
  createReferral(
    event.params._parent,
    event.params._address,
    event.transaction.hash
  );
}

export function handleRequestHatch(event: RequestHatch): void {
  const rhl = createRequestHatchLog(event);
  createReferral(
    Address.fromBytes(rhl.referrer),
    Address.fromBytes(rhl.user),
    event.transaction.hash
  );

  updateVolume(
    Address.fromBytes(rhl.user),
    rhl.amountUsd,
    rhl.timestamp,
    VolumeType.USER
  );
  updateVolume(getParent(rhl), rhl.amountUsd, rhl.timestamp, VolumeType.PARENT);
  updateVolume(
    getGrandParent(rhl),
    rhl.amountUsd,
    rhl.timestamp,
    VolumeType.GRANDPARENT
  );
}

function createRequestHatchLog(event: RequestHatch): RequestHatchLog {
  const rhl = new RequestHatchLog(
    event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  );

  rhl.txHash = event.transaction.hash;
  rhl.user = event.params.who;
  rhl.tokenId = event.params.tokenId;
  rhl.requestId = event.params.requestId;
  rhl.amount = event.params.amount;
  rhl.amountUsd = getDzooPrice()
    .times(rhl.amount)
    .div(e18(BigInt.fromI32(1)));
  rhl.referrer = event.params.referral;
  rhl.timestamp = event.block.timestamp;
  rhl.save();
  return rhl;
}

function getParent(rhl: RequestHatchLog): Address {
  const referral = Referral.load(rhl.user.toHex());
  return Address.fromBytes(referral!.referrer);
}

function getGrandParent(rhl: RequestHatchLog): Address {
  const referral = Referral.load(rhl.user.toHex());
  const parentReferral = Referral.load(referral!.referrer.toHex());

  if (parentReferral != null) {
    return Address.fromBytes(parentReferral.referrer);
  } else {
    return getDibs()._address;
  }
}
