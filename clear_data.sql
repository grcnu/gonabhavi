-- ==========================================================================
-- SQL SCRIPT TO RESET TRANSACTION DATA (KEEPING SETTINGS INTACT)
-- Run this in the Supabase SQL Editor to clear trial transactions.
-- ==========================================================================

-- 1. Clear synchronized transaction records
TRUNCATE TABLE invoices CASCADE;
TRUNCATE TABLE sale_orders CASCADE;
TRUNCATE TABLE purchases CASCADE;
TRUNCATE TABLE expenses CASCADE;
TRUNCATE TABLE payment_ins CASCADE;
TRUNCATE TABLE payment_outs cascade;
TRUNCATE TABLE sales_returns CASCADE;
TRUNCATE TABLE purchase_returns CASCADE;
TRUNCATE TABLE fund_transfers CASCADE;
TRUNCATE TABLE stock_adjustments CASCADE;
TRUNCATE TABLE estimates CASCADE;
TRUNCATE TABLE delivery_challans CASCADE;
TRUNCATE TABLE quotations CASCADE;

-- 2. Clear catalog records (uncomment the lines below if you also want to clear items/contacts)
-- TRUNCATE TABLE products CASCADE;
-- TRUNCATE TABLE customers CASCADE;
-- TRUNCATE TABLE suppliers CASCADE;
