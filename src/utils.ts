import { Address, BigInt } from "@graphprotocol/graph-ts"
import { DailyGeneratedVolume } from "../generated/schema"
import { ReferralNFT } from "../generated/SymmDataSource/ReferralNFT"
import { REFERRAL_NFT_ADDRESS } from "./config"

function getReferrerNftId(user: Address): BigInt {
  // returns 0 if the user has no referrer or the referrer is not a valid NFT

  const referralNft = ReferralNFT.bind(
    Address.fromHexString(REFERRAL_NFT_ADDRESS),
  )
  const referrerNftId = referralNft.referrer(referralNft.tokenInUse(user))

  if (referralNft.isActiveReferrer(referrerNftId)) {
    return referrerNftId
  } else {
    return BigInt.fromI32(0)
  }
}

export function updateVolume(
  user: Address,
  day: BigInt,
  amount: BigInt,
  timestamp: BigInt,
): void {
  const referrerTokenId = getReferrerNftId(user)
  const userVolumeId =
    user.toHex() + "-" + referrerTokenId + "-" + day.toString()

  let acc = DailyGeneratedVolume.load(userVolumeId)

  if (acc == null) {
    acc = new DailyGeneratedVolume(userVolumeId)
    acc.referrerNftId = referrerTokenId
    acc.user = user
    acc.day = day
    acc.volume = BigInt.fromI32(0)
  }

  acc.volume = acc.volume.plus(amount)
  acc.lastUpdate = timestamp
  acc.save()
}

export const zero_address = Address.fromHexString(
  "0x0000000000000000000000000000000000000000",
)
