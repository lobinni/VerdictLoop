"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  CHAIN_ID,
  CHAIN_NAME,
  EXPLORER_BASE,
  NATIVE_SYMBOL,
  RPC_URL,
} from "@/lib/config";
// CHAIN_NAME/CHAIN_ID come from the active network profile in config.
import type { Address } from "@/lib/genlayer";

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
};

type WalletContextValue = {
  address: Address | null;
  provider: EthereumProvider | null;
  chainOk: boolean;
  ready: boolean;
  error: string;
  connect: () => Promise<void>;
  disconnect: () => void;
  /** Check/switch MetaMask to chain 61997; throws if it ends on another chain. */
  ensureNetwork: () => Promise<void>;
};

const WalletContext = createContext<WalletContextValue | null>(null);

function getEthereum(): EthereumProvider | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { ethereum?: EthereumProvider }).ethereum;
}

/**
 * Make sure MetaMask is on chain 61997 with the minimum number of wallet popups:
 *   - already on 61997 → resolves silently, no prompt at all;
 *   - on another chain → one network-switch prompt;
 *   - chain unknown to the wallet → one "add network" prompt first.
 * The result is always re-read via eth_chainId instead of being trusted.
 */
async function ensureStudioNetwork(eth: EthereumProvider) {
  const hexId = `0x${CHAIN_ID.toString(16)}`;
  const readChain = async () =>
    parseInt(((await eth.request({ method: "eth_chainId" })) as string) || "0x0", 16);

  if ((await readChain()) === CHAIN_ID) return; // zero popups: wallet already correct

  try {
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hexId }] });
  } catch (e) {
    const code = (e as { code?: number })?.code;
    // 4902: chain unknown to the wallet. Any other failure to switch is fatal.
    if (code !== 4902) throw e;
    await eth.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: hexId,
          chainName: CHAIN_NAME,
          nativeCurrency: { name: NATIVE_SYMBOL, symbol: NATIVE_SYMBOL, decimals: 18 },
          rpcUrls: [RPC_URL],
          blockExplorerUrls: [EXPLORER_BASE],
        },
      ],
    });
  }
  // Trust nothing: confirm what the wallet actually landed on.
  if ((await readChain()) !== CHAIN_ID) {
    throw new Error(`Wallet is not on ${CHAIN_NAME} (chain ${CHAIN_ID}) — switch networks and retry`);
  }
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<Address | null>(null);
  const [provider, setProvider] = useState<EthereumProvider | null>(null);
  const [chainOk, setChainOk] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  const bind = useCallback(async (eth: EthereumProvider, acc: string) => {
    const typed = acc as Address;
    try {
      await ensureStudioNetwork(eth); // switches the wallet and verifies the result
      setChainOk(true);
      setAddress(typed);
      setProvider(eth);
      setReady(true);
      setError("");
    } catch (e) {
      setChainOk(false);
      setError(e instanceof Error ? e.message : `Could not connect to ${CHAIN_NAME}`);
      setReady(false);
    }
  }, []);

  const connect = useCallback(async () => {
    const eth = getEthereum();
    if (!eth) {
      setError("MetaMask not found");
      return;
    }
    setError("");
    const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
    if (accounts[0]) await bind(eth, accounts[0]);
  }, [bind]);

  const disconnect = useCallback(() => {
    setAddress(null);
    setProvider(null);
    setChainOk(false);
    setReady(false);
    setError("");
  }, []);

  /** Write-path guard: make sure the wallet is on chain 61997 before signing. */
  const ensureNetwork = useCallback(async () => {
    const eth = provider ?? getEthereum();
    if (!eth) throw new Error("MetaMask not found");
    try {
      await ensureStudioNetwork(eth);
      setChainOk(true);
    } catch (e) {
      setChainOk(false);
      throw e;
    }
  }, [provider]);

  useEffect(() => {
    const eth = getEthereum();
    if (!eth) return;
    eth
      .request({ method: "eth_accounts" })
      .then((accounts) => {
        const list = accounts as string[];
        if (list[0]) void bind(eth, list[0]);
      })
      .catch(() => undefined);
    const onAccounts = (accounts: unknown) => {
      const list = accounts as string[];
      if (list[0]) void bind(eth, list[0]);
      else disconnect();
    };
    const onChain = () => {
      // A network switch invalidates the fee context: rebind or drop the session.
      const ethNow = getEthereum();
      if (ethNow && address) void bind(ethNow, address);
    };
    eth.on?.("accountsChanged", onAccounts);
    eth.on?.("chainChanged", onChain);
    return () => {
      eth.removeListener?.("accountsChanged", onAccounts);
      eth.removeListener?.("chainChanged", onChain);
    };
  }, [bind, disconnect, address]);

  const value = useMemo(
    () => ({ address, provider, chainOk, ready, error, connect, disconnect, ensureNetwork }),
    [address, provider, chainOk, ready, error, connect, disconnect, ensureNetwork],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}
