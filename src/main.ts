import { Address, BigInt, Bytes } from "@graphprotocol/graph-ts";
import { PairFactory } from "../generated/ChronosReferrals/PairFactory";
import { ERC20 } from "../generated/ChronosReferrals/ERC20";
import { Router } from "../generated/ChronosReferrals/Router";
import { Swap } from "../generated/ChronosReferrals/ChronosReferrals";

import {
  ZERO_ADDRESS,
  addAccumulativeTokenBalance,
  getOrCreateGeneratedVolume,
  createReferral,
  createSwapLog,
  getOrCreateLottery,
  getOrCreateUserLottery,
  updateVolume,
  VolumeType,
  getRewardPercentage,
  getNumberOfTickets,
  getOrCreateWeeklyGeneratedVolume,
  getRoutes,
  updatePlatformWithdrawableAmount,
} from "./utils";
import { Dibs } from "../generated/ChronosReferrals/Dibs";
import { DibsLottery } from "../generated/ChronosReferrals/DibsLottery";
import { EACAggregatorProxy } from "../generated/ChronosReferrals/EACAggregatorProxy";
import { PlatformWithdrawableBalance } from "../generated/schema";

export function handleSwap(event: Swap): void {
  // extract swap params from event
  const token = event.params.tokenIn;
  const user = event.params.user;
  const amount = event.params.amountIn;
  const timestamp = event.block.timestamp;

  const router = Router.bind(
    Address.fromString("0xE708aA9E887980750C040a6A2Cb901c37Aa34f3b")
  );
  const pairFactory = PairFactory.bind(
    Address.fromString("0xCe9240869391928253Ed9cc9Bcb8cb98CB5B0722")
  );
  const dibs = Dibs.bind(pairFactory.dibs());
  const dibsLottery = DibsLottery.bind(dibs.dibsLottery());
  const wethPriceFeed = EACAggregatorProxy.bind(dibs.wethPriceFeed());

  const inputToken = ERC20.bind(token);
  const round = dibsLottery.getActiveLotteryRound();

  // get volume in weth
  let volumeInWeth: BigInt;

  const precision = 4;
  const weth = router.wETH();

  if (token == weth) {
    // if input token is wETH, no need to make conversions
    volumeInWeth = amount;
  } else {
    // in case input token is not wETH
    const unit = BigInt.fromI32(10).pow(u8(inputToken.decimals() - precision));
    let unitVolumeInWeth: BigInt;
    const routeToWeth = getRoutes(token, weth);
    if (routeToWeth.length > 0) {
      // if there is a rout from input token to wETH
      unitVolumeInWeth = router
        .getAmountsOut(
          unit, // 0.0001 unit of the input token
          routeToWeth
        )
        .pop(); // last price
    } else {
      // no route to wETH
      unitVolumeInWeth = BigInt.fromI32(0);
    }
    volumeInWeth = unitVolumeInWeth.times(amount).div(unit); // time the amount of input token
  }

  const volumeInDollars = wethPriceFeed
    .latestAnswer()
    .times(volumeInWeth)
    .div(BigInt.fromI32(10).pow(u8(wethPriceFeed.decimals())));

  createSwapLog(
    event,
    BigInt.fromI32(0),
    volumeInWeth,
    wethPriceFeed.latestAnswer(),
    volumeInDollars
  );

  // since all registered users have a parent,
  // we can get the parent and grandparent address
  const parentAddress = dibs.parents(user);
  let grandParentAddress = dibs.parents(parentAddress);

  if (parentAddress == ZERO_ADDRESS) {
    return;
  }

  // if the grandparent address is address 0x0, set grandparent address to dibs address
  if (grandParentAddress == ZERO_ADDRESS) {
    grandParentAddress = dibs.codeToAddress(dibs.DIBS());
  }

  // update generated volume for user, parent and grandparent
  updateVolume(user, volumeInDollars, timestamp, VolumeType.USER);
  updateVolume(parentAddress, volumeInDollars, timestamp, VolumeType.PARENT);
  updateVolume(
    grandParentAddress,
    volumeInDollars,
    timestamp,
    VolumeType.GRANDPARENT
  );

  // calculate total amount of reward based on MAX_REFERRAL_FEE from pairFactory
  const feeScale = 10000;
  const feeRate = pairFactory.getFee(event.params.stable);
  const feeAmount = amount.times(feeRate).div(BigInt.fromI32(feeScale));
  const maxReferralFee = pairFactory.MAX_REFERRAL_FEE();
  const referralFee = getRewardPercentage(
    getOrCreateGeneratedVolume(parentAddress).amountAsReferrer
  );
  const maxRewardAmount = feeAmount
    .times(maxReferralFee)
    .div(BigInt.fromI32(10000));
  const rewardAmount = feeAmount.times(referralFee).div(BigInt.fromI32(10000));

  // calculate the amount of tokens that the parent and grandparent and dibs platform will receive
  const scale = dibs.SCALE();
  const grandParentPercentage = dibs.grandparentPercentage();
  const dibsPercentage = dibs.dibsPercentage();
  const grandParentAmount = rewardAmount
    .times(grandParentPercentage)
    .div(scale);
  const dibsAmount = rewardAmount.times(dibsPercentage).div(scale);
  const parentAmount = rewardAmount.minus(grandParentAmount.plus(dibsAmount));
  const platformWithdrawableAmount = maxRewardAmount.minus(rewardAmount);

  updatePlatformWithdrawableAmount(
    token,
    platformWithdrawableAmount,
    timestamp
  );

  // add the reward amount to the accumulative token balance for the parent, grandparent and dibs platform
  addAccumulativeTokenBalance(token, parentAddress, parentAmount, timestamp);
  addAccumulativeTokenBalance(
    token,
    grandParentAddress,
    grandParentAmount,
    timestamp
  );
  addAccumulativeTokenBalance(
    token,
    dibs.codeToAddress(dibs.DIBS()),
    dibsAmount,
    timestamp
  );

  // create a referral if it does not exist
  createReferral(parentAddress, user);

  const lottery = getOrCreateLottery(round);
  const userLottery = getOrCreateUserLottery(round, user);
  const tickets = getNumberOfTickets(
    getOrCreateWeeklyGeneratedVolume(user, round).amountAsUser
  );

  const addedTickets = tickets.minus(userLottery.tickets);

  if (addedTickets.gt(BigInt.fromI32(0))) {
    userLottery.tickets = tickets;
    lottery.totalTickets = lottery.totalTickets.plus(addedTickets);
    userLottery.save();
    lottery.save();
  }
}
