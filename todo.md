# TODO - Detector de Matrículas

## Backend
- [x] Crear endpoint tRPC para detección de matrículas con IA multimodal
- [x] Implementar validación de formato de matrículas españolas
- [x] Implementar manejo de errores y respuestas

## Frontend - Cámara y Captura
- [x] Leer documentación de expo-camera
- [x] Implementar pantalla de captura con vista previa de cámara
- [x] Agregar botón de captura con feedback háptico
- [x] Implementar indicador de estado (listo/procesando/detectado)
- [x] Agregar permisos de cámara

## Frontend - Detección y Resultado
- [x] Implementar pantalla de resultado de detección
- [x] Mostrar imagen capturada con matrícula
- [x] Mostrar texto de matrícula detectada
- [x] Mostrar nivel de confianza
- [x] Implementar edición manual de matrícula
- [x] Agregar botones: Guardar, Descartar, Reintentar

## Frontend - Almacenamiento
- [x] Leer documentación de expo-file-system
- [x] Implementar función para guardar matrículas en archivo de texto
- [x] Implementar almacenamiento de historial en AsyncStorage
- [x] Agregar timestamp a cada matrícula guardada

## Frontend - Historial
- [x] Implementar pantalla de historial con lista de matrículas
- [x] Mostrar matrícula, fecha, hora en cada elemento
- [x] Implementar barra de búsqueda
- [x] Implementar eliminación individual de entradas
- [x] Implementar función de exportar archivo de texto
- [x] Integrar sistema de compartir nativo

## UI/UX
- [x] Actualizar tema de colores según design.md
- [x] Implementar navegación entre pantallas
- [x] Agregar iconos a la barra de navegación
- [x] Implementar feedback visual para estados de carga
- [ ] Agregar animaciones sutiles de transición
- [x] Implementar modo oscuro

## Testing y Validación
- [ ] Probar captura de cámara en dispositivo real
- [ ] Probar detección con matrículas reales
- [x] Validar formato de matrículas españolas
- [ ] Probar exportación de archivo
- [ ] Probar sistema de compartir
- [ ] Validar persistencia de datos

## Estadísticas (Nueva Funcionalidad)
- [x] Crear pantalla de estadísticas con tabs
- [x] Calcular total de matrículas detectadas
- [x] Implementar gráfico de actividad por día
- [x] Implementar gráfico de actividad por mes
- [x] Mostrar recuentos diarios en tabla
- [x] Mostrar recuentos mensuales en tabla
- [x] Agregar tab a la navegación inferior
- [x] Integrar estadísticas con datos existentes


## Detección Automática (Nuevas Mejoras)
- [x] Implementar detección continua sin botón de captura
- [x] Agregar sistema de alertas visuales y hápticas
- [x] Implementar notificación cuando se detecte matrícula válida
- [x] Implementar notificación de registro exitoso
- [x] Mantener vista de captura después de registrar

## Geolocalización
- [x] Leer documentación de expo-location
- [x] Implementar permisos de ubicación
- [x] Capturar coordenadas GPS con cada foto
- [x] Agregar fallback "NO GPS" cuando no esté disponible
- [x] Guardar ubicación en historial

## Agrupación de Matrículas
- [x] Modificar estructura de datos para agrupar matrículas únicas
- [x] Contar repeticiones de cada matrícula
- [x] Actualizar pantalla de historial para mostrar agrupación
- [x] Modificar archivo de texto con formato agrupado

## Exportación a PDF
- [x] Instalar dependencia de generación PDF
- [x] Crear generador de reporte PDF
- [x] Incluir gráficos en PDF
- [x] Incluir tablas de estadísticas
- [x] Incluir información de matrículas únicas
- [x] Implementar función de exportar PDF desde estadísticas


## Optimizaciones (Fase 2)
- [x] Cambiar a modo video continuo en lugar de capturas cada segundo
- [x] Implementar detección visual de marco (verde al intuir matrícula)
- [x] Agregar botón manual de captura si no detecta en 3 segundos
- [x] Optimizar velocidad de registro (reducir latencia)
- [x] Implementar actualización automática de historial al acceder
- [x] Simplificar estadísticas: solo top 5 + total único
- [x] Agregar detalle de matrícula al pulsar (fecha, hora, ubicación)
- [x] Remover estadísticas innecesarias


## Cambios Finales (Fase 3)
- [x] Eliminar detección automática de video
- [x] Mantener solo captura manual con botón
- [x] Simplificar estadísticas (remover "Total de detecciones")
- [x] Aplicar estilo principal a "Matrículas únicas"
- [x] Implementar scroll infinito en listado de matrículas
- [x] Colorear diferente los top 5 elementos
- [x] Anclar header "Top 5 Matrículas" al hacer scroll
- [x] Auto-actualizar estadísticas tras nueva detección
- [x] Auto-actualizar historial tras nueva detección


## Mejoras Finales (Fase 4)
- [x] Eliminar botón de historial de vista de cámara
- [x] Mejorar botón de captura con doble borde blanco
- [x] Agregar icono de cámara al botón
- [x] Optimizar velocidad de procesamiento
- [x] Corregir ordenamiento del Top 5 (mayor a menor)
- [x] Implementar vista de mapa al pulsar GPS


## Cambios Finales (Fase 5)
- [x] Ordenar historial por fecha de detección (más reciente primero)
- [x] Implementar zoom con pinch en vista de cámara
- [x] Mejorar alertas: ✓ para nuevas, ✓ + icono para duplicadas
- [x] Corregir crash de mapa usando Google Maps URL
- [x] Exportar a CSV con formato Excel


## Mejoras Finales (Fase 6)
- [x] Mejorar zoom pinch (separar dedos amplía hasta 200%, juntar reduce)
- [x] Mantener nivel de zoom actual al soltar gesto
- [x] Alertas con colores: VERDE para nuevas, ROJO para duplicadas
- [ ] Integrar OCR local (tesseract-ocr o similar)
- [x] Notificar falta de conexión a internet
- [x] Notificar GPS inactivo


## Cambios Finales (Fase 7)
- [x] Eliminar alertas repetitivas de conexión e internet
- [x] Mantener solo indicador visual de GPS en vista de cámara
- [x] Agregar función de mapa en pantalla de historial
- [x] Crear pantalla de bienvenida/onboarding
- [x] Implementar opción para activar datos móviles
- [x] Implementar opción para activar GPS
- [x] Mejorar formato CSV con columna unificada LATITUD/LONGITUD


## Optimizaciones Finales (Fase 8)
- [x] Implementar monitoreo eficiente de GPS sin bucles
- [x] Usar listeners de eventos para cambios de GPS
- [x] Simplificar alertas: remover icono información
- [x] Mantener ✓ y ⚠️ para duplicadas
- [x] Corregir formato CSV a "lat,lon" en una celda
- [x] Maximizar operaciones locales
- [x] Minimizar dependencias en nube


## Correcciones Críticas (Fase 9)
- [x] Corregir listeners de GPS para actualizar en tiempo real
- [x] Arreglar formato CSV: "40.45330,-3.86069" (punto decimal)
- [x] Remover subrayado de GPS en historial
- [x] Igualar estilo GPS historial con estadísticas
- [x] Ordenar Top 5 descendente (mayor a menor)
- [ ] Implementar modo batch de captura


## Mejoras de UI (Fase 10)
- [x] Eliminar fondo gris bajo botón de captura
- [x] Cambiar marco a color azul (#0066CC)
- [x] Agregar texto informativo bajo marco
- [x] Eliminar icono de flecha durante procesamiento
- [x] Cambiar GPS a bullet rojo/verde (⦿)
- [x] Simplificar alerta (solo ✓ y ⚠️)
- [x] Implementar multi-selección en historial con long-press


## Ajustes Finales (Fase 11)
- [x] Agregar texto "GPS activo" o "GPS inactivo" junto al icono ⦿
- [x] Hacer transparente el fondo del componente del botón de captura


## Limpieza y Optimización (Fase 12)
- [x] Eliminar código de símbolo de alerta en index.tsx
- [x] Eliminar código de pinch que no funciona
- [x] Limpiar código no utilizado en todo el proyecto
- [x] Modificar background en theme.config.js a transparencia 50%


## Ajustes de Background (Fase 13)
- [x] Restaurar background a #ffffff y #151718 (sin transparencia)
- [x] Eliminar background del componente del botón de captura
- [x] Mantener botón sobre cámara sin fondo
- [x] Fondo opaco solo en tab bar


## Mejoras de Historial (Fase 14)
- [x] Ordenar historial por fecha más reciente primero
- [x] Agregar radio buttons "En la acera" y "En doble fila"
- [x] Mostrar etiqueta "ACERA" o "DOBLE FILA" en lista
- [x] Implementar long press para editar matrícula
- [x] Actualizar estructura de datos para guardar ubicación de estacionamiento


## Mejoras de Interfaz (Fase 15)
- [x] Mostrar fecha/hora en elementos de lista del historial
- [x] Mostrar ubicación (ACERA/DOBLE FILA/Sin definir) en elementos de lista
- [x] Eliminar texto "Mantén pulsado para editar" en detalle de historial
- [x] Formatear GPS en BOLD en detalle de historial
- [x] Agregar información de ubicación en detalle de estadísticas
- [x] Actualizar exportación CSV con columna LUGAR (AC/DF/SD)


## Mejoras de Historial (Fase 16)
- [x] Mostrar ubicación real en lista (En la acera/En doble fila) en lugar de "Sin definir"
- [x] Refrescar historial al volver de editar elemento
- [x] Implementar alerta de patrón: 5 detecciones misma matrícula en radio 50m
- [x] Alertar cada 5 nuevas detecciones en misma ubicación y matrícula


## Integración de Mapa Nativo (Fase 17)
- [x] Integrar plate-map.tsx en historial.tsx
- [x] Reemplazar openURL de Google Maps con navegación a plate-map
- [x] Pasar parámetros: latitude, longitude, plate


## Correcciones y Mejoras (Fase 18)
- [x] Eliminar símbolo ⚠️ de línea 193 en index.tsx
- [x] Diagnosticar y corregir cierre inesperado en plate-map.tsx
- [x] Permitir seleccionar ubicación (acera/doble fila) sin modal en historial
- [x] Modal solo para editar matrícula, no para ubicación


## Resoluci\u00f3## Resolución de Build Android (Fase 19)
- [x] Eliminar pnpm-lock.yaml y regenerarlo
- [x] Verificar compatibilidad de pnpm con EAS
- [x] Ejecutar pnpm install sin conflictos
- [x] Confirmar versiones compatibles con Expo 54
- [x] Crear eas.json con configuración optimizada

## Mejoras de Interfaz y GPS (Fase 20)
- [x] Eliminar etiquetas de confianza (alta/media/baja) en stats.tsx e history.tsx
- [x] Agregar botón rojo con X para eliminar elementos de detalle
- [x] Implementar long-press en GPS para editar ubicación en mapa
- [x] Optimizar actualización de posición GPS en captura
