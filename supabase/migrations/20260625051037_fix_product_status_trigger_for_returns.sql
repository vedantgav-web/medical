CREATE OR REPLACE FUNCTION public.update_product_status()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  -- If this is a returned/expired batch (manually marked), respect the explicit status
  IF NEW.batch_number = 'Returned' AND NEW.expiry_date IS NULL THEN
    NEW.status := COALESCE(NEW.status, 'Expired');
    IF NEW.status IS NULL OR NEW.status = 'Good' THEN
      NEW.status := 'Expired';
    END IF;
  ELSE
    -- Normal auto-status logic based on expiry date
    IF NEW.expiry_date IS NOT NULL AND NEW.expiry_date < CURRENT_DATE THEN
      NEW.status := 'Expired';
    ELSIF NEW.expiry_date IS NOT NULL AND NEW.expiry_date >= CURRENT_DATE THEN
      NEW.status := 'Good';
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;