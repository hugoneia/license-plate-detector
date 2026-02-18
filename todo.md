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
