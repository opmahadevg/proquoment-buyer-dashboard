-- === AUTO-NOTIFICATION TRIGGERS ===

-- Trigger: Notify admins when buyer submits RFQ
CREATE OR REPLACE FUNCTION notify_admin_new_rfq() RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM notifications 
    WHERE target_dashboard = 'admin' 
      AND type = 'new_rfq_submitted' 
      AND order_id = NEW.id
  ) THEN
    INSERT INTO notifications (target_dashboard, type, title, message, order_id, read)
    VALUES ('admin', 'new_rfq_submitted',
      'New RFQ: ' || COALESCE(NEW.product, 'Custom Product'),
      'Buyer ' || COALESCE(NEW.buyer, 'Buyer') || ' submitted RFQ for ' || COALESCE(NEW.qty, 'requested qty'),
      NEW.id, false);
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_admin_new_rfq ON rfqs;
CREATE TRIGGER trg_notify_admin_new_rfq
  AFTER INSERT ON rfqs FOR EACH ROW
  EXECUTE FUNCTION notify_admin_new_rfq();

-- Trigger: Notify buyer when RFQ status changes
CREATE OR REPLACE FUNCTION notify_buyer_rfq_status() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO notifications (target_dashboard, type, title, message, order_id, read)
    VALUES ('buyer', 'rfq_status_change',
      'RFQ Update: ' || COALESCE(NEW.product, 'Custom Product'),
      'Your RFQ is now "' || NEW.status || '"',
      NEW.id, false);
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_buyer_rfq_status ON rfqs;
CREATE TRIGGER trg_notify_buyer_rfq_status
  AFTER UPDATE ON rfqs FOR EACH ROW
  EXECUTE FUNCTION notify_buyer_rfq_status();

-- Trigger: Notify buyer when order stage changes
CREATE OR REPLACE FUNCTION notify_buyer_order_stage() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.stage IS DISTINCT FROM NEW.stage THEN
    INSERT INTO notifications (target_dashboard, type, title, message, order_id, read)
    VALUES ('buyer', 'order_stage_change',
      'Order Update: ' || COALESCE(NEW.product, 'Custom Order'),
      'Order moved to "' || NEW.stage || '"',
      NEW.id, false);
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_buyer_order_stage ON orders;
CREATE TRIGGER trg_notify_buyer_order_stage
  AFTER UPDATE ON orders FOR EACH ROW
  EXECUTE FUNCTION notify_buyer_order_stage();

-- Trigger: Notify buyer when milestone added
CREATE OR REPLACE FUNCTION notify_buyer_milestone() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (target_dashboard, type, title, message, order_id, read)
  VALUES ('buyer', 'milestone_added',
    'Milestone: ' || NEW.title,
    COALESCE(NEW.description, 'New milestone reached'),
    NEW.order_id, false);
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_buyer_milestone ON milestones;
CREATE TRIGGER trg_notify_buyer_milestone
  AFTER INSERT ON milestones FOR EACH ROW
  EXECUTE FUNCTION notify_buyer_milestone();

-- Trigger: Notify buyer when new quote arrives
CREATE OR REPLACE FUNCTION notify_buyer_new_quote() RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM notifications 
    WHERE target_dashboard = 'buyer' 
      AND type = 'quote_received' 
      AND order_id = COALESCE(NEW.rfq_id, NEW.id)
  ) THEN
    INSERT INTO notifications (target_dashboard, type, title, message, order_id, read)
    VALUES ('buyer', 'quote_received',
      'New Quote Received',
      'Landed cost quote for RFQ ' || COALESCE(NEW.rfq_id, 'N/A'),
      COALESCE(NEW.rfq_id, NEW.id), false);
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_buyer_new_quote ON quotes;
CREATE TRIGGER trg_notify_buyer_new_quote
  AFTER INSERT ON quotes FOR EACH ROW
  EXECUTE FUNCTION notify_buyer_new_quote();

-- Trigger: Notify admins when buyer accepts/rejects quote
CREATE OR REPLACE FUNCTION notify_admin_quote_response() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status IN ('accepted', 'rejected') THEN
    IF NOT EXISTS (
      SELECT 1 FROM notifications 
      WHERE target_dashboard = 'admin' 
        AND type = 'quote_' || NEW.status
        AND order_id = COALESCE(NEW.rfq_id, NEW.id)
    ) THEN
      INSERT INTO notifications (target_dashboard, type, title, message, order_id, read)
      VALUES ('admin', 'quote_' || NEW.status,
        'Quote ' || INITCAP(NEW.status),
        'Buyer ' || NEW.status || ' quote for RFQ ' || COALESCE(NEW.rfq_id, 'N/A'),
        COALESCE(NEW.rfq_id, NEW.id), false);
    END IF;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_admin_quote_response ON quotes;
CREATE TRIGGER trg_notify_admin_quote_response
  AFTER UPDATE ON quotes FOR EACH ROW
  EXECUTE FUNCTION notify_admin_quote_response();

-- === NOTIFICATION PREFERENCES ===
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  rfq_updates BOOLEAN DEFAULT true,
  order_updates BOOLEAN DEFAULT true,
  quote_alerts BOOLEAN DEFAULT true,
  milestone_alerts BOOLEAN DEFAULT true,
  qc_reports BOOLEAN DEFAULT true,
  admin_announcements BOOLEAN DEFAULT true,
  email_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_prefs" ON notification_preferences;
CREATE POLICY "own_prefs" ON notification_preferences FOR ALL USING (user_id = auth.uid());

-- Ensure tables are in publication for realtime if publication exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    -- Try to add tables, ignore if already exists
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
    EXCEPTION WHEN others THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE milestones;
    EXCEPTION WHEN others THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE notification_preferences;
    EXCEPTION WHEN others THEN NULL;
    END;
  END IF;
END; $$;
