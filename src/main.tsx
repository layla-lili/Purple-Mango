import { Buffer } from 'buffer';

// Polyfill BigInt Buffer methods that @solana/web3.js requires
// The npm `buffer` package doesn't include these, so we patch them in.
if (!Buffer.prototype.writeBigUInt64LE) {
  Buffer.prototype.writeBigUInt64LE = function (value: bigint, offset = 0) {
    let lo = Number(value & BigInt(0xffffffff));
    let hi = Number((value >> BigInt(32)) & BigInt(0xffffffff));
    this.writeUInt32LE(lo, offset);
    this.writeUInt32LE(hi, offset + 4);
    return offset + 8;
  };
}
if (!Buffer.prototype.writeBigInt64LE) {
  Buffer.prototype.writeBigInt64LE = function (value: bigint, offset = 0) {
    let lo = Number(value & BigInt(0xffffffff));
    let hi = Number((value >> BigInt(32)) & BigInt(0xffffffff));
    this.writeUInt32LE(lo, offset);
    this.writeInt32LE(hi, offset + 4);
    return offset + 8;
  };
}
if (!Buffer.prototype.readBigUInt64LE) {
  Buffer.prototype.readBigUInt64LE = function (offset = 0) {
    const lo = this.readUInt32LE(offset);
    const hi = this.readUInt32LE(offset + 4);
    return BigInt(lo) | (BigInt(hi) << BigInt(32));
  };
}
if (!Buffer.prototype.readBigInt64LE) {
  Buffer.prototype.readBigInt64LE = function (offset = 0) {
    const lo = this.readUInt32LE(offset);
    const hi = this.readInt32LE(offset + 4);
    return BigInt(lo) | (BigInt(hi) << BigInt(32));
  };
}

if (typeof window !== 'undefined') {
  window.Buffer = Buffer;
  (window as any).global = window;
}

import './index.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './App.tsx';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');

createRoot(rootElement).render(
    <BrowserRouter>
        <App />
    </BrowserRouter>,
);