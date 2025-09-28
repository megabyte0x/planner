export interface NetworkConfig {
  name: string;
  chainId: number;
  rpcHttp: string;
  rpcWs: string;
  contracts: {
    ethPlanner: string;
    erc20Planner: string;
    uniswapV3Router: string;
    uniswapV3Factory: string;
  };
  tokens: {
    usdc: string;
    dai: string;
    weth: string;
    cbbtc: string;
  };
  fees: {
    [pair: string]: number;
  };
}

export const NETWORKS: Record<string, NetworkConfig> = {
  sepolia: {
    name: "sepolia",
    chainId: 11155111,
    rpcHttp: process.env.SEPOLIA_RPC_HTTP || "",
    rpcWs: process.env.SEPOLIA_RPC_WS || "",
    contracts: {
      ethPlanner: process.env.SEPOLIA_ETH_PLANNER || "",
      erc20Planner: process.env.SEPOLIA_ERC20_PLANNER || "",
      uniswapV3Router: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
      uniswapV3Factory: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
    },
    tokens: {
      usdc: "0xA0b86991c31cC62c2B995C44C4E57EeE33b1c20B0", // Note: These are mainnet addresses
      dai: "0x6B175474E89094C44Da98b954EedeAC495271d0F",   // TODO: Update with actual testnet addresses
      weth: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      cbbtc: process.env.SEPOLIA_CBBTC || "",
    },
    fees: {
      "USDC/WETH": 500,
      "DAI/WETH": 3000,
      "USDC/DAI": 100,
      "WETH/CBBTC": 3000,
    },
  },

  base: {
    name: "base",
    chainId: 8453,
    rpcHttp: process.env.BASE_RPC_HTTP || "https://base-mainnet.g.alchemy.com/v2/YUOPnilJ5zuIqykiGiqZJdqhcmP9k9Ya",
    rpcWs: process.env.BASE_RPC_WS || "",
    contracts: {
      ethPlanner: process.env.BASE_ETH_PLANNER || "0x5CbAFAE58F8722673026032d4975a85F79e1299f",
      erc20Planner: process.env.BASE_ERC20_PLANNER || "0x487ed8087dC66F32c5009244C2399702b4D81067",
      uniswapV3Router: process.env.UNISWAP_V3_ROUTER || "0x2626664c2603336E57B271c5C0b26F421741e481",
      uniswapV3Factory: process.env.UNISWAP_V3_FACTORY || "0x1F98431c8aD98523631AE4a59f267346ea31F984",
    },
    tokens: {
      usdc: process.env.USDC_ADDRESS || "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDbC on Base
      dai: process.env.DAI_ADDRESS || "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",  // DAI on Base
      weth: process.env.WETH_ADDRESS || "0x4200000000000000000000000000000000000006", // WETH on Base
      cbbtc: process.env.CBBTC_ADDRESS || "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf", // cbBTC on Base
    },
    fees: {
      "USDC/WETH": 500,
      "DAI/WETH": 3000,
      "USDC/DAI": 100,
      "WETH/CBBTC": 3000,
    },
  },

  mainnet: {
    name: "mainnet",
    chainId: 1,
    rpcHttp: process.env.MAINNET_RPC_HTTP || "",
    rpcWs: process.env.MAINNET_RPC_WS || "",
    contracts: {
      ethPlanner: process.env.MAINNET_ETH_PLANNER || "",
      erc20Planner: process.env.MAINNET_ERC20_PLANNER || "",
      uniswapV3Router: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
      uniswapV3Factory: "0x33128a8fC17869897dcE68Ed026d694621f6FDfD",
    },
    tokens: {
      usdc: "0xA0b86991c31cC62c2B995C44C4E57EeE33b1c20B0",
      dai: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
      weth: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      cbbtc: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf",
    },
    fees: {
      "USDC/WETH": 500,
      "DAI/WETH": 3000,
      "USDC/DAI": 100,
      "WETH/CBBTC": 3000,
    },
  },
};

export function getNetworkConfig(chainId: number): NetworkConfig {
  const network = Object.values(NETWORKS).find(n => n.chainId === chainId);
  if (!network) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }
  return network;
}

export function getNetworkByName(name: string): NetworkConfig {
  const network = NETWORKS[name.toLowerCase()];
  if (!network) {
    throw new Error(`Unsupported network: ${name}`);
  }
  return network;
}