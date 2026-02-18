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
