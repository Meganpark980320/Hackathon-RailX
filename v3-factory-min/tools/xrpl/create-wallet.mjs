import xrpl from "xrpl";

const wallet = xrpl.Wallet.generate();

console.log("Classic Address:", wallet.classicAddress); // r...
console.log("Public Key:", wallet.publicKey);
console.log("Private Key:", wallet.privateKey);
console.log("Seed:", wallet.seed); // ⚠️ 안전 보관 필수
