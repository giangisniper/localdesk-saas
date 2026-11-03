import "dotenv/config";
import { allProviderStatus } from "../src/lib/oauth/config";

for (const s of allProviderStatus()) {
  const state = s.ready ? "READY      " : "NOT READY  ";
  console.log(`${state}${s.provider.padEnd(7)} redirect URI: ${s.redirectUri}`);
  if (s.missing.length) console.log(`           missing env: ${s.missing.join(", ")}`);
  if (s.problem) console.log(`           problem: ${s.problem}`);
}
