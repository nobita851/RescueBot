require("dotenv").config();
const { ethers } = require("ethers");
const {
  FlashbotsBundleProvider,
} = require("@flashbots/ethers-provider-bundle");

async function main() {
  const provider = new ethers.providers.JsonRpcProvider(process.env.RPC);
  const compromised = new ethers.Wallet(
    process.env.COMPROMISED_PRIVATE_KEY,
    provider
  );
  const funder = new ethers.Wallet(process.env.FUNDER_PRIVATE_KEY, provider);
  const flashbotsProvider = await FlashbotsBundleProvider.create(
    provider,
    funder
  );
  let ABI = [
    {
      inputs: [
        {
          internalType: "address",
          name: "recipient",
          type: "address",
        },
        {
          internalType: "uint256",
          name: "amount",
          type: "uint256",
        },
      ],
      name: "transfer",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "account",
          type: "address",
        },
      ],
      name: "balanceOf",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
  ];
  let token = new ethers.Contract(process.env.TOKEN, ABI, provider);
  let IERC20 = new ethers.utils.Interface(ABI);
  const calldata = IERC20.encodeFunctionData("transfer", [
    process.env.RECEIVER,
    await token.balanceOf(compromised.address),
  ]);
  const PRIORITY_FEE = ethers.utils.parseUnits("100", "gwei");
  const maxBaseFeeInFutureBlock =
    FlashbotsBundleProvider.getMaxBaseFeeInFutureBlock(
      block.baseFeePerGas,
      BLOCKS_IN_THE_FUTURE
    );
  const fund = maxBaseFeeInFutureBlock
    .mul(
      await token.estimateGas.transfer(
        process.env.RECEIVER,
        await token.balanceOf(compromised.address)
      )
    )
    .mul(2);
  bundle = [
    {
      transaction: {
        to: compromised.address,
        value: fund,
        data: "0x",
        nonce: await funder.getTransactionCount(),
      },
      signer: funder,
    },
    {
      transaction: {
        to: process.env.Token,
        value: "0x0",
        data: calldata,
        gasLimit: 500000,
        maxFeePerGas: PRIORITY_FEE.add(maxBaseFeeInFutureBlock),
        maxPriorityFeePerGas: PRIORITY_FEE,
        nonce: await compromised.getTransactionCount(),
      },
      signer: compromised,
    },
  ];
  const block = await provider.getBlock("latest");
  const blockNumber = block.number;
  const targetBlockNumber = blockNumber + 1;
  const signedBundle = await flashbotsProvider.signBundle(bundle);
  const tx = await flashbotsProvider.sendBundle(
    signedBundle,
    targetBlockNumber
  );
  await tx.wait();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
