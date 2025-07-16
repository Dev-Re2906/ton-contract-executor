// jetton-minter.ts

import {
  Address, Cell, beginCell, Contract, contractAddress,
  SendMode, toNano
} from 'ton-core';
import { JettonMasterUtils } from './jetton-utils'; // این فایل شامل توابع کمک‌کننده است

// -------------------------------
// Constants & Opcodes
// -------------------------------

export const MINT_OPCODE = 1;
export const BURN_OPCODE = 2;
export const CHANGE_OWNER_OPCODE = 3;
export const GET_JETTON_DATA_OPCODE = 4;
export const GET_WALLET_ADDRESS_OPCODE = 0x2fcb2bc9;
export const JETTON_NOTIFY_OPCODE = 0x7362d09c;
export const JETTON_INTERNAL_TRANSFER = 0xf8a7ea5;

export const INITIAL_OWNER = Address.parse(
  '0:4818f679ede118884806590b9b705a00fa6aa0cf7009d4b3d128ff263b031c88'
);

export const JETTON_NAME = 'Dogs';
export const JETTON_SYMBOL = 'DOGS';
export const JETTON_DECIMALS = 9;
export const JETTON_IMAGE = 'https://cdn.dogs.dev/dogs.png';

export type JettonMinterConfig = {
  totalSupply: bigint;
  admin: Address;
  nextAdmin: Address;
  walletCode: Cell;
  metadata: Cell;
};

// -------------------------------
// JettonMinter Contract
// -------------------------------

export class JettonMinter extends Contract {

  static async init(walletCode: Cell): Promise<{ code: Cell; data: Cell }> {
    const totalSupply = BigInt('545217356060974508816');
    const admin = INITIAL_OWNER;
    const nextAdmin = INITIAL_OWNER;

    const metadata = beginCell()
      .storeUint(0x8e, 8)
      .storeString('https://cdn.ton.dev/dogs.json')
      .endCell();

    const data = JettonMasterUtils.buildMinterData({
      totalSupply,
      admin,
      nextAdmin,
      walletCode,
      metadata
    });

    const code = await JettonMasterUtils.loadMinterCode(); // خواندن کد کانترکت از فایل یا منبع دیگر

    return { code, data };
  }

  // ارسال دستور mint
  async sendMint(to: Address, jettonAmount: bigint, forwardTon: bigint = toNano('0.05')) {
    const body = JettonMasterUtils.buildMintBody(to, jettonAmount);
    await this.sendInternalMessage(body, forwardTon);
  }

  // ارسال اعلان سوزاندن
  async sendBurnNotification(from: Address, jettonAmount: bigint, queryId = 0n) {
    const body = beginCell()
      .storeUint(BURN_OPCODE, 32)
      .storeUint(queryId, 64)
      .storeCoins(jettonAmount)
      .storeAddress(from)
      .endCell();
    await this.sendInternalMessage(body, toNano('0.05'));
  }

  // تغییر مدیر
  async changeAdmin(newAdmin: Address) {
    const body = beginCell()
      .storeUint(CHANGE_OWNER_OPCODE, 32)
      .storeAddress(newAdmin)
      .endCell();
    await this.sendInternalMessage(body, toNano('0.05'));
  }

  // دریافت اطلاعات جتون
  async getJettonData(): Promise<{
    totalSupply: bigint;
    admin: Address;
    walletCode: Cell;
    metadata: Cell;
  }> {
    const res = await this.get('get_jetton_data', []);
    return JettonMasterUtils.parseJettonData(res.stack);
  }

  // گرفتن آدرس کیف پول جتون
  async getWalletAddress(owner: Address): Promise<Address> {
    const res = await this.get('get_wallet_address', [
      { type: 'slice', cell: beginCell().storeAddress(owner).endCell() }
    ]);
    return res.stack.readAddress();
  }

  // ارسال پیام notify
  async notify(sender: Address, amount: bigint, comment: string) {
    const body = beginCell()
      .storeUint(JETTON_NOTIFY_OPCODE, 32)
      .storeAddress(sender)
      .storeCoins(amount)
      .storeAddress(Address.parse(comment)) // در صورت نیاز به string base64 اینجا اصلاح شود
      .endCell();
    await this.sendInternalMessage(body, toNano('0.05'));
  }

  // ارسال پیام داخلی با مقدار مشخص
  private async sendInternalMessage(body: Cell, value: bigint) {
    await this.send(this.sender, {
      value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body
    });
  }

  // محاسبه آدرس کیف پول جتون
  static calculateWalletAddress(owner: Address, minter: Address, walletCode: Cell): Address {
    return JettonMasterUtils.calculateWalletAddress(owner, minter, walletCode);
  }
       }
