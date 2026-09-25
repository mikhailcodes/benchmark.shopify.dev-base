// Import order is load order: core assigns window.__NS__ before a tag registers,
// because registration upgrades elements already in the document and they mount
// synchronously. Everything imported here ships on every page — use defineLazy
// for sections whose code is worth a separate request.

import '@/core';
import '@/elements';
import '@/sections';
