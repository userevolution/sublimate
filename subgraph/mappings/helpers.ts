import { log, BigInt, BigDecimal, Address, } from '@graphprotocol/graph-ts'
import {
	DataContainer,
	StreamableToken, StreamableSubscription, SubscriptionSnapshot,
	User,
	UserSnapshot,
	UserStreamableTokenData,
	UserStreamableTokenDataSnapshot
} from "../generated/schema";
import {StreamableERC20Contract} from "../generated/StreamableWrappedETH/StreamableERC20Contract";
export const ZERO_BI = BigInt.fromI32(0)
export const DATA_CONTAINER_ID = '1'
export const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000'

export function loadOrCreateUser(address: string): User | null {
	let user = User.load(address)
	if (user == null) {
		user = new User(address)
		user.totalIncomingSubscriptions = 0
		user.totalSubscribers = 0
		user.totalOutgoingSubscriptions = 0
		user.totalSubscribedTo = 0
	}
	return user
}

export function loadOrCreateDataContainer(): DataContainer | null {
	let dataContainer = loadDataContainer()
	if(dataContainer == null) {
		dataContainer = new DataContainer(DATA_CONTAINER_ID)
		dataContainer.subscriptions = []
		dataContainer.userStreamableTokenData = []
	}
	return dataContainer
}

export function loadDataContainer(): DataContainer | null {
	return DataContainer.load(DATA_CONTAINER_ID)
}

export function createUserStreamableTokenData(id: string, userId: string, tokenId: string): UserStreamableTokenData {
	const userStreamableTokenData = new UserStreamableTokenData(id)
	userStreamableTokenData.user = userId
	userStreamableTokenData.token = tokenId


	userStreamableTokenData.blockAtLastUpdate = ZERO_BI
	userStreamableTokenData.balance = ZERO_BI
	userStreamableTokenData.availableAmount = ZERO_BI

	userStreamableTokenData.lifetimeReceivedAmount = ZERO_BI

	userStreamableTokenData.totalReceivedAmount = ZERO_BI
	userStreamableTokenData.totalIncomingRate = ZERO_BI
	userStreamableTokenData.totalMaxIncomingAmount = ZERO_BI
	userStreamableTokenData.totalSubscribers = 0
	userStreamableTokenData.totalIncomingSubscriptions = 0

	userStreamableTokenData.lifetimePaidAmount = ZERO_BI

	userStreamableTokenData.totalPaidAmount = ZERO_BI
	userStreamableTokenData.totalOutgoingRate = ZERO_BI
	userStreamableTokenData.totalMaxOutgoingAmount = ZERO_BI
	userStreamableTokenData.totalOutgoingSubscriptions = 0
	userStreamableTokenData.totalSubscribedTo = 0
	return userStreamableTokenData
}

export function createStreamableToken(id: Address): StreamableToken {
	const streamableToken = new StreamableToken(id.toHex())
	const contract = getStreamableERC20Contract(id)
	log.info('createStreamableToken creating streamable token entity...', [])

	streamableToken.symbol = contract.symbol()
	streamableToken.name = contract.name()
	log.info('createStreamableToken data: symbol: {}, name: {}', [streamableToken.symbol, streamableToken.name])
	let decimalValue = null
	const decimalResult = contract.try_decimals()
	if (!decimalResult.reverted) {
		decimalValue = decimalResult.value
	}
	streamableToken.decimals = BigInt.fromI32(decimalValue as i32)
	log.info('createStreamableToken decimalValue: {}', [streamableToken.decimals.toString()])
	streamableToken.save()
	return streamableToken
}

export function createSubscriptionSnapshot(subscriptionId: string, blockNumber: BigInt, blockTime: BigInt): SubscriptionSnapshot {
	const subscription = StreamableSubscription.load(subscriptionId)
	const subscriptionSnapshotId = getSubscriptionSnapshotId(subscription.token, subscription.from, subscription.to, subscription.startBlock, blockNumber)
	const subscriptionSnapshot = new SubscriptionSnapshot(subscriptionSnapshotId)
	subscriptionSnapshot.token = subscription.token
	subscriptionSnapshot.rate = subscription.rate
	subscriptionSnapshot.maxAmount = subscription.maxAmount
	subscriptionSnapshot.amountPaid = subscription.amountPaid
	subscriptionSnapshot.startBlock = subscription.startBlock
	subscriptionSnapshot.startTime = subscription.startTime
	subscriptionSnapshot.endBlock = subscription.endBlock
	subscriptionSnapshot.endTime = subscription.endTime
	subscriptionSnapshot.blockNumber = blockNumber
	subscriptionSnapshot.timestamp = blockTime

	const fromUserSnapshot = createUserSnapshot(subscription.from, blockNumber, blockTime)
	const toUserSnapshot = createUserSnapshot(subscription.to, blockNumber, blockTime)

	const fromUserStreamableTokenDataSnapshot = createUserStreamableTokenDataSnapshot(subscription.from, subscription.token, subscription.fromUserTokenData, fromUserSnapshot.id, blockNumber, blockTime)
	const toUserStreamableTokenDataSnapshot = createUserStreamableTokenDataSnapshot(subscription.to, subscription.token, subscription.toUserTokenData, toUserSnapshot.id, blockNumber, blockTime)

	subscriptionSnapshot.from = fromUserSnapshot.id
	subscriptionSnapshot.to = toUserSnapshot.id
	subscriptionSnapshot.fromUserTokenData = fromUserStreamableTokenDataSnapshot.id
	subscriptionSnapshot.toUserTokenData = toUserStreamableTokenDataSnapshot.id

	subscriptionSnapshot.currentFrom = subscription.from
	subscriptionSnapshot.currentTo = subscription.to
	subscriptionSnapshot.currentFromUserTokenData = subscription.fromUserTokenData
	subscriptionSnapshot.currentToUserTokenData = subscription.toUserTokenData
	subscriptionSnapshot.currentSubscription = subscription.id
	subscriptionSnapshot.save()
	return subscriptionSnapshot
}

export function createUserSnapshot(address: string, blockNumber: BigInt, blockTime: BigInt): UserSnapshot {
	const userSnapshotId = getUserSnapshotId(address, blockNumber)
	const user = User.load(address)
	const userSnapshot = new UserSnapshot(userSnapshotId)

	userSnapshot.totalIncomingSubscriptions = user.totalIncomingSubscriptions
	userSnapshot.totalSubscribers = user.totalSubscribers
	userSnapshot.totalOutgoingSubscriptions = user.totalOutgoingSubscriptions
	userSnapshot.totalSubscribedTo = user.totalSubscribedTo

	userSnapshot.blockNumber = blockNumber
	userSnapshot.timestamp = blockTime
	userSnapshot.currentUser = address
	userSnapshot.save()
	return userSnapshot
}

export function createUserStreamableTokenDataSnapshot(userAddress: string, tokenAddress: string, userStreamableDataId: string, userSnapshotId: string, blockNumber: BigInt, blockTime: BigInt): UserStreamableTokenDataSnapshot {
	const userStreamableTokenDataSnapshotId = getUserStreamableTokenDataSnapshotId(userAddress, tokenAddress,  blockNumber)
	const userStreamableTokenDataId = getUserStreamableTokenDataId(userAddress, tokenAddress)
	const userStreamableTokenData = UserStreamableTokenData.load(userStreamableTokenDataId)
	const userStreamableTokenDataSnapshot = new UserStreamableTokenDataSnapshot(userStreamableTokenDataSnapshotId)
	userStreamableTokenDataSnapshot.user = userSnapshotId
	userStreamableTokenDataSnapshot.token = tokenAddress
	userStreamableTokenDataSnapshot.balance = getLastUpdatedBalanceOf(Address.fromString(tokenAddress), Address.fromString(userAddress))
	userStreamableTokenDataSnapshot.availableAmount = userStreamableTokenData.availableAmount

	userStreamableTokenDataSnapshot.lifetimeReceivedAmount = userStreamableTokenData.lifetimeReceivedAmount
	userStreamableTokenDataSnapshot.totalReceivedAmount = userStreamableTokenData.totalReceivedAmount
	userStreamableTokenDataSnapshot.totalIncomingRate = userStreamableTokenData.totalIncomingRate
	userStreamableTokenDataSnapshot.totalMaxIncomingAmount = userStreamableTokenData.totalMaxIncomingAmount
	userStreamableTokenDataSnapshot.totalIncomingSubscriptions = userStreamableTokenData.totalIncomingSubscriptions
	userStreamableTokenDataSnapshot.totalSubscribers = userStreamableTokenData.totalSubscribers

	userStreamableTokenDataSnapshot.lifetimePaidAmount = userStreamableTokenData.lifetimePaidAmount
	userStreamableTokenDataSnapshot.totalPaidAmount = userStreamableTokenData.totalPaidAmount
	userStreamableTokenDataSnapshot.totalOutgoingRate = userStreamableTokenData.totalOutgoingRate
	userStreamableTokenDataSnapshot.totalMaxOutgoingAmount = userStreamableTokenData.totalMaxOutgoingAmount
	userStreamableTokenDataSnapshot.totalOutgoingSubscriptions = userStreamableTokenData.totalOutgoingSubscriptions
	userStreamableTokenDataSnapshot.totalSubscribedTo = userStreamableTokenData.totalSubscribedTo

	userStreamableTokenDataSnapshot.blockNumber = blockNumber
	userStreamableTokenDataSnapshot.timestamp = blockTime

	userStreamableTokenDataSnapshot.currentUser = userAddress
	userStreamableTokenDataSnapshot.currentUserStreamableTokenData = userStreamableTokenDataId
	userStreamableTokenDataSnapshot.save()
	return userStreamableTokenDataSnapshot
}

export function calculateTotalPaidAndTotalReceivedAmountForUserStreamableTokenData(userStreamableTokenDataId: string): UserStreamableTokenData | null {
	const userStreamableTokenDataEntity = UserStreamableTokenData.load(userStreamableTokenDataId)
	let totalPaidAmount = BigInt.fromI32(0)
	let totalReceivedAmount = BigInt.fromI32(0)
	log.info('calculateTotalPaidAndTotalReceivedAmountForUserStreamableTokenData userStreamableTokenDataEntity data: id: {}, balance: {}, availableAmount: {}', [userStreamableTokenDataEntity.id, userStreamableTokenDataEntity.balance.toString(), userStreamableTokenDataEntity.availableAmount.toString()])
	log.info('calculateTotalPaidAndTotalReceivedAmountForUserStreamableTokenData data: totalPaidAmount: {}, totalReceivedAmount: {}', [totalPaidAmount.toString(), totalReceivedAmount.toString()])
	//
	// if(userStreamableTokenDataEntity.totalSubscribers > 0) {
	// 	const incomingSubscriptions = userStreamableTokenDataEntity.incomingSubscriptions
	//
	// 	log.info('calculateTotalPaidAndTotalReceivedAmountForUserStreamableTokenData incomingSubscriptions: {}', incomingSubscriptions)
	//
	// 	for (let i = 0; i < incomingSubscriptions.length; i++) {
	// 		totalReceivedAmount = totalReceivedAmount.plus(StreamableSubscription.load(incomingSubscriptions[i]).amountPaid)
	// 	}
	// 	log.info('calculateTotalPaidAndTotalReceivedAmountForUserStreamableTokenData totalReceivedAmount calculated: {}', [totalReceivedAmount.toString()])
	//
	// }
	//
	//
	// if(userStreamableTokenDataEntity.totalSubscribedTo > 0) {
	// 	const outgoingSubscriptions = userStreamableTokenDataEntity.outgoingSubscriptions
	// 	log.info('calculateTotalPaidAndTotalReceivedAmountForUserStreamableTokenData outgoingSubscriptions: {}', outgoingSubscriptions)
	// 	for (let i = 0; i < outgoingSubscriptions.length; i++) {
	// 		totalPaidAmount = totalPaidAmount.plus(StreamableSubscription.load(outgoingSubscriptions[i]).amountPaid)
	// 	}
	// 	log.info('calculateTotalPaidAndTotalReceivedAmountForUserStreamableTokenData totalPaidAmount calculated: {}', [totalPaidAmount.toString()])
	// }


	userStreamableTokenDataEntity.totalReceivedAmount = totalReceivedAmount
	userStreamableTokenDataEntity.totalPaidAmount = totalPaidAmount
	userStreamableTokenDataEntity.save()
	return userStreamableTokenDataEntity
}



export function getUserStreamableTokenDataId(userAddress: string, tokenAddress: string): string {
	return userAddress.concat('-').concat(tokenAddress)
}

export function getUserStreamableTokenDataSnapshotId(userAddress: string, tokenAddress: string, blockNumber: BigInt): string {
	return userAddress.concat('-').concat(tokenAddress).concat('-').concat(blockNumber.toString())
}

export function getSubscriptionId(tokenAddress: string, from: string, to: string, startBlock: BigInt): string {
	return tokenAddress.concat('-').concat(from).concat('-').concat(to).concat('-').concat(startBlock.toString())
}

export function getSubscriptionSnapshotId(tokenAddress: string, from: string, to: string, startBlock: BigInt, blockNumber: BigInt): string {
	return from.concat('-').concat(to).concat('-').concat(tokenAddress).concat('-').concat(startBlock.toString()).concat('-').concat(blockNumber.toString())
}

export function getUserSnapshotId(address: string, blockNumber: BigInt): string {
	return address.concat('-').concat(blockNumber.toString())
}


export function getStreamableERC20Contract(address: Address): StreamableERC20Contract {
	return StreamableERC20Contract.bind(address)
}

export function getLastUpdatedBalanceOf(contractAddress: Address, userAddress: Address): BigInt {
	log.info('getLastUpdatedBalanceOf data: contractAddress: {}, userAddress: {}', [contractAddress.toHexString(), userAddress.toHexString()])
	const contract = getStreamableERC20Contract(contractAddress)
	let lastUpdatedBalanceValue = BigInt.fromI32(0)
	const lastUpdatedBalanceResult = contract.try_lastUpdatedBalanceOf(userAddress)
	if (!lastUpdatedBalanceResult.reverted) {
		lastUpdatedBalanceValue = lastUpdatedBalanceResult.value
		log.info('getLastUpdatedBalanceOf obtained successfully: lastUpdatedBalanceOf: {}', [lastUpdatedBalanceValue.toString()])
	} else {
		log.error('getLastUpdatedBalanceOf reverted: lastUpdatedBalanceOf: {}', [lastUpdatedBalanceValue.toString()])
	}

	return lastUpdatedBalanceValue
}
