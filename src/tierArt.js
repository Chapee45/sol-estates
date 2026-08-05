// Cartoon facade art per property tier — shown when no real photo of the
// property exists (photos.js resolved null). Never satellite imagery.
import landmark from './assets/tiers/landmark.jpg'
import mall from './assets/tiers/mall.jpg'
import hotel from './assets/tiers/hotel.jpg'
import bank from './assets/tiers/bank.jpg'
import entertainment from './assets/tiers/entertainment.jpg'
import supermarket from './assets/tiers/supermarket.jpg'
import food from './assets/tiers/food.jpg'
import shop from './assets/tiers/shop.jpg'

export const TIER_ART = { landmark, mall, hotel, bank, entertainment, supermarket, food, shop }

export const tierArtFor = (tier) => TIER_ART[tier] || TIER_ART.shop
