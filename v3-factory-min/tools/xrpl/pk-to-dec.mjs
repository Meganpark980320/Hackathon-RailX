import { ethers } from "ethers";

const pkHex = process.env.EVM_PRIVATE_KEY;
if (!pkHex) throw new Error("Missing EVM_PRIVATE_KEY");

const dec = ethers.toBigInt(pkHex).toString();
console.log(dec);
