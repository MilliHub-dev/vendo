/**
 * Sample data for the mock API. Vendor names are invented placeholders — replace with
 * real partners (and photos) before launch. Coordinates are around Kaduna.
 */
import { nairaToKobo as n } from '@/lib/money';

import type { City, MenuItem, SavedAddress, User, Vendor } from '../types';

export const cities: City[] = [
  { id: 'kaduna', name: 'Kaduna', isActive: true },
  { id: 'abuja', name: 'Abuja', isActive: true },
  { id: 'kano', name: 'Kano', isActive: true },
  { id: 'lagos', name: 'Lagos', isActive: true },
];

export const me: User = {
  id: 'user-1',
  name: 'Amina Bello',
  phone: '+2348030000000',
  email: 'amina@example.com',
  cityId: 'kaduna',
  referralCode: 'AMINA24',
};

export const savedAddresses: SavedAddress[] = [
  { id: 'addr-1', label: 'Home', address: 'Ali Akilu Road, Kaduna', note: 'Blue gate, opposite the pharmacy', lat: 10.5441, lng: 7.4388 },
  { id: 'addr-2', label: 'Office', address: 'Ahmadu Bello Way, Kaduna', note: '2nd floor, ask for reception', lat: 10.5167, lng: 7.4333 },
];

export const vendors: Vendor[] = [
  {
    id: 'v-1', emoji: '🍛', name: 'Arewa Kitchen', category: 'restaurant', cuisine: 'Northern Nigerian', cityId: 'kaduna',
    address: 'Kawo Road, Kaduna', location: { lat: 10.5795, lng: 7.4496 }, isOpen: true,
    rating: 4.8, ratingCount: 312, etaMinutes: [20, 30], deliveryFeeKobo: n(700),
  },
  {
    id: 'v-2', emoji: '🍢', name: 'Suya Junction', category: 'fast_food', cuisine: 'Grill & suya', cityId: 'kaduna',
    address: 'Yakubu Gowon Way, Kaduna', location: { lat: 10.5262, lng: 7.4405 }, isOpen: true,
    rating: 4.7, ratingCount: 198, etaMinutes: [15, 25], deliveryFeeKobo: n(600),
  },
  {
    id: 'v-3', emoji: '🍲', name: 'Mama Put Express', category: 'restaurant', cuisine: 'Rice & swallow', cityId: 'kaduna',
    address: 'Barnawa Shopping Complex, Kaduna', location: { lat: 10.4806, lng: 7.4341 }, isOpen: true,
    rating: 4.6, ratingCount: 541, etaMinutes: [25, 35], deliveryFeeKobo: n(900),
  },
  {
    id: 'v-4', emoji: '🥤', name: 'Chill Spot Drinks', category: 'drinks', cuisine: 'Smoothies & zobo', cityId: 'kaduna',
    address: 'Independence Way, Kaduna', location: { lat: 10.5354, lng: 7.4279 }, isOpen: true,
    rating: 4.5, ratingCount: 87, etaMinutes: [10, 20], deliveryFeeKobo: n(500),
  },
  {
    id: 'v-5', emoji: '🛒', name: 'FreshMart Groceries', category: 'groceries', cuisine: 'Everyday groceries', cityId: 'kaduna',
    address: 'Sabon Tasha, Kaduna', location: { lat: 10.4551, lng: 7.4612 }, isOpen: false,
    rating: 4.4, ratingCount: 64, etaMinutes: [30, 45], deliveryFeeKobo: n(1000),
  },
];



const emoji: Record<string, string> = {
  'm-1': '🍲',
  'm-2': '🥞',
  'm-3': '🍛',
  'm-4': '🍚',
  'm-5': '🥛',
  'm-6': '🍢',
  'm-7': '🍗',
  'm-8': '🥩',
  'm-9': '🍱',
  'm-10': '🍛',
  'm-11': '🥘',
  'm-12': '🍲',
  'm-13': '🫘',
  'm-14': '🍹',
  'm-15': '🥭',
  'm-16': '🥣',
  'm-17': '🍞',
  'm-18': '🥚',
};

const item = (id: string, vendorId: string, name: string, description: string, naira: number, category: string, isAvailable = true): MenuItem => ({
  id, vendorId, name, description, priceKobo: n(naira), category, isAvailable, emoji: emoji[id],
});

export const menuItems: MenuItem[] = [
  item('m-1', 'v-1', 'Tuwo Shinkafa & Miyan Kuka', 'Soft rice swallow with baobab-leaf soup and beef.', 2500, 'Popular'),
  item('m-2', 'v-1', 'Masa (6 pieces)', 'Fluffy rice cakes served with spicy yaji.', 1200, 'Popular'),
  item('m-3', 'v-1', 'Jollof Rice & Chicken', 'Smoky party jollof with grilled chicken.', 3000, 'Rice'),
  item('m-4', 'v-1', 'Fried Rice & Beef', 'Vegetable fried rice with peppered beef.', 3000, 'Rice'),
  item('m-5', 'v-1', 'Kunu Aya', 'Chilled tiger-nut drink, 50cl.', 700, 'Drinks'),
  item('m-6', 'v-2', 'Beef Suya', 'Thin-sliced grilled beef, onions, cabbage and yaji.', 2000, 'Popular'),
  item('m-7', 'v-2', 'Chicken Suya', 'Half grilled chicken with suya spice.', 3500, 'Popular'),
  item('m-8', 'v-2', 'Kilishi (100g)', 'Dried spiced beef — great for the road.', 2500, 'Sides'),
  item('m-9', 'v-2', 'Masa & Suya Combo', 'Four masa with a portion of beef suya.', 2800, 'Combos'),
  item('m-10', 'v-3', 'White Rice & Stew', 'With beef, plantain and a boiled egg.', 2200, 'Popular'),
  item('m-11', 'v-3', 'Pounded Yam & Egusi', 'With assorted meat.', 3200, 'Swallow'),
  item('m-12', 'v-3', 'Amala & Ewedu', 'With gbegiri and goat meat.', 3000, 'Swallow', false),
  item('m-13', 'v-3', 'Moi Moi', 'Steamed bean pudding, one wrap.', 600, 'Sides'),
  item('m-14', 'v-4', 'Zobo', 'Hibiscus drink with ginger and pineapple, 50cl.', 600, 'Popular'),
  item('m-15', 'v-4', 'Mango Smoothie', 'Fresh mango, banana and yoghurt.', 1800, 'Smoothies'),
  item('m-16', 'v-4', 'Fura da Nono', 'Millet balls in fresh yoghurt.', 1000, 'Popular'),
  item('m-17', 'v-5', 'Bread (large loaf)', 'Freshly baked.', 1200, 'Bakery'),
  item('m-18', 'v-5', 'Eggs (crate of 30)', 'Farm fresh.', 5500, 'Essentials'),
];
