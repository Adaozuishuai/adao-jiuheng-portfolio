DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM administrators WHERE id <> 1) THEN
    RAISE EXCEPTION 'Extra administrator records found; migration stopped without deleting records';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "administrators" ADD CONSTRAINT "administrators_singleton" CHECK ("administrators"."id" = 1);