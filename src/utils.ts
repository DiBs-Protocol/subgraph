import { Address, BigInt } from "@graphprotocol/graph-ts"
import { DailyGeneratedVolume } from "../generated/schema"
import { ReferralNFT } from "../generated/SymmDataSource/ReferralNFT"
import { REFERRAL_NFT_ADDRESS } from "./config"

function getReferrerNftId(user: Address): BigInt {
  const referralNft = ReferralNFT.bind(
    Address.fromHexString(REFERRAL_NFT_ADDRESS),
  )

  return referralNft.referrer(referralNft.tokenInUse(user))
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
