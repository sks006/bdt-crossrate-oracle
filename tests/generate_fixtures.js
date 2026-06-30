const fs = require('fs');
const path = require('path');

function createMockPythBuffer(price, expo, publishTime) {
  const buffer = Buffer.alloc(3312);
  
  // Header
  buffer.writeUInt32LE(0xa1b2c3d4, 0); // magic
  buffer.writeUInt32LE(2, 4);          // version
  buffer.writeUInt32LE(3, 8);          // type = price
  buffer.writeUInt32LE(3312, 12);      // size
  buffer.writeUInt32LE(1, 16);         // ptype = PriceType::Price
  buffer.writeInt32LE(expo, 20);       // expo
  
  // Timestamp / Publish Time (offset 96)
  buffer.writeBigInt64LE(BigInt(publishTime), 96);
  
  // Previous update timestamp (offset 200)
  buffer.writeBigInt64LE(BigInt(publishTime - 10), 200);
  
  // Aggregate Price Info (starts at offset 208)
  buffer.writeBigInt64LE(BigInt(price), 208);        // agg.price
  buffer.writeBigUInt64LE(100n, 216);                // agg.conf
  buffer.writeUInt32LE(1, 224);                      // agg.status = PriceStatus::Trading (1)
  buffer.writeBigUInt64LE(1000n, 232);               // agg.pub_slot = 1000
  
  return buffer;
}

const now = Math.floor(Date.now() / 1000);
// EUR/USD = 1.08 (108000000 with expo -8)
const pythBuffer = createMockPythBuffer(108000000, -8, now);

const accountInfo = {
  "pubkey": "HQ2t2YrgoFB2sLq7GeyT5nzx5EMsc1DfWce1a42KHobc", // Devnet EUR/USD Price Feed
  "account": {
    "lamports": 1000000000,
    "data": [
      pythBuffer.toString("base64"),
      "base64"
    ],
    "owner": "gSbePebfvPy7tRqimPoVecS2UsBvYv46ynrzWocc92s", // Pyth Devnet Program ID
    "executable": false,
    "rentEpoch": 0
  }
};

const fixturesDir = path.join(__dirname, 'fixtures');
if (!fs.existsSync(fixturesDir)) {
  fs.mkdirSync(fixturesDir, { recursive: true });
}

fs.writeFileSync(
  path.join(fixturesDir, 'eur_usd_feed.json'),
  JSON.stringify(accountInfo, null, 2)
);

console.log("Fixture generated successfully at tests/fixtures/eur_usd_feed.json");
