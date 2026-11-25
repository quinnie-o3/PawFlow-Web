-- Read-only catalog validation. Review acknowledgement alone is not schema evidence.
DO $$
BEGIN
  IF EXISTS (
    WITH expected(name, type, required) AS (VALUES
      ('id_hash','text',true), ('generation','uuid',true), ('state','text',true),
      ('user_id','text',false), ('backend_session_id','uuid',false), ('tokens','text',false),
      ('access_expires_at','timestamp with time zone',false), ('expires_at','timestamp with time zone',true),
      ('operation_id','uuid',false), ('lease_until','timestamp with time zone',false),
      ('updated_at','timestamp with time zone',true), ('previous_id_hash','text',false),
      ('previous_generation','uuid',false)
    )
    SELECT 1 FROM expected e LEFT JOIN pg_attribute a
      ON a.attrelid='pawflow_bff.sessions'::regclass AND a.attname=e.name AND a.attnum>0 AND NOT a.attisdropped
    WHERE a.attname IS NULL OR format_type(a.atttypid,a.atttypmod)<>e.type OR a.attnotnull<>e.required
  ) OR (SELECT count(*) FROM pg_attribute WHERE attrelid='pawflow_bff.sessions'::regclass AND attnum>0 AND NOT attisdropped)<>13 THEN
    RAISE EXCEPTION 'Unexpected BFF session columns';
  END IF;
  IF (SELECT count(*) FROM pg_constraint WHERE conrelid='pawflow_bff.sessions'::regclass AND convalidated AND
    pg_get_constraintdef(oid) IN (
      'PRIMARY KEY (id_hash)',
      'CHECK ((length(id_hash) = 64))',
      'CHECK ((state = ANY (ARRAY[''anonymous''::text, ''authenticating''::text, ''active''::text, ''refreshing''::text, ''revoked''::text])))'
    ))<>3 THEN
    RAISE EXCEPTION 'Unexpected BFF session constraints';
  END IF;
  IF EXISTS (
    WITH expected(name, column_name, unique_index) AS (VALUES
      ('bff_session_expiry','expires_at',false), ('bff_session_user','user_id',false),
      ('bff_session_backend','backend_session_id',false), ('bff_session_previous','previous_id_hash',true)
    )
    SELECT 1 FROM expected e LEFT JOIN pg_class c ON c.relname=e.name AND c.relnamespace='pawflow_bff'::regnamespace
    LEFT JOIN pg_index i ON i.indexrelid=c.oid AND i.indrelid='pawflow_bff.sessions'::regclass
    WHERE i.indexrelid IS NULL OR NOT i.indisvalid OR NOT i.indisready OR i.indisunique<>e.unique_index
      OR i.indnkeyatts<>1 OR pg_get_indexdef(i.indexrelid,1,true)<>e.column_name OR i.indpred IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Unexpected BFF session indexes';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_attrdef d JOIN pg_attribute a ON a.attrelid=d.adrelid AND a.attnum=d.adnum
    WHERE d.adrelid='pawflow_bff.sessions'::regclass AND a.attname='updated_at'
      AND pg_get_expr(d.adbin,d.adrelid)='clock_timestamp()'
  ) THEN RAISE EXCEPTION 'Unexpected BFF session default'; END IF;
END $$;
