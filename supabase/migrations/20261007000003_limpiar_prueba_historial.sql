-- CloseLabs Voice — limpieza: la comprobación del arreglo 20261007000002 dejó dos registros de prueba
-- (`nicolas+prueba-dup@closelabs.co`) en el historial de altas y bajas, que saldrían en la facturación
-- de octubre de 2026. El servidor no puede borrar historial (a propósito), por eso va aquí.
delete from public.socio_cambios where email like 'nicolas+prueba-%@closelabs.co';
