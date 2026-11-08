ALTER TABLE orders
  ADD COLUMN amount_paid_kop BIGINT NOT NULL DEFAULT 0;

UPDATE orders SET amount_paid_kop = amount_kop WHERE amount_paid_kop = 0;
