import type { AssetKind, Chain, Timeframe } from "@/lib/types";
import { getPnlReport } from "@/lib/providers";
import { isValidAddress, detectChain } from "@/lib/utils";

const CHAINS: Chain[] = ["ethereum", "solana"];
const KINDS: AssetKind[] = ["crypto", "nft"];
const TFS: Timeframe[] = ["24H", "7D", "30D", "1Y", "ALL"];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = (searchParams.get("address") ?? "").trim();
  const kind = (searchParams.get("kind") ?? "crypto") as AssetKind;
  const timeframe = (searchParams.get("timeframe") ?? "30D") as Timeframe;
  let chain = searchParams.get("chain") as Chain | null;

  if (!address || !isValidAddress(address)) {
    return Response.json({ error: "Invalid or missing wallet address." }, { status: 400 });
  }
  // If chain not supplied, infer from the address shape.
  if (!chain || !CHAINS.includes(chain)) {
    chain = detectChain(address);
  }
  if (!chain) {
    return Response.json({ error: "Could not determine chain for address." }, { status: 400 });
  }
  if (!KINDS.includes(kind)) {
    return Response.json({ error: "Invalid asset kind." }, { status: 400 });
  }
  if (!TFS.includes(timeframe)) {
    return Response.json({ error: "Invalid timeframe." }, { status: 400 });
  }

  const report = await getPnlReport({ chain, address, kind, timeframe });
  return Response.json(report);
}
