import { BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import { PairFactory } from "../generated/Router/PairFactory";
import { ERC20 } from "../generated/Router/ERC20";
import { Router, Swap } from "../generated/Router/Router";

import {
  ZERO_ADDRESS,
  addAccumulativeTokenBalance,
  getOrCreateGeneratedVolume,
  createReferral,
  createSwapLog,
  getDIBS as getDibs,
  getOrCreateLottery,
  getOrCreateUserLottery,
  getDIBSLottery as getDibsLottery,
  getBNBChainLink as getPriceFeed,
  updateVolume,
  VolumeType,
  getRewardPercentage,
  getNumberOfTickets,
  getOrCreateWeeklyGeneratedVolume,
  getRoutes,
} from "./utils";
import { Dibs } from "../generated/Router/Dibs";
import { DibsLottery } from "../generated/Router/DibsLottery";
import { EACAggregatorProxy } from "../generated/Router/EACAggregatorProxy";

export function handleSwap(event: Swap): void {
  // extract swap params from event
  const token = event.params._tokenIn;
  const user = event.params.sender;
  const amount = event.params.amount0In;
  const timestamp = event.block.timestamp;
  const routerAddress = event.address;

  const router = Router.bind(routerAddress);
  const pairFactory = PairFactory.bind(router.factory());
  const dibs = Dibs.bind(pairFactory.dibs());
  const dibsLottery = DibsLottery.bind(dibs.dibsLottery());
  const wethPriceFeed = EACAggregatorProxy.bind(dibs.wethPriceFeed());

  const inputToken = ERC20.bind(token);

  const round = dibsLottery.getActiveLotteryRound();

  // check if user is not registered in the dibs contract
  // then return
  const userCode = dibs.addressToCode(user);
  if (userCode == Bytes.empty()) {
    return;
  }

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

  // get volume in BNB
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
  const rewardPercentage = getRewardPercentage(
    getOrCreateGeneratedVolume(parentAddress).amountAsReferrer
  );
  const rewardAmount = feeAmount
    .times(rewardPercentage)
    .div(BigInt.fromI32(10000));

  // calculate the amount of tokens that the parent and grandparent and dibs platform will receive
  const scale = dibs.SCALE();
  const grandParentPercentage = dibs.grandparentPercentage();
  const dibsPercentage = dibs.dibsPercentage();
  const grandParentAmount = rewardAmount
    .times(grandParentPercentage)
    .div(scale);
  const dibsAmount = rewardAmount.times(dibsPercentage).div(scale);
  const parentAmount = rewardAmount.minus(grandParentAmount.plus(dibsAmount));

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
  createSwapLog(
    event,
    round,
    volumeInWeth,
    wethPriceFeed.latestAnswer(),
    volumeInDollars
  );

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
