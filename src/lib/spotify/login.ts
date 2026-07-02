import { start, cancel, onUrl } from "@fabianlars/tauri-plugin-oauth";
import { openUrl } from "@tauri-apps/plugin-opener";
import { randomVerifier, buildAuthUrl, exchangeCode, REDIRECT_PORT } from "./auth";

export async function login(): Promise<void> {
  const verifier = randomVerifier();
  await start({ ports: [REDIRECT_PORT] });
  try {
    const code = await new Promise<string>((resolve, reject) => {
      onUrl((url) => {
        const u = new URL(url);
        const err = u.searchParams.get("error");
        if (err) return reject(new Error(`Spotify a refusé: ${err}`));
        const c = u.searchParams.get("code");
        if (c) resolve(c);
      })
        .then(() => buildAuthUrl(verifier))
        .then(openUrl)
        .catch(reject);
    });
    await exchangeCode(code, verifier);
  } finally {
    await cancel(REDIRECT_PORT).catch(() => {});
  }
}
