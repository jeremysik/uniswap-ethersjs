import { 
    Token,
    Fetcher,
    Route,
    Trade,
    TokenAmount,
    TradeType,
    Percent
} from '@uniswap/sdk';
import * as ethers from 'ethers';

const config = {
    chainId               : 5, // Goerli testnet
    uniswapContractAddress: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', // Uniswap router contract
    provider              : 'https://goerli.infura.io/v3/4311f7f0483f4251922576fcdf008335',
    privateKey            : '0xa6f9a4c60f20a7f99f98afcaafe411978f94d54396d0a8843d287dde080e8c4b' // https://punkwallet.io/pk#0xa6f9a4c60f20a7f99f98afcaafe411978f94d54396d0a8843d287dde080e8c4b
}

async function approve(token, amount) {
    const provider      = new ethers.providers.JsonRpcProvider(config.provider);
    const wallet        = new ethers.Wallet(config.privateKey, provider);
    const tokenContract = new ethers.Contract(
        token.address,
        [
            'function transfer(address to, uint amount)',
            'function approve(address spender, uint256 value) public returns (bool success)'
        ],
        wallet
    );

    console.log(`\nApproving ${ethers.utils.formatUnits(amount, token.decimals)} ${token.symbol}...`);

    const tx = await tokenContract.approve(
        config.uniswapContractAddress,
        amount
    );
    
    console.log(`\nSee transaction at: https://goerli.etherscan.io/tx/${tx.hash}\n`);
    console.log(tx);
    console.log(`\nWaiting for transaction receipt...\n`);

    const receipt = await tx.wait(); // You must wait for a receipt here (approval must be executed before swap)
    
    console.log(receipt);
}

async function swap(fromToken, toToken, amount) {
    
    const provider        = new ethers.providers.JsonRpcProvider(config.provider);
    const wallet          = new ethers.Wallet(config.privateKey, provider);
    const uniswapContract = new ethers.Contract(
        config.uniswapContractAddress,
        [
            'function approve(address spender, uint256 value) public returns (bool success)',
            'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)',
            'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
            'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)'
        ],
        wallet
    );

    const pair              = await Fetcher.fetchPairData(toToken, fromToken, provider);
    const route             = new Route([pair], fromToken);
    const slippageTolerance = new Percent('50', '10000'); // 0.5% (50 basis points)

    const trade = new Trade(
        route,
        new TokenAmount(fromToken, amount.toString()),
        TradeType.EXACT_INPUT
    );

    const amountOutMin = trade.minimumAmountOut(slippageTolerance).raw;            
    const deadline     = Math.floor(Date.now() / 1000) + (60 * 20);    

    // If you're swapping ETH for tokens, you can use the following function, otherwise
    // using swapExactTokensForTokens will work in any case.
    //
    // const tx = await uniswapContract.swapExactETHForTokens(
    //     amountOutMin.toString(), 
    //     [
    //         fromToken.address,
    //         toToken.address
    //     ], 
    //     wallet.address, // Receiving address 
    //     deadline,
    //     {
    //         value: amount
    //     }
    // );

    console.log(`\nSwapping ${ethers.utils.formatUnits(amount, fromToken.decimals)} ${fromToken.symbol} to ${toToken.symbol}...`);

    const tx = await uniswapContract.swapExactTokensForTokens(
        amount,
        amountOutMin.toString(), 
        [
            fromToken.address,
            toToken.address
        ], 
        wallet.address, // Receiving address 
        deadline
    );

    console.log(`\nSee transaction at: https://goerli.etherscan.io/tx/${tx.hash}\n`);
    console.log(tx);
    console.log(`\nWaiting for transaction receipt...\n`);

    const reciept = await tx.wait(); // You don't have to wait for confirmation reciept if you don't want to

    console.log(reciept);
    console.log(`\nSwap complete!`);
}

async function main() {
    const DAI    = new Token(config.chainId, '0x11fE4B6AE13d2a6055C8D9cF65c55bac32B5d844', 18, 'DAI');
    const WETH   = new Token(config.chainId, '0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6', 18, 'WETH');
    const amount = ethers.utils.parseUnits('0.01', 18); // DAI has 18 decimals

    // If you are swapping a non-native token you must approve the contract to spend your tokens first (not required for ETH).
    // You can approve the exact amount you want to swap or approve a larger amount so you don't have to approve before
    // every swap.
    await approve(
        DAI,
        amount
    );

    await swap(
        DAI,
        WETH,
        amount
    );
}
main();