-- Seed Official Cronos Routine Templates with verified public.exercises IDs
-- and create atomic SECURITY DEFINER RPC clone_routine_template(uuid).

INSERT INTO public.routine_templates (id, title, description, level, goal, category, is_published)
VALUES
  (
    '11111111-1111-4111-8111-111111111101',
    'Principiante - Fullbody 3 Días',
    'Base sólida de cuerpo completo 3 días a la semana con compuestos principales y máquinas Cronos.',
    'beginner',
    'Fuerza base e hipertrofia',
    'Oficial',
    true
  ),
  (
    '11111111-1111-4111-8111-111111111102',
    'Semana equilibrada',
    'División de 4 días para equilibrar volumen de tren superior, tren inferior y brazos.',
    'intermediate',
    'Hipertrofia balanceada',
    'Oficial',
    true
  ),
  (
    '11111111-1111-4111-8111-111111111103',
    'Push / Pull / Legs',
    'Clásica estructura Empuje / Tirón / Pierna enfocada en sobrecarga progresiva.',
    'advanced',
    'Hipertrofia y fuerza',
    'Oficial',
    true
  )
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  level = EXCLUDED.level,
  goal = EXCLUDED.goal,
  category = EXCLUDED.category,
  is_published = EXCLUDED.is_published;

INSERT INTO public.routine_template_exercises
  (template_id, exercise_id, day_index, day_label, order_index, target_sets, target_reps_min, target_reps_max, rest_seconds)
SELECT v.template_id::uuid, v.exercise_id, v.day_index, v.day_label, v.order_index, v.target_sets, v.target_reps_min, v.target_reps_max, v.rest_seconds
FROM (
  VALUES
    ('11111111-1111-4111-8111-111111111101', '0043', 0, 'Día A · Cuerpo Completo', 0, 3, 8, 12, 90),
    ('11111111-1111-4111-8111-111111111101', '0025', 0, 'Día A · Cuerpo Completo', 1, 3, 8, 12, 90),
    ('11111111-1111-4111-8111-111111111101', '0027', 0, 'Día A · Cuerpo Completo', 2, 3, 8, 12, 90),
    ('11111111-1111-4111-8111-111111111101', '0404', 0, 'Día A · Cuerpo Completo', 3, 3, 8, 12, 90),

    ('11111111-1111-4111-8111-111111111101', '0032', 1, 'Día B · Cuerpo Completo', 0, 3, 6, 10, 120),
    ('11111111-1111-4111-8111-111111111101', '0017', 1, 'Día B · Cuerpo Completo', 1, 3, 6, 10, 90),
    ('11111111-1111-4111-8111-111111111101', '0336', 1, 'Día B · Cuerpo Completo', 2, 3, 10, 15, 60),
    ('11111111-1111-4111-8111-111111111101', '0031', 1, 'Día B · Cuerpo Completo', 3, 3, 10, 15, 60),

    ('11111111-1111-4111-8111-111111111101', '0047', 2, 'Día C · Cuerpo Completo', 0, 3, 8, 12, 90),
    ('11111111-1111-4111-8111-111111111101', '0818', 2, 'Día C · Cuerpo Completo', 1, 3, 8, 12, 90),
    ('11111111-1111-4111-8111-111111111101', 'cg-mach-0003', 2, 'Día C · Cuerpo Completo', 2, 3, 10, 12, 60),
    ('11111111-1111-4111-8111-111111111101', '0200', 2, 'Día C · Cuerpo Completo', 3, 3, 10, 15, 60),

    ('11111111-1111-4111-8111-111111111102', '0025', 0, 'Lunes · Tren Superior', 0, 4, 6, 10, 120),
    ('11111111-1111-4111-8111-111111111102', '0027', 0, 'Lunes · Tren Superior', 1, 4, 8, 12, 90),
    ('11111111-1111-4111-8111-111111111102', '0404', 0, 'Lunes · Tren Superior', 2, 3, 8, 12, 90),
    ('11111111-1111-4111-8111-111111111102', '0334', 0, 'Lunes · Tren Superior', 3, 3, 12, 15, 60),

    ('11111111-1111-4111-8111-111111111102', '0043', 1, 'Martes · Tren Inferior', 0, 4, 6, 10, 120),
    ('11111111-1111-4111-8111-111111111102', '0085', 1, 'Martes · Tren Inferior', 1, 3, 8, 10, 120),
    ('11111111-1111-4111-8111-111111111102', '0336', 1, 'Martes · Tren Inferior', 2, 3, 10, 12, 60),
    ('11111111-1111-4111-8111-111111111102', '1379', 1, 'Martes · Tren Inferior', 3, 4, 12, 15, 45),

    ('11111111-1111-4111-8111-111111111102', '0047', 2, 'Jueves · Empuje y Tirón', 0, 4, 8, 10, 90),
    ('11111111-1111-4111-8111-111111111102', '0818', 2, 'Jueves · Empuje y Tirón', 1, 4, 8, 12, 90),
    ('11111111-1111-4111-8111-111111111102', '0155', 2, 'Jueves · Empuje y Tirón', 2, 3, 12, 15, 60),
    ('11111111-1111-4111-8111-111111111102', '0861', 2, 'Jueves · Empuje y Tirón', 3, 3, 10, 12, 90),

    ('11111111-1111-4111-8111-111111111102', '0032', 3, 'Viernes · Pierna y Brazo', 0, 3, 5, 8, 120),
    ('11111111-1111-4111-8111-111111111102', 'cg-mach-0003', 3, 'Viernes · Pierna y Brazo', 1, 3, 10, 12, 60),
    ('11111111-1111-4111-8111-111111111102', '0031', 3, 'Viernes · Pierna y Brazo', 2, 3, 10, 12, 60),
    ('11111111-1111-4111-8111-111111111102', '0241', 3, 'Viernes · Pierna y Brazo', 3, 3, 12, 15, 60),

    ('11111111-1111-4111-8111-111111111103', '0025', 0, 'Push · Empuje', 0, 4, 6, 10, 120),
    ('11111111-1111-4111-8111-111111111103', '0047', 0, 'Push · Empuje', 1, 3, 8, 12, 90),
    ('11111111-1111-4111-8111-111111111103', '0404', 0, 'Push · Empuje', 2, 3, 8, 12, 90),
    ('11111111-1111-4111-8111-111111111103', '0334', 0, 'Push · Empuje', 3, 3, 12, 15, 60),
    ('11111111-1111-4111-8111-111111111103', '0200', 0, 'Push · Empuje', 4, 3, 12, 15, 60),

    ('11111111-1111-4111-8111-111111111103', '0032', 1, 'Pull · Tirón', 0, 3, 5, 8, 120),
    ('11111111-1111-4111-8111-111111111103', '0017', 1, 'Pull · Tirón', 1, 3, 8, 10, 90),
    ('11111111-1111-4111-8111-111111111103', '0027', 1, 'Pull · Tirón', 2, 4, 8, 12, 90),
    ('11111111-1111-4111-8111-111111111103', '0861', 1, 'Pull · Tirón', 3, 3, 10, 12, 90),
    ('11111111-1111-4111-8111-111111111103', '0031', 1, 'Pull · Tirón', 4, 3, 10, 15, 60),

    ('11111111-1111-4111-8111-111111111103', '0043', 2, 'Legs · Pierna', 0, 4, 6, 10, 120),
    ('11111111-1111-4111-8111-111111111103', '0085', 2, 'Legs · Pierna', 1, 3, 8, 10, 120),
    ('11111111-1111-4111-8111-111111111103', '0336', 2, 'Legs · Pierna', 2, 3, 10, 12, 60),
    ('11111111-1111-4111-8111-111111111103', 'cg-mach-0003', 2, 'Legs · Pierna', 3, 3, 10, 12, 60),
    ('11111111-1111-4111-8111-111111111103', '1379', 2, 'Legs · Pierna', 4, 4, 12, 15, 45)
) AS v(template_id, exercise_id, day_index, day_label, order_index, target_sets, target_reps_min, target_reps_max, rest_seconds)
WHERE NOT EXISTS (
  SELECT 1
    FROM public.routine_template_exercises rte
   WHERE rte.template_id = v.template_id::uuid
     AND rte.day_index = v.day_index
     AND rte.order_index = v.order_index
);

-- 3. Atomic RPC to clone an official routine_template for the signed-in user
CREATE OR REPLACE FUNCTION public.clone_routine_template(p_template_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_tpl record;
  v_routine_id uuid;
  v_inserted integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT id, title, description, is_published
    INTO v_tpl
    FROM public.routine_templates
   WHERE id = p_template_id
     AND (
       is_published = true
       OR public.has_role('coach'::public.app_role)
       OR public.has_role('admin'::public.app_role)
       OR public.has_role('developer'::public.app_role)
     );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plantilla no encontrada';
  END IF;

  INSERT INTO public.routines (user_id, title, description, source)
  VALUES (v_uid, v_tpl.title, v_tpl.description, 'user')
  RETURNING id INTO v_routine_id;

  INSERT INTO public.routine_exercises (
    routine_id,
    exercise_id,
    target_sets,
    rest_seconds,
    order_index,
    day_index,
    day_label,
    target_reps_min,
    target_reps_max
  )
  SELECT
    v_routine_id,
    rte.exercise_id,
    rte.target_sets,
    COALESCE(rte.rest_seconds, 90),
    rte.order_index,
    rte.day_index,
    COALESCE(rte.day_label, ''),
    rte.target_reps_min,
    rte.target_reps_max
  FROM public.routine_template_exercises rte
  JOIN public.exercises ex ON ex.id = rte.exercise_id
  WHERE rte.template_id = p_template_id
  ORDER BY rte.day_index, rte.order_index;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted = 0 THEN
    DELETE FROM public.routines WHERE id = v_routine_id;
    RAISE EXCEPTION 'La plantilla no tiene ejercicios disponibles';
  END IF;

  RETURN v_routine_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.clone_routine_template(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clone_routine_template(uuid) TO authenticated;
