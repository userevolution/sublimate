import WalletStores from 'web3w'
import {TorusModuleLoader} from 'web3w-torus-loader'
import {WalletConnectModuleLoader} from 'web3w-walletconnect-loader'
import contractsInfo from '../contracts.json'
import {notifications} from './notifications'

let walletStores: ReturnType<typeof WalletStores>

export function getWalletStores(){
	if(!walletStores){
		const chainId = '1337' // import.meta.env.VITE_CHAIN_ID
		let nodeUrl: string | undefined
		let finality = 12
		if (chainId === '1337' || chainId === '31337') {
			const localEthNode = undefined // import.meta.env.VITE_ETH_NODE_URI_LOCALHOST
			if (localEthNode && localEthNode !== '') {
				nodeUrl = localEthNode
			} else {
				nodeUrl = 'http://localhost:8545'
			}
			finality = 2
		}

		walletStores = WalletStores({
			chainConfigs: contractsInfo,
			builtin: {autoProbe: true},
			transactions: {
				autoDelete: false,
				finality,
			},
			localStoragePrefix:
				globalThis.basepath &&
				(globalThis.basepath.startsWith('/ipfs/') ||
				globalThis.basepath.startsWith('/ipns/'))
					? globalThis.basepath.slice(6)
					: undefined, // ensure local storage is not conflicting across web3w-based apps on ipfs gateways
			options: [
				'builtin',
				new TorusModuleLoader({verifier: 'google', nodeUrl, chainId}),
				new TorusModuleLoader({verifier: 'facebook', nodeUrl, chainId}),
				new TorusModuleLoader({verifier: 'discord', nodeUrl, chainId}),
				new WalletConnectModuleLoader({
					nodeUrl,
					chainId,
					infuraId: 'bc0bdd4eaac640278cdebc3aa91fabe4',
				}),
			],
		})

		// USEFUL FOR DEBUGGING:
		if (typeof window !== 'undefined') {
			// console.log('adding walletStores');
			/* eslint-disable @typescript-eslint/no-explicit-any */
			;(window as any).walletStores = walletStores
			/* eslint-enable @typescript-eslint/no-explicit-any */
		}


		walletStores.transactions.subscribe(($transactions) => {
			for (const tx of $transactions.concat()) {
				if (tx.confirmations > 0 && !tx.acknowledged) {
					if (tx.status === 'failure') {
						// Notify failure
						notifications.queue({
							id: tx.hash,
							delay: 0,
							title: 'Transaction Error',
							text: 'The Transaction failed',
							type: 'error',
							onAcknowledge: () => walletStores.transactions.acknowledge(tx.hash, 'failure'),
						})
					} else if (tx.status === 'cancelled') {
						// Notify cancelled
						notifications.queue({
							id: tx.hash,
							delay: 3,
							title: 'Transaction Cancelled',
							text: 'The Transaction Has Been Replaced',
							type: 'info',
							onAcknowledge: () => walletStores.transactions.acknowledge(tx.hash, 'cancelled'),
						})
					} else {
						// auto acknowledge
						walletStores.transactions.acknowledge(tx.hash, tx.status)
					}
				}
			}
		})
	}

	return walletStores
}
