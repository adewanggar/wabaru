const baileys = require('@whiskeysockets/baileys');
console.log('Keys in baileys:', Object.keys(baileys));
try {
    const { makeInMemoryStore } = require('@whiskeysockets/baileys');
    console.log('makeInMemoryStore type:', typeof makeInMemoryStore);
} catch (e) {
    console.log('Error requiring makeInMemoryStore:', e.message);
}

try {
    const storeModule = require('@whiskeysockets/baileys/lib/Store');
    console.log('Keys in lib/Store:', Object.keys(storeModule));
} catch (e) {
    console.log('Error requiring lib/Store:', e.message);
}
