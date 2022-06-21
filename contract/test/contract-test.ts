import { ethers, waffle } from "hardhat";
import { Signer } from "ethers";
import type { BigNumber } from "ethers";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
const { expect, assert } = require("chai");
const provider = waffle.provider;
import { test_config, assertPublicMintSuccess, assertPreMintSuccess } from "./test-helpers";


describe("AstarCats contract", function () {
  let owner: SignerWithAddress;
  let bob: SignerWithAddress;
  let alis: SignerWithAddress;
  let ad: any;
  let addrs;

  const not_revealed_uri = "not_revealed_uri";

  beforeEach(async function () {
    // @ts-ignore
    [owner, bob, alis, ...addrs] = await ethers.getSigners();
    const AstarCats = await ethers.getContractFactory(test_config.contract_name);
    ad = await AstarCats.deploy(test_config.contract_name, test_config.symbol, not_revealed_uri);
    await ad.deployed();

    // Ensure contract is paused/disabled on deployment
    expect(await ad.is_paused()).to.equal(true);
    expect(await ad.is_revealed()).to.equal(false);
    await ad.pause(false);

  });

  describe("Basic checks", function () {

    it('check the owner', async function () {
      expect(await ad.owner()).to.equal(owner.address)
    });

    it('check the maxSupply', async function () {
      expect(await ad.maxSupply()).to.equal(test_config.max_supply);
    });

    it('check default is PreSale', async function () {
      expect(await ad.is_presaleActive()).to.equal(true);
    });

    it("Confirm Pre Cat price", async function () {
      const cost = ethers.utils.parseUnits(test_config.price_pre.toString(), 0)
      const expectedCost = cost.mul(ethers.constants.WeiPerEther);
      expect(await ad.getCurrentCost()).to.equal(expectedCost);
    });

    it("Confirm Public Cat price", async function () {
      const cost = ethers.utils.parseUnits(test_config.price.toString(), 0)
      const expectedCost = cost.mul(ethers.constants.WeiPerEther);
      await ad.setPresale(false);
      expect(await ad.getCurrentCost()).to.equal(expectedCost);
    });


  });

  describe("Public Minting checks", function () {
    beforeEach(async function () {
      await ad.setPresale(false);
    });

    it("PublicMint fail if presale is active", async () => {
      const degenCost = await ad.getCurrentCost();
      await ad.setPresale(true);
      await expect(ad.connect(bob)
        .publicMint(1, { value: degenCost })).to.revertedWith("Public mint is paused while Presale is active.");
    });

    it("Non-owner cannot mint without enough balance", async () => {
      const degenCost = await ad.getCurrentCost();
      await expect(ad.connect(bob).publicMint(1, { value: degenCost.sub(1) })).to.be.reverted;
    });

    it("Owner and Bob mint", async () => {
      const degenCost = await ad.getCurrentCost();
      let tokenId = await ad.totalSupply();
      expect(await ad.totalSupply()).to.equal(0);
      expect(
        await ad.publicMint(1, {
          value: degenCost,
        })
      )
        .to.emit(ad, "Transfer")
        .withArgs(ethers.constants.AddressZero, owner.address, tokenId + 1);

      expect(await ad.totalSupply()).to.equal(1);
      tokenId = await ad.totalSupply();
      expect(
        await ad.connect(bob).publicMint(1, {
          value: degenCost,
        })
      )
        .to.emit(ad, "Transfer")
        .withArgs(ethers.constants.AddressZero, bob.address, tokenId.add('1'));

      expect(await ad.totalSupply()).to.equal(2);
    });

    it("Minting tokens increased contract balance", async () => {
      const degenCost = await ad.getCurrentCost();
      const tokenId = await ad.totalSupply();

      // Mint first token and expect a balance increase
      const init_contract_balance = await provider.getBalance(ad.address);
      expect(await ad.publicMint(1, { value: degenCost })).to.be.ok;
      expect(await provider.getBalance(ad.address)).to.equal(degenCost);

      // Mint two additonal tokens and expect increase again
      expect(await ad.publicMint(2, { value: degenCost.mul(2) })).to.be.ok;
      expect(await provider.getBalance(ad.address)).to.equal(degenCost.mul(3));
    });

    it("Bob mints " + test_config.max_mint, async () => {
      const degenCost = await ad.getCurrentCost();
      const tokenId = await ad.totalSupply();

      expect(
        await ad.connect(bob).publicMint(test_config.max_mint, {
          value: degenCost.mul(test_config.max_mint),
        })
      )
        .to.emit(ad, "Transfer")
        .withArgs(ethers.constants.AddressZero, bob.address, tokenId.add(test_config.max_mint.toString()));
      expect(await ad.totalSupply()).to.equal(test_config.max_mint);

    });

    it("Bob mints 1 plus " + (test_config.max_mint - 1), async () => {
      const degenCost = await ad.getCurrentCost();
      const tokenId = await ad.totalSupply();

      expect(
        await ad.connect(bob).publicMint(1, {
          value: degenCost.mul(1),
        })
      )
        .to.emit(ad, "Transfer")
        .withArgs(ethers.constants.AddressZero, bob.address, tokenId.add('1'));
      expect(await ad.totalSupply()).to.equal(1);

      expect(
        await ad.connect(bob).publicMint(test_config.max_mint - 1, {
          value: degenCost.mul(test_config.max_mint - 1),
        })
      )
        .to.emit(ad, "Transfer")
        .withArgs(ethers.constants.AddressZero, bob.address, tokenId.add((test_config.max_mint - 1).toString()));
      expect(await ad.totalSupply()).to.equal(test_config.max_mint);

    });

    it("Bob fails to mints " + (test_config.max_mint + 1), async () => {
      const degenCost = await ad.getCurrentCost();
      const tokenId = await ad.totalSupply();

      await expect(ad.connect(bob).publicMint((test_config.max_mint + 1), { value: degenCost.mul((test_config.max_mint + 1)), }))
        .to.revertedWith("Mint amount cannot exceed 10 per Tx.");
    });

    it("Bob fails to mints 2 with funds for 1", async () => {
      const degenCost = await ad.getCurrentCost();

      await expect(ad.connect(bob).publicMint(2, { value: degenCost }))
        .to.revertedWith("Not enough funds provided for mint");

      expect(await ad.totalSupply()).to.equal(0);
    });

    it("Public Sale Price Boundary Check", async () => {
      const cost = ethers.utils.parseUnits(test_config.price.toString(), 0).mul(ethers.constants.WeiPerEther);
      await assertPublicMintSuccess(ad, cost, bob, 1);
      await assertPublicMintSuccess(ad, cost.add(1), bob, 1, 1);
      await expect(ad.connect(bob).publicMint(1, { value: cost.sub(1) }))
        .to.revertedWith("Not enough funds provided for mint");

      expect(await ad.totalSupply()).to.equal(2);
    });


    it(`${test_config.max_mint} mint Public Sale Price Boundary Check`, async () => {
      const cost = ethers.utils.parseUnits(test_config.price.toString(), 0).mul(ethers.constants.WeiPerEther);
      await assertPublicMintSuccess(ad, cost.mul(test_config.max_mint), bob, test_config.max_mint);
      await assertPublicMintSuccess(ad, cost.mul(test_config.max_mint).add(1), bob, 1, test_config.max_mint);
      await expect(ad.connect(bob).publicMint(test_config.max_mint, { value: cost.mul(test_config.max_mint).sub(1) }))
        .to.revertedWith("Not enough funds provided for mint");

      expect(await ad.totalSupply()).to.equal(11);
    });

    it("Pre Sale price can not buy", async () => {
      const cost = ethers.utils.parseUnits(test_config.price_pre.toString(), 0).mul(ethers.constants.WeiPerEther);
      await expect(ad.connect(bob).publicMint(1, { value: cost.sub(1) }))
        .to.revertedWith("Not enough funds provided for mint");
    });

    it("Public sale have no wallet restriction (only TX)", async () => {
      const cost = await ad.getCurrentCost();
      await assertPublicMintSuccess(ad, cost.mul(test_config.max_mint), bob, test_config.max_mint);
      await assertPublicMintSuccess(ad, cost.mul(test_config.max_mint), bob, test_config.max_mint, test_config.max_mint);
    });

  });

  describe("URI checks", function () {
    beforeEach(async function () {
      await ad.setPresale(false);
    });

    it("Token URI not available for non-minted token", async function () {
      await expect(ad.tokenURI(1)).to.be.reverted;
    });

    it("URI not visible before reveal", async function () {
      const degenCost = await ad.getCurrentCost();
      expect(await ad.publicMint(1, { value: degenCost })).to.be.ok;
      expect(await ad.tokenURI(1)).to.equal(not_revealed_uri);
    });

    it("URI visible after reveal", async function () {
      expect(ad.reveal()).to.be.ok;

      const degenCost = await ad.getCurrentCost();
      expect(await ad.publicMint(5, { value: degenCost.mul(5) })).to.be.ok;

      const baseUri = "baseUri/";
      const baseExtension = ".ext";

      expect(await ad.setBaseURI(baseUri)).to.be.ok;
      expect(await ad.setBaseExtension(baseExtension)).to.be.ok;

      const index = 3;
      expect(await ad.tokenURI(3)).to.equal(baseUri + index.toString() + baseExtension);
    });
  });

  describe("Whitelist checks", function () {
    it("Non Whitelisted user cant buy on PreSale", async function () {
      const degenCost = await ad.getCurrentCost();
      await expect(ad.connect(bob).preMint(1, { value: degenCost }))
        .to.be.revertedWith("CL: Five cats max per address in Catlist");
      await expect(ad.connect(owner).preMint(1, { value: degenCost }))
        .to.be.revertedWith("CL: Five cats max per address in Catlist");
    });

    it("Presale can't open on PublicSale", async function () {
      const degenCost = await ad.getCurrentCost();
      await ad.setPresale(false);
      await expect(ad.connect(bob).preMint(1, { value: degenCost }))
        .to.be.revertedWith("Presale is not active.");
    });


    it("Whitelisted user can buy on PreSale", async function () {
      const degenCost = await ad.getCurrentCost();
      let tokenId = await ad.totalSupply();
      expect(await ad.pushMultiWL([bob.address])).to.be.ok;
      expect(await ad.getWhiteListCount()).to.equal(1);
      await assertPreMintSuccess(ad, degenCost, bob, 1);
      await expect(ad.connect(bob).preMint(1, { value: degenCost })).to.be.revertedWith("CL: Five cats max per address in Catlist");
    });

    it("Whitelisted user can buy 5 adn can not buy 6", async function () {
      const degenCost = (await ad.getCurrentCost()).mul(5);
      let tokenId = await ad.totalSupply();
      expect(await ad.pushMultiWL([bob.address, bob.address, bob.address, bob.address, bob.address])).to.be.ok;
      await assertPreMintSuccess(ad, degenCost, bob, 5);
      await expect(ad.connect(bob).preMint(1, { value: degenCost })).to.be.revertedWith("CL: Five cats max per address in Catlist");
    });

    it("Whitelisted user can buy 3 + 2", async function () {
      let degenCost = (await ad.getCurrentCost()).mul(3);
      expect(await ad.pushMultiWL([bob.address, bob.address, bob.address, bob.address, bob.address])).to.be.ok;
      await assertPreMintSuccess(ad, degenCost, bob, 3);
      await assertPreMintSuccess(ad, degenCost, bob, 2, 3);
      await expect(ad.connect(bob).preMint(1, { value: degenCost })).to.be.revertedWith("CL: Five cats max per address in Catlist");
    });


    it("Whitelisted user can not buy over WL", async function () {
      const degenCost = (await ad.getCurrentCost()).mul(6);
      expect(await ad.pushMultiWL([bob.address, bob.address, bob.address, bob.address, bob.address])).to.be.ok;
      await expect(ad.connect(bob).preMint(6, { value: degenCost })).to.be.revertedWith("CL: Five cats max per address in Catlist");
    });

    it("Non WhiteList user block after Whitelisted user buy", async function () {
      const degenCost = await ad.getCurrentCost();
      expect(await ad.pushMultiWL([bob.address, bob.address])).to.be.ok;
      expect(await ad.getWhiteListCount()).to.equal(2);
      await assertPreMintSuccess(ad, degenCost, bob, 1);
      await expect(ad.connect(alis).preMint(1, { value: degenCost })).to.be.revertedWith("CL: Five cats max per address in Catlist");
      await assertPreMintSuccess(ad, degenCost, bob, 1, 1);
      await expect(ad.connect(bob).preMint(1, { value: degenCost })).to.be.revertedWith("CL: Five cats max per address in Catlist");
    });


    it("Pre Sale Price Boundary Check", async () => {
      const cost = ethers.utils.parseUnits(test_config.price_pre.toString(), 0).mul(ethers.constants.WeiPerEther);
      expect(await ad.pushMultiWL([bob.address, bob.address])).to.be.ok;
      await assertPreMintSuccess(ad, cost, bob, 1);
      await assertPreMintSuccess(ad, cost.add(1), bob, 1, 1);
      await expect(ad.connect(bob).preMint(1, { value: cost.sub(1) }))
        .to.revertedWith("Not enough funds provided for mint");

      expect(await ad.totalSupply()).to.equal(2);
    });

    it("Block over allocate Check", async () => {
      let degenCost = (await ad.getCurrentCost()).mul(5);
      expect(await ad.pushMultiWL([bob.address, bob.address, bob.address, bob.address, bob.address])).to.be.ok;
      await assertPreMintSuccess(ad, degenCost, bob, 5);
      expect(await ad.connect(bob)["safeTransferFrom(address,address,uint256)"](bob.address, alis.address, 1)).to.be.ok;
      expect(await ad["balanceOf"](bob.address)).to.equal(4);
      expect(await ad["balanceOf"](alis.address)).to.equal(1);
      await expect(ad.connect(bob).preMint(1, { value: degenCost })).to.be.revertedWith("CL: Five cats max per address in Catlist");
    });


  });

});