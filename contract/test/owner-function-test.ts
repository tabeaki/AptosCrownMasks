import { ethers, waffle } from "hardhat";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
const { expect, assert } = require("chai");
const provider = waffle.provider;
import { test_config, assertPublicMintSuccess } from "./test-helpers";
import type { Contract } from "ethers";


describe("AstarCats contract", function () {
  let owner: SignerWithAddress;
  let bob: SignerWithAddress;
  let alis: SignerWithAddress;
  let ad: Contract;
  let addrs;
  const not_revealed_uri = "not_revealed_uri";

  beforeEach(async function () {
    // @ts-ignore
    [owner, bob, alis, ...addrs] = await ethers.getSigners();
    const AstarCats = await ethers.getContractFactory(test_config.contract_name);
    ad = await AstarCats.deploy(test_config.contract_name, test_config.symbol, not_revealed_uri);
    await ad.deployed();

    // Ensure contract is paused/disabled on deployment
    expect(await ad["is_paused"]()).to.equal(true);
    expect(await ad["is_revealed"]()).to.equal(false);
    await ad["pause"](false);

  });


  describe("OwnerFunction checks", function () {
    it("Owner can ownermint", async () => {
      await expect(ad.connect(owner)["ownerMint"](1)).to.be.ok;
    });

    it("Ownership Transform", async () => {
      await ad.connect(owner)["transferOwnership"](bob.address);
      await expect(ad.connect(bob)["ownerMint"](1)).to.be.ok;
    });

    it("WithDraw funds", async () => {
      await ad["setPresale"](false);
      const cost = await ad["getCurrentCost"]();
      const new_owner = ethers.Wallet.createRandom();

      expect(await ad.provider.getBalance(ad.address)).to.equal(0);
      await assertPublicMintSuccess(ad, cost, bob, 1);
      expect(await ad.provider.getBalance(ad.address)).to.equal(cost);
      expect(await ad.provider.getBalance(new_owner.address)).to.equal(0);
      await ad.connect(owner)["transferOwnership"](new_owner.address);
      await ad.connect(owner)["withdraw"]();
      expect(await ad.provider.getBalance(ad.address)).to.equal(0);
      expect(await ad.provider.getBalance(new_owner.address)).to.equal(cost);

    });


    it("Non-owner cant ownermint", async () => {
      await expect(ad.connect(bob)["ownerMint"](1)).to.reverted;
    });
  });
});
