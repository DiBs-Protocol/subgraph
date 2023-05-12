import { Address, BigInt } from "@graphprotocol/graph-ts";
import { RequestHatch } from "../generated/DegenZoo/DegenZoo";
import {
  Referral,
  RequestHatchLog,
  TotalTokenBalance,
} from "../generated/schema";
import {
  getDibs,
  getDzooPrice,
  createReferral,
  e18,
  updateVolume,
  VolumeType,
  addAccumulativeTokenBalance,
  wDZOO,
  ZERO_ADDRESS,
} from "./utils";

function updateVolumes(rhl: RequestHatchLog): void {
  updateVolume(
    Address.fromBytes(rhl.user),
    rhl.amountUsd,
    rhl.timestamp,
    VolumeType.USER
  );
  updateVolume(
    getReferrer(rhl),
    rhl.amountUsd,
    rhl.timestamp,
    VolumeType.PARENT
  );
}

function updateBalances(rhl: RequestHatchLog): void {
  const dibs = getDibs();
  const refereePercentage = dibs.refereePercentage();
  const referrerPercentage = dibs.referrerPercentage();
  const scale = dibs.SCALE();

  const referee = Address.fromBytes(rhl.user);
  const referrer = getReferrer(rhl);

  const refereeAmount = rhl.amount.times(refereePercentage).div(scale);
  const referrerAmount = rhl.amount.times(referrerPercentage).div(scale);

  addAccumulativeTokenBalance(wDZOO, referee, refereeAmount, rhl.timestamp);
  addAccumulativeTokenBalance(wDZOO, referrer, referrerAmount, rhl.timestamp);

  let totalTokenBalance = TotalTokenBalance.load(wDZOO.toHex());

  if (totalTokenBalance == null) {
    totalTokenBalance = new TotalTokenBalance(wDZOO.toHex());
    totalTokenBalance.amount = BigInt.fromI32(0);
    totalTokenBalance.token = wDZOO;
  }

  totalTokenBalance.amount = totalTokenBalance.amount.plus(
    refereeAmount.plus(referrerAmount)
  );
  totalTokenBalance.lastUpdate = rhl.timestamp;
  totalTokenBalance.save();
}

export function handleRequestHatch(event: RequestHatch): void {
  const rhl = createRequestHatchLog(event);

  // if the referrer is the zero address ignore it
  if (rhl.referrer == ZERO_ADDRESS) {
    return;
  }

  // todo: ignore if the referrer has not registered before hand.

  createReferral(
    Address.fromBytes(rhl.referrer),
    Address.fromBytes(rhl.user),
    event.transaction.hash
  );
  updateVolumes(rhl);
  updateBalances(rhl);
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

function getReferrer(rhl: RequestHatchLog): Address {
  const referral = Referral.load(rhl.user.toHex());
  return Address.fromBytes(referral!.referrer);
}
