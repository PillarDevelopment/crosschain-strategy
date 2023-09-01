import { BigInt } from "@graphprotocol/graph-ts"
import {
  DcRouter,
  Bridged,
  CancelWithdrawn,
  Deposited,
  MessageFailed,
  OwnershipTransferred,
  RequestedWithdraw,
  RetryMessageSuccess,
  RouterChanged,
  SetMinDstGas,
  SetPrecrime,
  SetTrustedRemote,
  SetTrustedRemoteAddress,
  Withdrawn
} from "../generated/DcRouter/DcRouter"
import { UserDeposit, DepositEntity } from "../generated/schema"

export function handleBridged(event: Bridged): void {
}

export function handleCancelWithdrawn(event: CancelWithdrawn): void {}

export function handleDeposited(event: Deposited): void {
  let depositEntity = DepositEntity.load(event.transaction.hash.toHex())

  if (!depositEntity) {
    depositEntity = new DepositEntity(event.transaction.hash.toHex())
  }

  depositEntity.depositAmount = event.params.amount
  depositEntity.strategyId = event.params.id
  depositEntity.userAddress = event.params.user
  depositEntity.save()

  let userEntity = UserDeposit.load(event.params.user.toHex() + event.params.id.toHex());
  if (!userEntity) {
    userEntity = new UserDeposit(event.params.user.toHex() + event.params.id.toHex());
    userEntity.totalDepositAmount = BigInt.zero();
  }
  userEntity.userAddress = event.params.user;
  userEntity.strategyId = event.params.id;
  userEntity.totalDepositAmount = userEntity.totalDepositAmount.plus(event.params.amount);
  userEntity.save();
}

export function handleDepositTransferred(event: Deposited): void {
  let userEntity = UserDeposit.load(event.params.user.toHex() + event.params.id.toHex());
  if (!userEntity) {
    return;
  }
  userEntity.totalDepositAmount = userEntity.totalDepositAmount.minus(event.params.amount);
  userEntity.save();
}

export function handleMessageFailed(event: MessageFailed): void {}

export function handleOwnershipTransferred(event: OwnershipTransferred): void {}

export function handleRequestedWithdraw(event: RequestedWithdraw): void {}

export function handleRetryMessageSuccess(event: RetryMessageSuccess): void {}

export function handleRouterChanged(event: RouterChanged): void {}

export function handleSetMinDstGas(event: SetMinDstGas): void {}

export function handleSetPrecrime(event: SetPrecrime): void {}

export function handleSetTrustedRemote(event: SetTrustedRemote): void {}

export function handleSetTrustedRemoteAddress(
  event: SetTrustedRemoteAddress
): void {}

export function handleWithdrawn(event: Withdrawn): void {}
