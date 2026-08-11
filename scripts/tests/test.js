const PRODUCTS = [
  { cat: "Lips", name: "Test Lip", shade: "Red" }
];
const state = { shopFilter: "Lips" };
let list = PRODUCTS
  .filter(p => state.shopFilter === 'All' || p.cat === state.shopFilter || p.tag === state.shopFilter)
  .filter(p => !"" || p.name.toLowerCase().includes("") || p.shade.toLowerCase().includes(""));
console.log(list.length);
