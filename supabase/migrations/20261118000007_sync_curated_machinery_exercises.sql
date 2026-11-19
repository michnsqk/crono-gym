-- Sync new curated Cronos machinery exercises + fix CG-EQP-0026 / CG-EQP-0077 mappings in public.exercises
UPDATE public.exercises
   SET equipment_id = 'CG-EQP-0055'
 WHERE id = 'cg-mach-0229' AND equipment_id = 'CG-EQP-0026';

INSERT INTO public.exercises (id, name, name_es, body_part, target, equipment, equipment_id, gif_url, is_active, is_hidden)
VALUES
  ('cg-mach-0232', 'Curl martillo estricto con Arm Blaster y mancuernas', 'Curl martillo estricto con Arm Blaster y mancuernas', 'upper arms', 'biceps', 'CG-EQP-0077::Arm Blaster', 'CG-EQP-0077', 'videos/0313-3jQ1X1O.gif', true, false),
  ('cg-mach-0233', 'Curl supino alterno con Arm Blaster', 'Curl supino alterno con Arm Blaster', 'upper arms', 'biceps', 'CG-EQP-0077::Arm Blaster', 'CG-EQP-0077', 'videos/0294-7Q1Y2q1.gif', true, false),
  ('cg-mach-0234', 'Sentadilla Sissy con mancuerna al pecho (Goblet)', 'Sentadilla Sissy con mancuerna al pecho (Goblet)', 'upper legs', 'quads', 'CG-EQP-0030::Sentadilla Sissy', 'CG-EQP-0030', 'videos/0539-5jF3Q8S.gif', true, false),
  ('cg-mach-0235', 'Patada de glúteo con pausa isométrica arriba en máquina', 'Patada de glúteo con pausa isométrica arriba en máquina', 'upper legs', 'glutes', 'CG-EQP-0007::Patada Gluteo Maquina', 'CG-EQP-0007', 'videos/0585-j8J8fR6.gif', true, false),
  ('cg-mach-0236', 'Patada de glúteo tempo controlado (3-1-1) en máquina', 'Patada de glúteo tempo controlado (3-1-1) en máquina', 'upper legs', 'glutes', 'CG-EQP-0007::Patada Gluteo Maquina', 'CG-EQP-0007', 'videos/0585-j8J8fR6.gif', true, false),
  ('cg-mach-0237', 'Remo sentado en máquina agarre prono alto (espalda alta)', 'Remo sentado en máquina agarre prono alto (espalda alta)', 'back', 'upper back', 'CG-EQP-0010::Maquina Remo Sentado', 'CG-EQP-0010', 'videos/0861-0j3vM2L.gif', true, false),
  ('cg-mach-0238', 'Remo unilateral en máquina sentada', 'Remo unilateral en máquina sentada', 'back', 'lats', 'CG-EQP-0010::Maquina Remo Sentado', 'CG-EQP-0010', 'videos/0861-0j3vM2L.gif', true, false),
  ('cg-mach-0239', 'Remo en polea baja con maneral V', 'Remo en polea baja con maneral V', 'back', 'lats', 'CG-EQP-0042::Maneral V', 'CG-EQP-0042', 'videos/0861-0j3vM2L.gif', true, false),
  ('cg-mach-0240', 'Jalón neutro cerrado en polea alta con maneral V', 'Jalón neutro cerrado en polea alta con maneral V', 'back', 'lats', 'CG-EQP-0042::Maneral V', 'CG-EQP-0042', 'videos/2616-mD3L8zP.gif', true, false),
  ('cg-mach-0241', 'Extensión de tríceps sobre cabeza en polea con maneral V metálico', 'Extensión de tríceps sobre cabeza en polea con maneral V metálico', 'upper arms', 'triceps', 'CG-EQP-0046::Maneral V Metalico', 'CG-EQP-0046', 'videos/0241-kL8H9Q1.gif', true, false),
  ('cg-mach-0242', 'Remo al rostro en polea con maneral V metálico', 'Remo al rostro en polea con maneral V metálico', 'shoulders', 'delts', 'CG-EQP-0046::Maneral V Metalico', 'CG-EQP-0046', 'videos/0215-7R9qP3X.gif', true, false),
  ('cg-mach-0243', 'Jalón al pecho con barra larga de agarraderas neutras', 'Jalón al pecho con barra larga de agarraderas neutras', 'back', 'lats', 'CG-EQP-0043::Maneral Barra Larga Agarraderas', 'CG-EQP-0043', 'videos/0818-X7c5y8u.gif', true, false),
  ('cg-mach-0244', 'Remo sentado en polea con maneral agarre cerrado', 'Remo sentado en polea con maneral agarre cerrado', 'back', 'upper back', 'CG-EQP-0044::Maneral Agarre Cerrado', 'CG-EQP-0044', 'videos/0861-0j3vM2L.gif', true, false),
  ('cg-mach-0245', 'Remo cerrado en polea alta con maneral metálico', 'Remo cerrado en polea alta con maneral metálico', 'back', 'lats', 'CG-EQP-0049::Maneral Agarre Cerrado Metalico', 'CG-EQP-0049', 'videos/2616-mD3L8zP.gif', true, false),
  ('cg-mach-0246', 'Fondos en paralelas con cinturón de lastre', 'Fondos en paralelas con cinturón de lastre', 'chest', 'pectorals', 'CG-EQP-0048::Cinturon Lastre Cadena', 'CG-EQP-0048', 'videos/0009-pN3R4mV.gif', true, false),
  ('cg-mach-0247', 'Dominadas pronas con cinturón de lastre', 'Dominadas pronas con cinturón de lastre', 'back', 'lats', 'CG-EQP-0048::Cinturon Lastre Cadena', 'CG-EQP-0048', 'videos/0678-qL9Z7xP.gif', true, false),
  ('cg-mach-0248', 'Flexiones profundas en soporte de lagartijas', 'Flexiones profundas en soporte de lagartijas', 'chest', 'pectorals', 'CG-EQP-0056::Soporte Lagartijas', 'CG-EQP-0056', 'videos/0662-j8Q7P9X.gif', true, false),
  ('cg-mach-0249', 'Curl de bíceps de pie con barra Z olímpica', 'Curl de bíceps de pie con barra Z olímpica', 'upper arms', 'biceps', 'CG-EQP-0059::Barra Z Olimpica', 'CG-EQP-0059', 'videos/0447-bN8Q1zM.gif', true, false),
  ('cg-mach-0250', 'Remo al mentón agarre ancho con barra Z olímpica', 'Remo al mentón agarre ancho con barra Z olímpica', 'shoulders', 'delts', 'CG-EQP-0059::Barra Z Olimpica', 'CG-EQP-0059', 'videos/0447-bN8Q1zM.gif', true, false),
  ('cg-mach-0251', 'Curl martillo neutro con barra romana', 'Curl martillo neutro con barra romana', 'upper arms', 'biceps', 'CG-EQP-0053::Barra Romana', 'CG-EQP-0053', 'videos/0031-pM8Y4nX.gif', true, false),
  ('cg-mach-0252', 'Sentadilla perfecta postura cerrada para vasto externo', 'Sentadilla perfecta postura cerrada para vasto externo', 'upper legs', 'quads', 'CG-EQP-0008::Maquina Sentadilla Perfecta', 'CG-EQP-0008', 'videos/0739-10Z2DXU.gif', true, false),
  ('cg-mach-0253', 'Curl predicador a un brazo con pausa en máquina', 'Curl predicador a un brazo con pausa en máquina', 'upper arms', 'biceps', 'CG-EQP-0026::Maquina Curl Biceps Predicador', 'CG-EQP-0026', 'videos/0575-q6y3OhV.gif', true, false),
  ('cg-mach-0254', 'Pantorrilla sentado con pausa abajo de 2 s', 'Pantorrilla sentado con pausa abajo de 2 s', 'lower legs', 'calves', 'CG-EQP-0027::Maquina Pantorrilla Sentado', 'CG-EQP-0027', 'videos/1379-m7P4wN2.gif', true, false)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  name_es = EXCLUDED.name_es,
  equipment = EXCLUDED.equipment,
  equipment_id = EXCLUDED.equipment_id,
  gif_url = EXCLUDED.gif_url,
  is_active = true,
  is_hidden = false;
