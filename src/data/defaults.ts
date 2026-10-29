/** หมวดหมู่ตั้งต้นสำหรับผู้ใช้ใหม่ — เป็นแค่ค่าเริ่มต้น ผู้ใช้แก้/ลบ/เพิ่มได้ทั้งหมด
 *  ไม่ใช่ข้อมูลตัวอย่าง ไม่มีจำนวนเงินปนอยู่ */

import type { Category, Settings } from '../types';

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat_food',      name: 'อาหารและเครื่องดื่ม', type: 'expense', icon: '🍜', color: '#D87965', monthlyBudget: undefined },
  { id: 'cat_transport', name: 'เดินทาง',             type: 'expense', icon: '🛵', color: '#E7C77D' },
  { id: 'cat_home',      name: 'ที่พักและบิล',         type: 'expense', icon: '🏠', color: '#4E735F' },
  { id: 'cat_shopping',  name: 'ช้อปปิ้ง',            type: 'expense', icon: '🛍️', color: '#B98FA6' },
  { id: 'cat_health',    name: 'สุขภาพ',              type: 'expense', icon: '💊', color: '#7FA8A0' },
  { id: 'cat_pet',       name: 'สัตว์เลี้ยง',          type: 'expense', icon: '🐱', color: '#C8A27A' },
  { id: 'cat_other_out', name: 'อื่น ๆ',              type: 'expense', icon: '•',  color: '#A8ADA4' },

  { id: 'cat_salary',    name: 'เงินเดือน',           type: 'income',  icon: '💼', color: '#4E735F' },
  { id: 'cat_online',    name: 'ขายออนไลน์',          type: 'income',  icon: '📦', color: '#5E8A72' },
  { id: 'cat_delivery',  name: 'งานส่งของ',           type: 'income',  icon: '🏍️', color: '#79A68B' },
  { id: 'cat_other_in',  name: 'รายได้อื่น',          type: 'income',  icon: '✦',  color: '#9CBFA8' },
];

export const DEFAULT_SETTINGS: Settings = {
  openingBalance: 0,
  currency: 'THB',
  timezone: 'Asia/Bangkok',
};
