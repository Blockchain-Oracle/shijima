import { encodeAbiParameters, type Hex, keccak256 } from 'viem'

export function chainHead(prevHead: Hex, seq: bigint, decisionHash: Hex): Hex {
  return keccak256(
    encodeAbiParameters(
      [{ type: 'bytes32' }, { type: 'uint64' }, { type: 'bytes32' }],
      [prevHead, seq, decisionHash],
    ),
  )
}
