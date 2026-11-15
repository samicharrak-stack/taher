
// Canvas compatibility check
let canvas;
try {
  canvas = require('canvas');
} catch (err) {
  console.log('⚠️ Canvas not available in production - image features disabled');
  canvas = null;
}

module.exports = { canvas };
