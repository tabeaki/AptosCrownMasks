import { ethers, waffle } from "hardhat";
import { Signer } from "ethers";
import type { BigNumber } from "ethers";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
const { expect } = require("chai");


export const test_config = {
  price: 3,
  price_pre: 2,
  contract_name: "AstarCats",
  max_supply: 7777,
  max_mint: 10,
  symbol: "CAT"
};


export async function assertPreMintSuccess(ad: any, cost: number | BigNumber, signer: SignerWithAddress, num: number, alreadySupply = 0) {
  let tokenId = await ad.totalSupply();

  expect(
    await ad.connect(signer).preMint(num, {
      value: cost,
    })
  )
    .to.emit(ad, "Transfer")
    .withArgs(ethers.constants.AddressZero, signer.address, tokenId.add(num.toString()));
  expect(await ad.totalSupply()).to.equal(num + alreadySupply);
}

export async function assertPublicMintSuccess(ad: any, cost: number | BigNumber, signer: SignerWithAddress, num: number, alreadySupply = 0) {
  let tokenId = await ad.totalSupply();

  expect(
    await ad.connect(signer).publicMint(num, {
      value: cost,
    })
  )
    .to.emit(ad, "Transfer")
    .withArgs(ethers.constants.AddressZero, signer.address, tokenId.add(num.toString()));
  expect(await ad.totalSupply()).to.equal(num + alreadySupply);
}