-- Purge order line screenshot attachments 14 days after delivery.
-- Schedule daily: Supabase Dashboard → Database → Cron, or invoke edge function
--   POST /functions/v1/purge-delivered-attachments
--   Header: x-cron-secret: <CRON_SECRET env on edge function>

CREATE OR REPLACE FUNCTION public.get_order_item_attachments_to_purge()
RETURNS TABLE(item_id uuid, attachment_url text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT oi.id, oi.attachment_url
  FROM order_items oi
  INNER JOIN orders o ON o.id = oi.order_id
  WHERE o.status = 'delivered'
    AND o.delivered_at IS NOT NULL
    AND o.delivered_at < NOW() - INTERVAL '14 days'
    AND oi.attachment_url IS NOT NULL
    AND btrim(oi.attachment_url) <> '';
$$;

CREATE OR REPLACE FUNCTION public.clear_order_item_attachment(p_item_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE order_items
  SET attachment_url = NULL
  WHERE id = p_item_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_order_item_attachments_to_purge() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.clear_order_item_attachment(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_order_item_attachments_to_purge() TO service_role;
GRANT EXECUTE ON FUNCTION public.clear_order_item_attachment(uuid) TO service_role;
