import { Address, BigInt, Bytes } from "@graphprotocol/graph-ts";

import {
  Referral,
  GeneratedVolume,
  Lottery,
  UserLottery,
  AccumulativeGeneratedVolume,
  WeeklyGeneratedVolume,
  DailyGeneratedVolume,
} from "../generated/schema";
import { Dibs } from "../generated/DegenZoo/Dibs";
import { Pair } from "../generated/DegenZoo/Pair";
import { ERC20 } from "../generated/DegenZoo/ERC20";
import { DibsLottery } from "../generated/DegenZoo/DibsLottery";
import { EACAggregatorProxy } from "../generated/DegenZoo/EACAggregatorProxy";

export const ZERO_ADDRESS = Address.fromHexString(
  "0x0000000000000000000000000000000000000000"
);

export enum VolumeType {
  USER,
  PARENT,
  GRANDPARENT,
}

export function getRound(): BigInt {
  return DibsLottery.bind(getDibs().dibsLottery()).getActiveLotteryRound();
}

export function getDay(): BigInt {
  return DibsLottery.bind(getDibs().dibsLottery()).getActiveDay();
}

export function getOrCreateGeneratedVolume(user: Address): GeneratedVolume {
  let id = user.toHex();
  let generatedVolume = GeneratedVolume.load(id);
  if (generatedVolume == null) {
    generatedVolume = new GeneratedVolume(id);
    generatedVolume.user = user;
    generatedVolume.amountAsUser = BigInt.fromI32(0);
    generatedVolume.amountAsReferrer = BigInt.fromI32(0);
    generatedVolume.amountAsGrandparent = BigInt.fromI32(0);
  }
  return generatedVolume as GeneratedVolume;
}

export function getOrCreateAccumulativeGeneratedVolume(
  user: Address,
  timestamp: BigInt
): AccumulativeGeneratedVolume {
  let id = user.toHex() + "-" + timestamp.toString();
  let accumulativeGeneratedVolume = AccumulativeGeneratedVolume.load(id);
  if (accumulativeGeneratedVolume == null) {
    accumulativeGeneratedVolume = new AccumulativeGeneratedVolume(id);
    accumulativeGeneratedVolume.user = user;
    accumulativeGeneratedVolume.amountAsUser = BigInt.fromI32(0);
    accumulativeGeneratedVolume.amountAsReferrer = BigInt.fromI32(0);
    accumulativeGeneratedVolume.amountAsGrandparent = BigInt.fromI32(0);
    accumulativeGeneratedVolume.lastUpdate = timestamp;
  }
  return accumulativeGeneratedVolume as AccumulativeGeneratedVolume;
}

export function getOrCreateWeeklyGeneratedVolume(
  user: Address,
  epoch: BigInt
): WeeklyGeneratedVolume {
  let id = user.toHex() + "-" + epoch.toString();
  let weeklyGeneratedVolume = WeeklyGeneratedVolume.load(id);
  if (weeklyGeneratedVolume == null) {
    weeklyGeneratedVolume = new WeeklyGeneratedVolume(id);
    weeklyGeneratedVolume.user = user;
    weeklyGeneratedVolume.amountAsUser = BigInt.fromI32(0);
    weeklyGeneratedVolume.amountAsReferrer = BigInt.fromI32(0);
    weeklyGeneratedVolume.amountAsGrandparent = BigInt.fromI32(0);
    weeklyGeneratedVolume.epoch = epoch;
  }
  return weeklyGeneratedVolume;
}

export function getOrCreateDailyGeneratedVolume(
  user: Address,
  day: BigInt
): DailyGeneratedVolume {
  let id = user.toHex() + "-" + day.toString();
  let dailyGeneratedVolume = DailyGeneratedVolume.load(id);
  if (dailyGeneratedVolume == null) {
    dailyGeneratedVolume = new DailyGeneratedVolume(id);
    dailyGeneratedVolume.user = user;
    dailyGeneratedVolume.amountAsUser = BigInt.fromI32(0);
    dailyGeneratedVolume.amountAsReferrer = BigInt.fromI32(0);
    dailyGeneratedVolume.amountAsGrandparent = BigInt.fromI32(0);
    dailyGeneratedVolume.day = day;
  }
  return dailyGeneratedVolume;
}
export function updateVolume(
  user: Address,
  amount: BigInt,
  timestamp: BigInt,
  volumeType: VolumeType
): void {
  const generatedVolume = getOrCreateGeneratedVolume(user);
  const accWeeklyGeneratedVolume = getOrCreateWeeklyGeneratedVolume(
    user,
    getRound()
  );
  const accDailyGeneratedVolume = getOrCreateDailyGeneratedVolume(
    user,
    getDay()
  );
  if (volumeType == VolumeType.USER) {
    generatedVolume.amountAsUser = generatedVolume.amountAsUser.plus(amount);
    accWeeklyGeneratedVolume.amountAsUser = accWeeklyGeneratedVolume.amountAsUser.plus(
      amount
    );
    accDailyGeneratedVolume.amountAsUser = accDailyGeneratedVolume.amountAsUser.plus(
      amount
    );
  } else if (volumeType == VolumeType.PARENT) {
    generatedVolume.amountAsReferrer = generatedVolume.amountAsReferrer.plus(
      amount
    );
    accWeeklyGeneratedVolume.amountAsReferrer = accWeeklyGeneratedVolume.amountAsReferrer.plus(
      amount
    );
    accDailyGeneratedVolume.amountAsReferrer = accDailyGeneratedVolume.amountAsReferrer.plus(
      amount
    );
  } else if (volumeType == VolumeType.GRANDPARENT) {
    generatedVolume.amountAsGrandparent = generatedVolume.amountAsGrandparent.plus(
      amount
    );
    accWeeklyGeneratedVolume.amountAsGrandparent = accWeeklyGeneratedVolume.amountAsGrandparent.plus(
      amount
    );
    accDailyGeneratedVolume.amountAsGrandparent = accDailyGeneratedVolume.amountAsGrandparent.plus(
      amount
    );
  }

  // update timestamps
  accWeeklyGeneratedVolume.lastUpdate = timestamp;
  generatedVolume.lastUpdate = timestamp;
  accDailyGeneratedVolume.lastUpdate = timestamp;

  generatedVolume.save();
  accWeeklyGeneratedVolume.save();
  accDailyGeneratedVolume.save();
}

export function getOrCreateLottery(round: BigInt): Lottery {
  let id = round.toString();
  let lottery = Lottery.load(id);
  if (lottery == null) {
    lottery = new Lottery(id);
    lottery.round = round;
    lottery.totalTickets = BigInt.fromI32(0);
    lottery.save();
  }
  return lottery;
}
export function getOrCreateUserLottery(
  round: BigInt,
  user: Address
): UserLottery {
  let id = user.toHex() + "-" + round.toString();
  let userLottery = UserLottery.load(id);
  if (userLottery == null) {
    userLottery = new UserLottery(id);
    userLottery.user = user;
    userLottery.round = round;
    userLottery.tickets = BigInt.fromI32(0);
    userLottery.save();
  }
  return userLottery;
}
export function createReferral(
  referrer: Address,
  user: Address,
  txHash: Bytes | null = null
): Referral {
  let id = user.toHex();
  let referral = Referral.load(id);
  if (referral == null) {
    referral = new Referral(id);
    referral.user = user;
    referral.referrer = referrer;
    referral.txHash = txHash!;
    referral.save();
  }
  return referral;
}

export function getDzooPrice(): BigInt {
  const pair = Pair.bind(
    Address.fromString("0xd6251Ba6Af2002588f89D3c599A9929f6b0F6A99")
  );

  const reserves = pair.getReserves();

  const wbnbPerDzoo = reserves.value1
    .times(e18(BigInt.fromI32(1)))
    .div(reserves.value0);

  const dzooPrice = getBnbChainLink()
    .latestAnswer()
    .times(wbnbPerDzoo)
    .div(BigInt.fromI32(10).pow(u8(getBnbChainLink().decimals())));

  return dzooPrice;
}

export function getBnbChainLink(): EACAggregatorProxy {
  return EACAggregatorProxy.bind(getDibs().wethPriceFeed());
}

export function getDibs(): Dibs {
  return Dibs.bind(
    Address.fromString("0x3fBA73Fc55dd7cb286F963793F5301E92cC07B57")
  );
}

export function e18(amount: BigInt): BigInt {
  const E18 = BigInt.fromI32(10).pow(18);
  return amount.times(E18);
}

export function getNumberOfTickets(volume: BigInt): BigInt {
  if (volume <= e18(BigInt.fromString("300"))) {
    return BigInt.fromI32(0);
  } else if (volume <= e18(BigInt.fromString("3000"))) {
    return BigInt.fromI32(2);
  } else if (volume <= e18(BigInt.fromString("30000"))) {
    return BigInt.fromI32(5);
  } else if (volume <= e18(BigInt.fromString("150000"))) {
    return BigInt.fromI32(10);
  } else {
    return BigInt.fromI32(15);
  }
}
